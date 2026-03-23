import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { Mesh } from "../mesh/mesh.js";
import { parseObj } from "../mesh/obj-loader.js";
import { buildPointLocationIndex, locatePoint } from "../planar/point-location.js";
import { meshToRenderModel } from "../planar/render-model.js";
import { Controls } from "./components/Controls.js";
import { GraphCanvas, type QueryPointRender, type SlabRender } from "./components/GraphCanvas.js";
import { ResultsTable } from "./components/ResultsTable.js";

type DemoModel = "planar_1.obj" | "planar_2.obj" | "planar_3.obj";

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

async function loadDemoMesh(model: DemoModel): Promise<LoadedState> {
  const response = await fetch(`/models/${model}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${model}`);
  }

  const text = await response.text();
  const parsed = parseObj(text);
  const mesh = new Mesh();
  mesh.buildMesh(parsed.vertices, [], parsed.faces);

  const issues = mesh.validate();
  if (issues.length > 0) {
    const details = issues.map((issue) => issue.message).join("\n");
    throw new Error(`Mesh validation failed for ${model}:\n${details}`);
  }

  return {
    mesh,
    renderModel: meshToRenderModel(mesh),
    locator: buildPointLocationIndex(mesh)
  };
}

export default function App(): JSX.Element {
  const [demo, setDemo] = useState<DemoModel>("planar_1.obj");
  const [loaded, setLoaded] = useState<LoadedState | null>(null);
  const [points, setPoints] = useState<QueryPoint[]>([]);
  const [rows, setRows] = useState<QueryRow[]>([]);
  const [showSlabs, setShowSlabs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setPoints([]);
    setRows([]);
    setShowSlabs(false);
    setError(null);

    void loadDemoMesh(demo)
      .then((state) => {
        if (!cancelled) {
          setLoaded(state);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [demo]);

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

  if (error) {
    return <main className="app-shell error">{error}</main>;
  }

  if (!loaded) {
    return <main className="app-shell">Loading {demo}...</main>;
  }

  return (
    <main className="app-shell">
      <header>
        <h1>Planar Point Location Demo</h1>
        <p>Click to place points, then press Start to run planar point location.</p>
      </header>

      <Controls
        demo={demo}
        canStart={points.length > 0}
        canClear={points.length > 0 || rows.length > 0}
        onDemoChange={setDemo}
        onStart={onStart}
        onClearPoints={onClearPoints}
      />

      <GraphCanvas model={loaded.renderModel} queryPoints={queryPoints} slabs={slabLines} onCanvasClick={onCanvasClick} />

      <ResultsTable rows={rows} />
    </main>
  );
}
