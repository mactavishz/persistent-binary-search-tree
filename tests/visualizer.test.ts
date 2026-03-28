import { describe, expect, it } from "vitest";
import { Mesh } from "../src/mesh/mesh.js";
import { parseObj } from "../src/mesh/obj-loader.js";
import { buildPointLocationIndexWithTrace } from "../src/planar/point-location.js";
import type { GraphRenderModel } from "../src/planar/render-model.js";
import { buildVisualizerRun } from "../src/app/utils/visualizer.js";

const PLANAR_FIXTURE = `
v 1.0 4.0 0.0
v 3.0 4.0 0.0
v 0.0 2.0 0.0
v 2.0 2.0 0.0
v 4.0 2.0 0.0
v 1.0 0.0 0.0
v 3.0 0.0 0.0
f 1 3 4
f 1 4 2
f 2 4 5
f 3 6 4
f 4 6 7
f 4 7 5
`;

const DUMMY_MODEL: GraphRenderModel = {
  vertices: [],
  halfEdges: [],
  faces: [],
  bounds: {
    minX: 0,
    maxX: 1,
    minY: 0,
    maxY: 1
  }
};

function setupBuild() {
  const parsed = parseObj(PLANAR_FIXTURE);
  const mesh = new Mesh();
  mesh.buildMesh(parsed.vertices, [], parsed.faces);
  return buildPointLocationIndexWithTrace(mesh);
}

describe("buildVisualizerRun", () => {
  it("derives slab names from slab starts and versions in query trace events", () => {
    const build = setupBuild();
    const slab = build.trace.slabSteps.find((step) => Number.isFinite(step.slab.start) && Number.isFinite(step.slab.end))?.slab;
    expect(slab).toBeDefined();

    const point = { name: "p0", x: 2, y: 1.5 };
    const result = {
      slabName: slab?.name ?? "s0",
      faceId: 3,
      faceName: "F3",
      classification: "inside" as const
    };

    const run = buildVisualizerRun({
      model: DUMMY_MODEL,
      build,
      points: [point],
      queryTraces: [
        {
          point,
          result,
          trace: {
            result,
            events: [
              {
                kind: "slab-search-step" as const,
                queryX: point.x,
                comparedSlabStart: slab?.start ?? 0,
                comparedSlabEnd: slab?.end ?? 1,
                direction: "right" as const,
                candidateSlabStart: slab?.start ?? null
              },
              {
                kind: "slab-selected" as const,
                pointName: point.name,
                slabVersion: slab?.version ?? 0
              },
              {
                kind: "boundary-check" as const,
                pointName: point.name,
                isBoundary: false
              },
              {
                kind: "band-search-step" as const,
                slabVersion: slab?.version ?? 0,
                segmentEdgeId: 2,
                queryX: point.x,
                queryY: point.y,
                segmentY: 1.7,
                candidateEdgeId: 2,
                direction: "higher" as const
              },
              {
                kind: "band-selected" as const,
                pointName: point.name,
                slabVersion: slab?.version ?? 0,
                segmentEdgeId: 2
              },
              {
                kind: "face-resolved" as const,
                pointName: point.name,
                slabVersion: slab?.version ?? 0,
                faceId: 3,
                classification: "inside" as const
              }
            ]
          }
        }
      ]
    });

    const slabSearchFrame = run.frames.find((frame) => frame.title === "Binary search slabs for p0");
    const slabSelectedFrame = run.frames.find((frame) => frame.title === "Slab selected for p0");
    const bandSearchFrame = run.frames.find((frame) => frame.title.startsWith("Search edge in"));
    const faceResolvedFrame = run.frames.find((frame) => frame.title === "Resolved p0");

    expect(slabSearchFrame?.detail).toContain(slab?.name ?? "s0");
    expect(slabSelectedFrame?.detail).toContain(slab?.name ?? "s0");
    expect(bandSearchFrame?.title).toContain(slab?.name ?? "s0");
    expect(faceResolvedFrame?.activeSlabName).toBe(slab?.name ?? "s0");
  });

  it("derives face labels from semantic classification and face id", () => {
    const build = setupBuild();
    const slab = build.trace.slabSteps[0]?.slab;
    expect(slab).toBeDefined();

    const point = { name: "p1", x: 0, y: 0 };
    const result = {
      slabName: slab?.name ?? "s0",
      faceId: null,
      faceName: "outerFace",
      classification: "outer" as const
    };

    const run = buildVisualizerRun({
      model: DUMMY_MODEL,
      build,
      points: [point],
      queryTraces: [
        {
          point,
          result,
          trace: {
            result,
            events: [
              {
                kind: "slab-selected" as const,
                pointName: point.name,
                slabVersion: slab?.version ?? 0
              },
              {
                kind: "face-resolved" as const,
                pointName: point.name,
                slabVersion: slab?.version ?? 0,
                faceId: null,
                classification: "outer" as const
              }
            ]
          }
        }
      ]
    });

    const outerFrame = run.frames.find((frame) => frame.title === "Resolved p1");
    expect(outerFrame?.detail).toBe("outerFace (outer).");

    const boundaryRun = buildVisualizerRun({
      model: DUMMY_MODEL,
      build,
      points: [point],
      queryTraces: [
        {
          point,
          result: {
            slabName: slab?.name ?? "s0",
            faceId: null,
            faceName: "boundary",
            classification: "boundary"
          },
          trace: {
            result: {
              slabName: slab?.name ?? "s0",
              faceId: null,
              faceName: "boundary",
              classification: "boundary"
            },
            events: [
              {
                kind: "slab-selected" as const,
                pointName: point.name,
                slabVersion: slab?.version ?? 0
              },
              {
                kind: "face-resolved" as const,
                pointName: point.name,
                slabVersion: slab?.version ?? 0,
                faceId: null,
                classification: "boundary" as const
              }
            ]
          }
        }
      ]
    });

    const boundaryFrame = boundaryRun.frames.find((frame) => frame.title === "Resolved p1");
    expect(boundaryFrame?.detail).toBe("boundary (boundary).");
  });
});
