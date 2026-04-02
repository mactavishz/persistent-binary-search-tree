import {
  Button,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Text,
} from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { usePlayback } from "../../hooks/usePlayback.js";
import { PartialPersistentBinarySearchTree } from "../../../persistent/partial-persistent-bst.js";
import {
  buildBstMemoryGraph,
  buildBstVisualizerRun,
  collectSnapshotSeries,
  type BstStepHighlight,
  type BstVisualizerFrame,
  type BstVisualizerRun,
} from "./BstVisualizer.js";
import {
  BstOperationHistory,
  type BstOperationHistoryEntry,
} from "./BstOperationHistory.js";
import { BstTreeView } from "./BstTreeView.js";

type BstOperation = "insert" | "delete" | "query";

const SAMPLE_KEYS = [20, 10, 30] as const;
const EMPTY_HIGHLIGHT: BstStepHighlight = {
  focusNodeId: null,
  relatedNodeId: null,
  activeNodeIds: [],
  enteredNodeIds: [],
  removedNodeIds: [],
};

function operationLabel(kind: BstOperationHistoryEntry["kind"]): string {
  return kind === "insert" ? "Insert" : "Delete";
}

function createHistoryEntry(params: {
  readonly version: number;
  readonly kind: BstOperationHistoryEntry["kind"];
  readonly key: number;
}): BstOperationHistoryEntry {
  return {
    version: params.version,
    kind: params.kind,
    key: params.key,
    label: `V${params.version}: ${operationLabel(params.kind)} ${params.key}`,
  };
}

function createSampleHistoryEntries(): BstOperationHistoryEntry[] {
  return SAMPLE_KEYS.map((key, index) =>
    createHistoryEntry({
      version: index,
      kind: "insert",
      key,
    }),
  );
}

function historyEntryFromTrace(trace: {
  readonly kind: "insert" | "delete" | "query";
  readonly key: number;
  readonly sourceVersion: number;
  readonly targetVersion: number;
}): BstOperationHistoryEntry | null {
  if (trace.kind !== "insert" && trace.kind !== "delete") {
    return null;
  }

  if (trace.targetVersion <= trace.sourceVersion) {
    return null;
  }

  return createHistoryEntry({
    version: trace.targetVersion,
    kind: trace.kind,
    key: trace.key,
  });
}

function createTree(
  withSample: boolean,
): PartialPersistentBinarySearchTree<number> {
  const tree = new PartialPersistentBinarySearchTree<number>();
  if (withSample) {
    for (const key of SAMPLE_KEYS) {
      tree.insert(key);
    }
  }
  return tree;
}

