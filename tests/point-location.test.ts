import { describe, expect, it } from "vitest";
import { Mesh } from "../src/mesh/mesh.js";
import { parseObj } from "../src/mesh/obj-loader.js";
import {
  buildPointLocationIndex,
  buildPointLocationIndexWithTrace,
  locatePoint,
  traceLocatePoint
} from "../src/planar/point-location.js";
import type { SnapshotNode } from "../src/persistent/snapshot.js";

const PLANAR_1 = `
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

const PLANAR_2 = `
v 3.0 2.5 0.0
v 1.8 2.9 0.0
v 2.1 2.0 0.0
v 2.7 1.0 0.0
v 1.0 0.3 0.0
v 0.1 2.7 0.0
v 0.2 0.5 0.0
v 0.5 2.2 0.0
f 3 1 4
f 3 1 2
f 3 5 4
f 3 8 5
f 3 2 8
f 8 2 6
f 8 7 5
f 7 8 6
`;

function setup(obj: string): { mesh: Mesh; index: ReturnType<typeof buildPointLocationIndex> } {
  const parsed = parseObj(obj);
  const mesh = new Mesh();
  mesh.buildMesh(parsed.vertices, [], parsed.faces);
  return { mesh, index: buildPointLocationIndex(mesh) };
}

function maxSnapshotDepth(nodes: SnapshotNode<unknown, unknown>[]): number {
  if (nodes.length === 0) {
    return 0;
  }

  const nodeById = new Map(nodes.map((node) => [node.nodeId, node]));
  const childIds = new Set<number>();
  for (const node of nodes) {
    if (node.left) {
      childIds.add(node.left.nodeId);
    }
    if (node.right) {
      childIds.add(node.right.nodeId);
    }
  }

  const root = nodes.find((node) => !childIds.has(node.nodeId));
  if (!root) {
    return 0;
  }

  const walk = (nodeId: number): number => {
    const node = nodeById.get(nodeId);
    if (!node) {
      return 0;
    }
    const leftDepth = node.left ? walk(node.left.nodeId) : 0;
    const rightDepth = node.right ? walk(node.right.nodeId) : 0;
    return 1 + Math.max(leftDepth, rightDepth);
  };

  return walk(root.nodeId);
}

describe("point location", () => {
  it("classifies inside, outer and boundary points for planar_1", () => {
    const { mesh, index } = setup(PLANAR_1);

    const inside = locatePoint(mesh, index, { x: 2, y: 1.5 });
    const outer = locatePoint(mesh, index, { x: -1, y: 3 });
    const boundary = locatePoint(mesh, index, { x: 1.5, y: 2 });

    expect(inside.classification).toBe("inside");
    expect(inside.faceName).toMatch(/^F\d+$/);
    expect(outer.classification).toBe("outer");
    expect(outer.faceName).toBe("outerFace");
    expect(boundary.classification).toBe("boundary");
    expect(boundary.faceName).toBe("boundary");
  });

  it("classifies inside, outer and boundary points for planar_2", () => {
    const { mesh, index } = setup(PLANAR_2);

    const inside = locatePoint(mesh, index, { x: 1.6, y: 2.1 });
    const outer = locatePoint(mesh, index, { x: 3.8, y: 2.9 });
    const boundary = locatePoint(mesh, index, { x: 2.4, y: 1.5 });

    expect(inside.classification).toBe("inside");
    expect(inside.faceName).toMatch(/^F\d+$/);
    expect(outer.classification).toBe("outer");
    expect(outer.faceName).toBe("outerFace");
    expect(boundary.classification).toBe("boundary");
    expect(boundary.faceName).toBe("boundary");
  });

  it("keeps traced queries consistent with locatePoint", () => {
    const { mesh, index } = setup(PLANAR_1);
    const points = [
      { x: 2, y: 1.5, name: "p0" },
      { x: -1, y: 3, name: "p1" },
      { x: 1.5, y: 2, name: "p2" }
    ];

    for (const point of points) {
      const direct = locatePoint(mesh, index, point);
      const traced = traceLocatePoint(mesh, index, point);
      expect(traced.result).toEqual(direct);
      expect(traced.events.length).toBeGreaterThan(0);
    }
  });

  it("records slab build steps in index trace", () => {
    const parsed = parseObj(PLANAR_2);
    const mesh = new Mesh();
    mesh.buildMesh(parsed.vertices, [], parsed.faces);
    const build = buildPointLocationIndexWithTrace(mesh);

    expect(build.trace.slabSteps.length).toBeGreaterThan(0);
    expect(build.trace.slabSteps[0]?.kind).toBe("slab-built");
  });

  it("records comparison data for slab lookup and edge search", () => {
    const { mesh, index } = setup(PLANAR_1);
    const point = { x: 2, y: 1.5, name: "p0" };

    const traced = traceLocatePoint(mesh, index, point);
    const slabSteps = traced.events.filter((event) => event.kind === "slab-search-step");
    const edgeSteps = traced.events.filter((event) => event.kind === "band-search-step");

    expect(slabSteps.length).toBeGreaterThan(0);
    expect(edgeSteps.length).toBeGreaterThan(0);

    for (const event of slabSteps) {
      expect(event.queryX).toBe(point.x);
      if (event.candidateSlabName === null) {
        expect(event.candidateSlabStart).toBeNull();
      } else {
        expect(typeof event.candidateSlabStart).toBe("number");
      }
    }

    for (const event of edgeSteps) {
      expect(event.queryX).toBe(point.x);
      expect(event.queryY).toBe(point.y);
      expect(Number.isFinite(event.segmentY)).toBe(true);
      expect(event.segmentEdgeId).toBeGreaterThanOrEqual(0);
      expect(["lower", "higher"]).toContain(event.direction);
      if (event.candidateEdgeId !== null) {
        expect(event.candidateEdgeId).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("avoids degenerate linked-list slab snapshots", () => {
    const parsed = parseObj(PLANAR_2);
    const mesh = new Mesh();
    mesh.buildMesh(parsed.vertices, [], parsed.faces);
    const build = buildPointLocationIndexWithTrace(mesh);

    for (const step of build.trace.slabSteps) {
      const snapshot = step.snapshot;
      const count = snapshot?.nodes.length ?? 0;
      if (count <= 2) {
        continue;
      }

      const depth = maxSnapshotDepth(snapshot?.nodes ?? []);
      const softUpperBound = Math.ceil(Math.log2(count + 1)) * 2;
      expect(depth).toBeLessThanOrEqual(softUpperBound);
    }
  });

  it("starts slab lookup from the middle slab instead of scanning from the left", () => {
    const parsed = parseObj(PLANAR_1);
    const mesh = new Mesh();
    mesh.buildMesh(parsed.vertices, [], parsed.faces);
    const build = buildPointLocationIndexWithTrace(mesh);
    const traced = traceLocatePoint(mesh, build.index, { x: 2.4, y: 1.4, name: "p0" });
    const slabSteps = traced.events.filter((event) => event.kind === "slab-search-step");
    const middleSlab = build.trace.slabSteps[Math.floor(build.trace.slabSteps.length / 2)]?.slab.name;

    expect(slabSteps[0]?.comparedSlabName).toBe(middleSlab);
  });
});
