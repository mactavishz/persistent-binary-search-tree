import { Face, Mesh } from "../mesh/mesh.js";
import { buildSlabIndexWithTrace, yAtX } from "./slabs.js";
import type { SlabIndex, SlabRecord } from "./slabs.js";
import type { BandBinarySearchTraceStep, QueryTraceEvent } from "./trace-types.js";

const EPSILON = 1e-7;

export interface QueryPoint {
  readonly x: number;
  readonly y: number;
  readonly name?: string;
}

export interface PointLocationResult {
  readonly slabName: string;
  readonly faceId: number | null;
  readonly faceName: string;
  readonly classification: "inside" | "outer" | "boundary";
}

export interface PointLocationIndex {
  readonly slabIndex: SlabIndex;
  readonly faceByUpperEdgeBySlab: Map<string, Map<number | null, number | null>>;
}

export interface PointLocationBuildTrace {
  readonly slabSteps: ReadonlyArray<import("./trace-types.js").SlabBuildTraceStep>;
}

export interface PointLocationBuildResult {
  readonly index: PointLocationIndex;
  readonly trace: PointLocationBuildTrace;
}

export interface PointLocationTraceResult {
  readonly result: PointLocationResult;
  readonly events: QueryTraceEvent[];
}

function pointInPolygon(x: number, y: number, polygon: ReadonlyArray<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;
    const intersects =
      pi.y > y !== pj.y > y && x < ((pj.x - pi.x) * (y - pi.y)) / (pj.y - pi.y + EPSILON) + pi.x;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function pointOnSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  epsilon = EPSILON
): boolean {
  const cross = (px - x1) * (y2 - y1) - (py - y1) * (x2 - x1);
  if (Math.abs(cross) > epsilon) {
    return false;
  }
  const dot = (px - x1) * (px - x2) + (py - y1) * (py - y2);
  return dot <= epsilon;
}

function findContainingFace(mesh: Mesh, x: number, y: number): Face | null {
  for (const face of mesh.faces) {
    if (face.isOuter) {
      continue;
    }
    const polygon = mesh.faceVertices(face).map((vertex) => ({
      x: vertex.position.x,
      y: vertex.position.y
    }));
    if (polygon.length < 3) {
      continue;
    }
    if (pointInPolygon(x, y, polygon)) {
      return face;
    }
  }
  return null;
}

function isBoundaryPoint(mesh: Mesh, x: number, y: number): boolean {
  for (const edge of mesh.uniqueUndirectedEdges()) {
    const origin = edge.origin;
    const destination = edge.destination();
    if (origin === null || destination === null) {
      continue;
    }
    if (
      pointOnSegment(
        x,
        y,
        origin.position.x,
        origin.position.y,
        destination.position.x,
        destination.position.y
      )
    ) {
      return true;
    }
  }
  return false;
}

function probeFaceByUpperEdge(
  mesh: Mesh,
  slab: SlabRecord,
  yMin: number,
  yMax: number
): Map<number | null, number | null> {
  const segmentYs = slab.segments.map((segment) => yAtX(segment, slab.sampleX));
  const faceByUpperEdge = new Map<number | null, number | null>();

  for (let band = 0; band <= slab.segments.length; band += 1) {
    const yProbe =
      band === 0
        ? yMin - 1
        : band === slab.segments.length
          ? yMax + 1
          : (segmentYs[band - 1]! + segmentYs[band]!) / 2;
    const face = findContainingFace(mesh, slab.sampleX, yProbe);
    const upperEdgeId = band < slab.segments.length ? slab.segments[band]!.edgeId : null;
    faceByUpperEdge.set(upperEdgeId, face ? face.id : mesh.outerFace?.id ?? null);
  }

  return faceByUpperEdge;
}

export function buildPointLocationIndex(mesh: Mesh): PointLocationIndex {
  return buildPointLocationIndexWithTrace(mesh).index;
}

export function buildPointLocationIndexWithTrace(mesh: Mesh): PointLocationBuildResult {
  const slabResult = buildSlabIndexWithTrace(mesh);
  const slabIndex = slabResult.index;
  const bbox = mesh.boundingBox();
  if (bbox === null) {
    throw new Error("Cannot build point-location index for empty mesh");
  }

  const [, max] = bbox;
  const [min] = bbox;
  const faceByUpperEdgeBySlab = new Map<string, Map<number | null, number | null>>();
  for (const slab of slabIndex.slabs) {
    const facesByUpperEdge = probeFaceByUpperEdge(mesh, slab, min.y, max.y);
    faceByUpperEdgeBySlab.set(slab.name, facesByUpperEdge);
  }

  return {
    index: { slabIndex, faceByUpperEdgeBySlab },
    trace: {
      slabSteps: slabResult.steps
    }
  };
}