export function BstDemoPage(): JSX.Element {
  const initialTree = useMemo(() => createTree(true), []);
  const treeRef = useRef(initialTree);

  const [operation, setOperation] = useState<BstOperation>("insert");
  const [keyInput, setKeyInput] = useState<number | "">(25);
  const [snapshots, setSnapshots] = useState(() =>
    collectSnapshotSeries(initialTree),
  );
  const [queryVersion, setQueryVersion] = useState<string | null>(
    snapshots.length > 0
      ? String(snapshots[snapshots.length - 1]!.version)
      : null,
  );
  const [selectedVersion, setSelectedVersion] = useState<number | null>(
    snapshots.length > 0 ? snapshots[snapshots.length - 1]!.version : null,
  );
  const [historyEntries, setHistoryEntries] = useState<BstOperationHistoryEntry[]>(
    () => createSampleHistoryEntries(),
  );
  const [run, setRun] = useState<BstVisualizerRun | null>(null);

  const playback = usePlayback(run?.frames.length ?? 0);
  const memoryGraph = useMemo(() => buildBstMemoryGraph(snapshots), [snapshots]);
  const latestVersion =
    snapshots.length > 0
      ? snapshots[snapshots.length - 1]!.version
      : null;

  useEffect(() => {
    if (!run) {
      playback.setCurrentStep(0);
      playback.setIsPlaying(false);
      return;
    }

    playback.setCurrentStep(0);
    playback.setIsPlaying(run.frames.length > 1);
  }, [run]);

  useEffect(() => {
    if (latestVersion === null) {
      setQueryVersion(null);
      setSelectedVersion(null);
      return;
    }

    if (
      queryVersion === null ||
      Number.isNaN(Number(queryVersion)) ||
      Number(queryVersion) > latestVersion
    ) {
      setQueryVersion(String(latestVersion));
    }

    if (
      selectedVersion === null ||
      Number.isNaN(selectedVersion) ||
      selectedVersion > latestVersion
    ) {
      setSelectedVersion(latestVersion);
    }
  }, [latestVersion, queryVersion, selectedVersion]);

  const currentFrame: BstVisualizerFrame | null = useMemo(() => {
    if (!run || run.frames.length === 0) {
      return null;
    }
    return (
      run.frames[Math.min(playback.currentStep, run.frames.length - 1)] ?? null
    );
  }, [playback.currentStep, run]);

  const parsedKey =
    typeof keyInput === "number" && Number.isFinite(keyInput)
      ? Math.trunc(keyInput)
      : null;
  const canExecute = parsedKey !== null;

  const showOperationHighlight = run !== null;
  const activeVersion = showOperationHighlight
    ? (currentFrame?.activeVersion ?? null)
    : null;
  const latestVisibleVersion =
    currentFrame?.latestVersion ?? latestVersion;

  const replaceTree = (withSample: boolean): void => {
    const tree = createTree(withSample);
    treeRef.current = tree;
    const nextSnapshots = collectSnapshotSeries(tree);
    setSnapshots(nextSnapshots);
    setRun(null);
    setQueryVersion(
      nextSnapshots.length > 0
        ? String(nextSnapshots[nextSnapshots.length - 1]!.version)
        : null,
    );
    setSelectedVersion(
      nextSnapshots.length > 0 ? nextSnapshots[nextSnapshots.length - 1]!.version : null,
    );
    setHistoryEntries(withSample ? createSampleHistoryEntries() : []);
  };

  const execute = (): void => {
    if (parsedKey === null) {
      return;
    }

    const tree = treeRef.current;
    const queryVersionNumber =
      queryVersion === null ? tree.getLatestVersion() : Number(queryVersion);

    const trace =
      operation === "insert"
        ? tree.traceInsert(parsedKey)
        : operation === "delete"
          ? tree.traceDelete(parsedKey)
          : tree.traceSearchExact(
              parsedKey,
              Number.isNaN(queryVersionNumber) ? undefined : queryVersionNumber,
            );

    const nextSnapshots = collectSnapshotSeries(tree);
    const latestNextVersion =
      nextSnapshots.length > 0 ? nextSnapshots[nextSnapshots.length - 1]!.version : null;
    const nextRun = buildBstVisualizerRun({
      trace,
      snapshots: nextSnapshots,
      queryVersion:
        operation === "query" && !Number.isNaN(queryVersionNumber)
          ? queryVersionNumber
          : null,
    });
    const nextHistoryEntry = historyEntryFromTrace(trace);

    setSnapshots(nextSnapshots);
    if (operation === "query" && !Number.isNaN(queryVersionNumber)) {
      setSelectedVersion(queryVersionNumber);
    } else {
      setSelectedVersion(latestNextVersion);
    }
    if (nextHistoryEntry) {
      setHistoryEntries((entries) => [...entries, nextHistoryEntry]);
    }
    setRun(nextRun);
  };

  const handleSelectVersion = (version: number): void => {
    setSelectedVersion(version);
    setQueryVersion(String(version));
  };

  const versionOptions = snapshots.map((snapshot) => ({
    value: String(snapshot.version),
    label: `v${snapshot.version}`,
  }));

  return (
    <main className="app-shell">
      <div className="app-layout app-layout-bst">
        <section className="controls-row">
          <Paper
            className="controls-panel controls-panel-bst"
            withBorder
            radius="md"
            p="md"
          >
            <div>
              <Text size="sm" fw={600} mb={4}>
                Operations
              </Text>
              <SegmentedControl
                fullWidth
                data={[
                  { label: "Insert", value: "insert" },
                  { label: "Remove", value: "delete" },
                  { label: "Query", value: "query" },
                ]}
                value={operation}
                onChange={(value) => setOperation(value as BstOperation)}
              />
            </div>

            <NumberInput
              label="Key"
              description="Integer key to trace"
              value={keyInput}
              allowDecimal={false}
              w="100%"
              onChange={(value) => {
                if (typeof value === "number" && Number.isFinite(value)) {
                  setKeyInput(Math.trunc(value));
                  return;
                }
                if (value === "") {
                  setKeyInput("");
                }
              }}
            />

            <Select
              label="Query version"
              description="Used only for query"
              value={queryVersion}
              data={versionOptions}
              w="100%"
              disabled={operation !== "query" || versionOptions.length === 0}
              onChange={setQueryVersion}
            />

            <Button
              type="button"
              onClick={execute}
              disabled={!canExecute}
              fullWidth
            >
              Start
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => replaceTree(true)}
              fullWidth
            >
              Reset
            </Button>
            <Button
              type="button"
              variant="light"
              onClick={() => replaceTree(false)}
              fullWidth
            >
              Clear
            </Button>
          </Paper>
        </section>

        <section className="tree-column tree-column-bst">
          <BstTreeView
            memoryGraph={currentFrame?.memoryGraph ?? memoryGraph}
            highlight={currentFrame?.highlight ?? EMPTY_HIGHLIGHT}
            activeVersion={activeVersion}
            latestVersion={latestVisibleVersion}
            selectedVersion={selectedVersion}
            onSelectVersion={handleSelectVersion}
          />
        </section>

        <section className="history-column history-column-bst">
          <BstOperationHistory
            entries={historyEntries}
            selectedVersion={selectedVersion}
            onSelectVersion={handleSelectVersion}
          />
        </section>
      </div>
    </main>
  );
}
