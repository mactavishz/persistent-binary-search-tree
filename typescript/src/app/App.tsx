import { Paper, Text, Textarea } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { Mesh } from "../mesh/mesh.js";
import { parseObj } from "../mesh/obj-loader.js";
import {
  buildPointLocationIndexWithTrace,
  type PointLocationIndex,
  traceLocatePoint
} from "../planar/point-location.js";
import { meshToRenderModel } from "../planar/render-model.js";
import { Controls, type DemoModel } from "./components/Controls.js";
import { GraphCanvas, type QueryPointRender, type SlabRender } from "./components/GraphCanvas.js";
import { PlaybackControls } from "./components/PlaybackControls.js";
import { PersistentTreeView } from "./components/PersistentTreeView.js";
import { ResultsTable } from "./components/ResultsTable.js";
import { StepDetails } from "./components/StepDetails.js";
import { usePlayback } from "./hooks/usePlayback.js";
import { buildVisualizerRun, type VisualizerFrame, type VisualizerRun } from "./utils/visualizer.js";

type PresetDemoModel = Exclude<DemoModel, "custom">;

interface QueryPoint {
  readonly name: string;
  readonly x: number;
  readonly y: number;
}

interface LoadedState {
  readonly mesh: Mesh;
  readonly renderModel: ReturnType<typeof meshToRenderModel>;
  readonly locator: PointLocationIndex;
  readonly buildTrace: ReturnType<typeof buildPointLocationIndexWithTrace>["trace"];
}

interface PresetLoadResult {
  readonly objText: string;
  readonly loaded: LoadedState;
}

const CUSTOM_OBJ_TEMPLATE = [
  "# Write valid OBJ data to render your own planar graph",
  "v 0 0 0",
  "v 2 0 0",
  "v 2 2 0",
  "v 0 2 0",
  "f 1 2 3 4"
].join("\n");

function buildLoadedStateFromObjText(objText: string, sourceName: string): LoadedState {
  const parsed = parseObj(objText);
  const mesh = new Mesh();
  mesh.buildMesh(parsed.vertices, [], parsed.faces);

  const issues = mesh.validate();
  if (issues.length > 0) {
    const details = issues.map((issue) => issue.message).join("\n");
    throw new Error(`Mesh validation failed for ${sourceName}:\n${details}`);
  }

  const buildResult = buildPointLocationIndexWithTrace(mesh);

  return {
    mesh,
    renderModel: meshToRenderModel(mesh),
    locator: buildResult.index,
    buildTrace: buildResult.trace
  };
}

async function loadDemoMesh(model: PresetDemoModel): Promise<PresetLoadResult> {
  const response = await fetch(`/models/${model}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${model}`);
  }

  const objText = await response.text();

  return {
    objText,
    loaded: buildLoadedStateFromObjText(objText, model)
  };
}