function locateBandTreeSearch(
  index: PointLocationIndex,
  slab: SlabRecord,
  x: number,
  y: number,
  onStep?: (step: BandBinarySearchTraceStep) => void
): number | null {
  const upper = index.slabIndex.segmentTree.searchFirstGreaterOrEqual(
    (node) => y - yAtX(node.value, x),
    slab.version,
    (step) => {
      const segmentY = yAtX(step.node.value, x);
      onStep?.({
        kind: "band-search-step",
        slabName: slab.name,
        segmentEdgeId: step.node.value.edgeId,
        queryX: x,
        queryY: y,
        segmentY,
        candidateEdgeId: step.candidate?.value.edgeId ?? null,
        direction: step.direction === "left" ? "lower" : "higher"
      });
    }
  );

  return upper?.value.edgeId ?? null;
}

export function locatePoint(mesh: Mesh, index: PointLocationIndex, point: QueryPoint): PointLocationResult {
  return traceLocatePoint(mesh, index, point).result;
}

export function traceLocatePoint(mesh: Mesh, index: PointLocationIndex, point: QueryPoint): PointLocationTraceResult {
  const pointName = point.name ?? "query";
  const events: QueryTraceEvent[] = [];
  const boundary = isBoundaryPoint(mesh, point.x, point.y);
  events.push({
    kind: "boundary-check",
    pointName,
    isBoundary: boundary
  });

  if (boundary) {
    const result: PointLocationResult = {
      slabName: "boundary",
      faceId: null,
      faceName: "boundary",
      classification: "boundary"
    };
    events.push({
      kind: "face-resolved",
      pointName,
      slabName: "boundary",
      faceId: null,
      faceName: "boundary",
      classification: "boundary"
    });
    return { result, events };
  }

  const slabNode = index.slabIndex.slabTree.searchLETrace(point.x, (step) => {
    const slab = step.node.value;
    events.push({
      kind: "slab-search-step",
      queryX: point.x,
      comparedSlabName: slab.name,
      comparedStart: slab.start,
      direction: step.direction,
      candidateSlabName: step.candidate?.value.name ?? null,
      candidateSlabStart: step.candidate?.value.start ?? null
    });
  });
  const slab = slabNode?.value ?? index.slabIndex.slabs[0];
  if (!slab) {
    const result: PointLocationResult = {
      slabName: "none",
      faceId: mesh.outerFace?.id ?? null,
      faceName: "outerFace",
      classification: "outer"
    };
    events.push({
      kind: "face-resolved",
      pointName,
      slabName: "none",
      faceId: result.faceId,
      faceName: result.faceName,
      classification: "outer"
    });
    return { result, events };
  }

  events.push({
    kind: "slab-selected",
    pointName,
    slabName: slab.name,
    slabVersion: slab.version
  });

  const upperEdgeId = locateBandTreeSearch(index, slab, point.x, point.y, (step) => {
    events.push(step);
  });
  events.push({
    kind: "band-selected",
    pointName,
    slabName: slab.name,
    segmentEdgeId: upperEdgeId
  });

  const faceId = index.faceByUpperEdgeBySlab.get(slab.name)?.get(upperEdgeId) ?? mesh.outerFace?.id ?? null;
  const face = faceId !== null ? mesh.faces[faceId] ?? null : null;

  if (face === null || face.isOuter) {
    const result: PointLocationResult = {
      slabName: slab.name,
      faceId,
      faceName: "outerFace",
      classification: "outer"
    };
    events.push({
      kind: "face-resolved",
      pointName,
      slabName: slab.name,
      faceId,
      faceName: "outerFace",
      classification: "outer"
    });
    return { result, events };
  }

  const result: PointLocationResult = {
    slabName: slab.name,
    faceId: face.id,
    faceName: `F${face.id}`,
    classification: "inside"
  };
  events.push({
    kind: "face-resolved",
    pointName,
    slabName: slab.name,
    faceId: face.id,
    faceName: `F${face.id}`,
    classification: "inside"
  });
  return { result, events };
}
