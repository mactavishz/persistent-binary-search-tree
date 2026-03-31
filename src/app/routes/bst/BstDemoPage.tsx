import {
  Button,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { PersistentTreeView } from "../../components/PersistentTreeView.js";
import { usePlayback } from "../../hooks/usePlayback.js";
import { PartialPersistentBinarySearchTree } from "../../../persistent/partial-persistent-bst.js";
import {
  buildBstVisualizerRun,
  buildTreeVersionsFromSnapshots,
  collectSnapshotSeries,
  type BstVisualizerFrame,
  type BstVisualizerRun,
} from "./bst-visualizer.js";

type BstOperation = "insert" | "delete" | "query";

const SAMPLE_KEYS = [20, 10, 30] as const;

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
  const [run, setRun] = useState<BstVisualizerRun | null>(null);

  const playback = usePlayback(run?.frames.length ?? 0);

  const treeVersions = useMemo(
    () => buildTreeVersionsFromSnapshots(snapshots),
    [snapshots],
  );
  const latestVersion =
    treeVersions.length > 0
      ? treeVersions[treeVersions.length - 1]!.version
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
      return;
    }

    if (
      queryVersion === null ||
      Number.isNaN(Number(queryVersion)) ||
      Number(queryVersion) > latestVersion
    ) {
      setQueryVersion(String(latestVersion));
    }
  }, [latestVersion, queryVersion]);

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

  const visibleVersions =
    currentFrame?.visibleVersions ??
    treeVersions.map((version) => version.version);
  const showOperationHighlight = run !== null && playback.isPlaying;
  const activeVersion = showOperationHighlight
    ? (currentFrame?.activeVersion ?? null)
    : null;
  const latestVisibleVersion = showOperationHighlight
    ? (currentFrame?.latestVersion ?? null)
    : null;

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
    const nextRun = buildBstVisualizerRun({
      trace,
      snapshots: nextSnapshots,
      queryVersion:
        operation === "query" && !Number.isNaN(queryVersionNumber)
          ? queryVersionNumber
          : null,
    });

    setSnapshots(nextSnapshots);
    setRun(nextRun);
  };

  const versionOptions = treeVersions.map((version) => ({
    value: String(version.version),
    label: `v${version.version}`,
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
          <PersistentTreeView
            versions={currentFrame?.treeVersions ?? treeVersions}
            visibleVersions={visibleVersions}
            activeVersion={activeVersion}
            latestVersion={latestVisibleVersion}
            forceDummyRoot
            singleVersionLineMode
          />
        </section>
      </div>
    </main>
  );
}