export default function App(): JSX.Element {
  const [demo, setDemo] = useState<DemoModel>("planar_1.obj");
  const [presetObjText, setPresetObjText] = useState("");
  const [customObjText, setCustomObjText] = useState(CUSTOM_OBJ_TEMPLATE);
  const [loaded, setLoaded] = useState<LoadedState | null>(null);
  const [points, setPoints] = useState<QueryPoint[]>([]);
  const [run, setRun] = useState<VisualizerRun | null>(null);
  const [isLoadingPreset, setIsLoadingPreset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playback = usePlayback(run?.frames.length ?? 0);

  const currentFrame: VisualizerFrame | null = useMemo(() => {
    if (!run || run.frames.length === 0) {
      return null;
    }
    return run.frames[Math.min(playback.currentStep, run.frames.length - 1)] ?? null;
  }, [playback.currentStep, run]);

  const currentTreeFrame: VisualizerFrame | null = useMemo(() => {
    if (!run || run.frames.length === 0) {
      return null;
    }

    for (let i = Math.min(playback.currentStep, run.frames.length - 1); i >= 0; i -= 1) {
      const frame = run.frames[i];
      if (frame?.treeSnapshotNodes !== null && frame?.treeSnapshotNodes !== undefined) {
        return frame;
      }
    }

    return null;
  }, [playback.currentStep, run]);

  const treeSnapshots = useMemo(() => {
    if (!run) {
      return [];
    }

    const byVersion = new Map<number, {
      version: number;
      slabName: string;
      nodes: Array<{
        nodeId: number;
        copiedFromNodeId: number | null;
        leftNodeId: number | null;
        rightNodeId: number | null;
        label: string;
      }>;
      summary: {
        activeEdgeLabels: string[];
        enteredEdgeLabels: string[];
        removedEdgeLabels: string[];
      };
    }>();

    for (const frame of run.frames) {
      if (frame.treeSnapshotVersion === null || frame.treeSnapshotNodes === null) {
        continue;
      }

      const summary = frame.treeSnapshotSummary ?? {
        slabName: frame.activeSlabName ?? `s${frame.treeSnapshotVersion}`,
        activeEdgeLabels: [],
        enteredEdgeLabels: [],
        removedEdgeLabels: []
      };

      byVersion.set(frame.treeSnapshotVersion, {
        version: frame.treeSnapshotVersion,
        slabName: summary.slabName,
        nodes: frame.treeSnapshotNodes,
        summary: {
          activeEdgeLabels: summary.activeEdgeLabels,
          enteredEdgeLabels: summary.enteredEdgeLabels,
          removedEdgeLabels: summary.removedEdgeLabels
        }
      });
    }

    return Array.from(byVersion.values()).sort((a, b) => a.version - b.version);
  }, [run]);

  const latestTreeVersion = treeSnapshots.length > 0 ? treeSnapshots[treeSnapshots.length - 1]!.version : null;
  const activeTreeVersion = currentTreeFrame?.treeSnapshotVersion ?? latestTreeVersion;

  useEffect(() => {
    if (demo === "custom") {
      return;
    }

    let cancelled = false;
    setIsLoadingPreset(true);
    setLoaded(null);
    setPresetObjText("");
    setPoints([]);
    setRun(null);
    setError(null);

    void loadDemoMesh(demo)
      .then((result) => {
        if (!cancelled) {
          setPresetObjText(result.objText);
          setLoaded(result.loaded);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoaded(null);
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingPreset(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [demo]);

  useEffect(() => {
    if (demo !== "custom") {
      return;
    }

    setIsLoadingPreset(false);
    setPoints([]);
    setRun(null);
    setError(null);

    if (customObjText.trim().length === 0) {
      setLoaded(null);
      return;
    }

    try {
      setLoaded(buildLoadedStateFromObjText(customObjText, "custom"));
    } catch (err: unknown) {
      setLoaded(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [customObjText, demo]);

  const queryPoints: QueryPointRender[] = useMemo(
    () => points.map((point) => ({ x: point.x, y: point.y, label: point.name })),
    [points]
  );

  const slabLines: SlabRender[] = useMemo(() => {
    if (!currentFrame || loaded === null) {
      return [];
    }

    return currentFrame.slabLines.map((slab) => ({
      name: slab.name,
      start: slab.start,
      end: slab.end
    }));
  }, [currentFrame, loaded]);

  const activePointRender: QueryPointRender | null = useMemo(() => {
    if (!currentFrame?.activePointCoords || !currentFrame.activePointName) {
      return null;
    }
    return {
      x: currentFrame.activePointCoords.x,
      y: currentFrame.activePointCoords.y,
      label: currentFrame.activePointName
    };
  }, [currentFrame]);

  const onCanvasClick = (x: number, y: number): void => {
    setRun(null);
    setPoints((prev) => [
      ...prev,
      {
        name: `p${prev.length}`,
        x,
        y
      }
    ]);
  };

  const onStart = (): void => {
    if (!loaded || points.length === 0) {
      return;
    }

    const queryTraces = points.map((point) => {
      const trace = traceLocatePoint(loaded.mesh, loaded.locator, point);
      return {
        point,
        trace,
        result: trace.result
      };
    });

    setRun(
      buildVisualizerRun({
        model: loaded.renderModel,
        build: {
          index: loaded.locator,
          trace: loaded.buildTrace
        },
        points,
        queryTraces
      })
    );
  };

  const onClearPoints = (): void => {
    setPoints([]);
    setRun(null);
  };

  const resultsRows = currentFrame?.rows ?? points.map((point) => ({ name: point.name, slab: "-", face: "-", status: "pending" as const }));

  const sourceObjText = demo === "custom" ? customObjText : presetObjText;
  const isPresetSource = demo !== "custom";
  const graphHint =
    isLoadingPreset && isPresetSource
      ? `Loading ${demo}...`
      : isPresetSource
        ? "Could not render this preset graph."
        : "Enter valid OBJ data to render your custom graph.";

  return (
    <main className="app-shell">
      <header>
        <h1>Planar Point Location Demo</h1>
        <p>Click to place points, then press Start to run planar point location.</p>
      </header>

      <div className="app-layout">
        <section className="controls-row">
          <Controls
            demo={demo}
            canStart={loaded !== null && points.length > 0}
            canClear={points.length > 0 || run !== null}
            onDemoChange={(nextDemo) => {
              setDemo(nextDemo);
            }}
            onStart={onStart}
            onClearPoints={onClearPoints}
          />
        </section>

        <section className="sidebar-column">
          {run !== null ? (
            <PlaybackControls
              currentStep={playback.currentStep}
              totalSteps={run.frames.length}
              isPlaying={playback.isPlaying}
              speed={playback.speed}
              activePhase={currentFrame?.stepperPhase ?? "Build slabs"}
              onPlayPause={() => {
                playback.setIsPlaying(!playback.isPlaying);
              }}
              onNext={playback.next}
              onPrevious={playback.previous}
              onRestart={playback.restart}
              onStepChange={playback.setCurrentStep}
              onSpeedChange={playback.setSpeed}
            />
          ) : null}

          {currentFrame !== null ? <StepDetails frame={currentFrame} /> : null}

          {run === null ? (
            <Paper className="obj-input-panel" withBorder radius="md" p="md">
              <Textarea
                className="obj-textarea"
                label="OBJ Source"
                description={
                  isPresetSource
                    ? "Preset source is readonly. Select custom to edit OBJ data."
                    : "Enter valid OBJ content to render a custom graph."
                }
                value={sourceObjText}
                readOnly={isPresetSource}
                minRows={12}
                maxRows={12}
                autosize
                onChange={(event) => {
                  if (!isPresetSource) {
                    setCustomObjText(event.currentTarget.value);
                  }
                }}
              />
            </Paper>
          ) : null}

          {error ? (
            <Paper className="error-panel" withBorder radius="md" p="md">
              <Text c="red.8" size="sm">
                {error}
              </Text>
            </Paper>
          ) : null}

          <ResultsTable rows={resultsRows} />
        </section>

        <section className="graph-column">
          {loaded ? (
            <GraphCanvas
              model={loaded.renderModel}
              queryPoints={queryPoints}
              slabs={slabLines}
              edgeHighlights={currentFrame?.edgeHighlights ?? []}
              highlightedEdgeIds={currentFrame?.highlightedEdgeIds ?? []}
              highlightedFaceId={currentFrame?.highlightedFaceId ?? null}
              activePoint={activePointRender}
              activeSlabName={currentFrame?.activeSlabName ?? null}
              onCanvasClick={onCanvasClick}
            />
          ) : (
            <Paper className="graph-panel graph-placeholder" withBorder radius="md" p="md">
              <Text fw={600} size="sm">
                Graph Canvas
              </Text>
              <Text c="dimmed" size="xs">
                {graphHint}
              </Text>
            </Paper>
          )}
        </section>

        <section className="tree-column">
          <PersistentTreeView
            versions={treeSnapshots}
            activeVersion={activeTreeVersion}
            latestVersion={latestTreeVersion}
          />
        </section>
      </div>
    </main>
  );
}
