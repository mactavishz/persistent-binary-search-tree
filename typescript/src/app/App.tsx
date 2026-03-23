import { Paper, Text, Textarea } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { Mesh } from "../mesh/mesh.js";
import { parseObj } from "../mesh/obj-loader.js";
import { buildPointLocationIndex, locatePoint } from "../planar/point-location.js";
import { meshToRenderModel } from "../planar/render-model.js";
import { Controls, type DemoModel } from "./components/Controls.js";
import { GraphCanvas, type QueryPointRender, type SlabRender } from "./components/GraphCanvas.js";
import { ResultsTable } from "./components/ResultsTable.js";

type PresetDemoModel = Exclude<DemoModel, "custom">;

interface QueryPoint {
  readonly name: string;
  readonly x: number;
  readonly y: number;
}

interface QueryRow extends QueryPoint {
  readonly slab: string;
  readonly face: string;
}

interface LoadedState {
  readonly mesh: Mesh;
  readonly renderModel: ReturnType<typeof meshToRenderModel>;
  readonly locator: ReturnType<typeof buildPointLocationIndex>;
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

  return {
    mesh,
    renderModel: meshToRenderModel(mesh),
    locator: buildPointLocationIndex(mesh)
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
  const [rows, setRows] = useState<QueryRow[]>([]);
  const [showSlabs, setShowSlabs] = useState(false);
  const [isLoadingPreset, setIsLoadingPreset] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demo === "custom") {
      return;
    }

    let cancelled = false;
    setIsLoadingPreset(true);
    setLoaded(null);
    setPresetObjText("");
    setPoints([]);
    setRows([]);
    setShowSlabs(false);
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
    setRows([]);
    setShowSlabs(false);
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
    if (!showSlabs || loaded === null) {
      return [];
    }

    return loaded.locator.slabIndex.slabs.map((slab) => ({
      name: slab.name,
      start: slab.start,
      end: slab.end
    }));
  }, [loaded, showSlabs]);

  const onCanvasClick = (x: number, y: number): void => {
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

    const nextRows = points.map((point) => {
      const result = locatePoint(loaded.mesh, loaded.locator, point);
      return {
        name: point.name,
        x: point.x,
        y: point.y,
        slab: result.slabName,
        face: result.faceName
      };
    });
    setRows(nextRows);
    setShowSlabs(true);
  };

  const onClearPoints = (): void => {
    setPoints([]);
    setRows([]);
    setShowSlabs(false);
  };

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
        <section className="left-column">
          <Controls
            demo={demo}
            canStart={loaded !== null && points.length > 0}
            canClear={points.length > 0 || rows.length > 0}
            onDemoChange={(nextDemo) => {
              setDemo(nextDemo);
            }}
            onStart={onStart}
            onClearPoints={onClearPoints}
          />

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

          {error ? (
            <Paper className="error-panel" withBorder radius="md" p="md">
              <Text c="red.8" size="sm">
                {error}
              </Text>
            </Paper>
          ) : null}

          <ResultsTable rows={rows} />
        </section>

        <section className="right-column">
          {loaded ? (
            <GraphCanvas model={loaded.renderModel} queryPoints={queryPoints} slabs={slabLines} onCanvasClick={onCanvasClick} />
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
      </div>
    </main>
  );
}
