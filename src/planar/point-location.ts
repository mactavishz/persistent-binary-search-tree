import { HalfEdge, Mesh } from "../mesh/mesh.js";
import { buildSlabIndexWithTrace, yAtX } from "./slabs.js";
import type { SlabIndex, SlabRecord } from "./slabs.js";
import type { BandBinarySearchTraceStep, QueryTraceEvent } from "./trace-types.js";

// Tolerance for geometric predicates used in point-on-segment and boundary x matching.
const EPSILON = 1e-7;

interface EdgeGeometry {
  readonly edgeId: number;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

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
  readonly faceByUpperEdge: Map<number | null, number | null>;
  readonly edgeGeometryById: Map<number, EdgeGeometry>;
  readonly boundaryXValues: number[];
  readonly boundaryEdgeIdsByX: Map<number, number[]>;
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

function edgeGeometryFromHalfEdge(edge: HalfEdge): EdgeGeometry | null {
  const origin = edge.origin;
  const destination = edge.destination();
  if (origin === null || destination === null) {
    return null;
  }

  return {
    edgeId: edge.id,
    x1: origin.position.x,
    y1: origin.position.y,
    x2: destination.position.x,
    y2: destination.position.y
  };
}

function addBoundaryEdge(map: Map<number, number[]>, x: number, edgeId: number): void {
  const current = map.get(x);
  if (current) {
    current.push(edgeId);
  } else {
    map.set(x, [edgeId]);
  }
}

function faceBelowEdge(mesh: Mesh, edge: HalfEdge): number | null {
  const origin = edge.origin;
  const destination = edge.destination();
  const fallback = mesh.outerFace?.id ?? null;
  if (origin === null || destination === null) {
    return fallback;
  }

  const dx = destination.position.x - origin.position.x;
  const leftFaceId = edge.face?.id ?? null;
  const rightFaceId = edge.twin?.face?.id ?? null;

  // We interpret "below" using edge direction. For left-to-right edges, the right face is below;
  // for right-to-left edges, the left face is below. Vertical edges keep either side as fallback.
  if (dx > 0) {
    return rightFaceId ?? leftFaceId ?? fallback;
  }
  if (dx < 0) {
    return leftFaceId ?? rightFaceId ?? fallback;
  }
  return leftFaceId ?? rightFaceId ?? fallback;
}

function nearestBoundaryX(boundaryXValues: readonly number[], x: number): number | null {
  if (boundaryXValues.length === 0) {
    return null;
  }

  let low = 0;
  let high = boundaryXValues.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (boundaryXValues[mid]! < x) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  const candidates: number[] = [];
  if (low < boundaryXValues.length) {
    candidates.push(boundaryXValues[low]!);
  }
  if (low > 0) {
    candidates.push(boundaryXValues[low - 1]!);
  }

  let best: number | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    // Match boundary lines with epsilon tolerance to absorb floating-point round-off.
    const delta = Math.abs(candidate - x);
    if (delta <= EPSILON && delta < bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }

  return best;
}

function isBoundaryOnEdge(index: PointLocationIndex, edgeId: number | null, x: number, y: number): boolean {
  if (edgeId === null) {
    return false;
  }
  const edge = index.edgeGeometryById.get(edgeId);
  if (!edge) {
    return false;
  }
  return pointOnSegment(x, y, edge.x1, edge.y1, edge.x2, edge.y2);
}

function isBoundaryOnBoundaryLine(index: PointLocationIndex, x: number, y: number): boolean {
  const boundaryX = nearestBoundaryX(index.boundaryXValues, x);
  if (boundaryX === null) {
    return false;
  }

  const edgeIds = index.boundaryEdgeIdsByX.get(boundaryX) ?? [];
  for (const edgeId of edgeIds) {
    const edge = index.edgeGeometryById.get(edgeId);
    if (!edge) {
      continue;
    }
    if (pointOnSegment(x, y, edge.x1, edge.y1, edge.x2, edge.y2)) {
      return true;
    }
  }

  return false;
}

function buildEdgeIndexes(mesh: Mesh): {
  readonly edgeGeometryById: Map<number, EdgeGeometry>;
  readonly boundaryXValues: number[];
  readonly boundaryEdgeIdsByX: Map<number, number[]>;
  readonly faceByUpperEdge: Map<number | null, number | null>;
} {
  const edgeGeometryById = new Map<number, EdgeGeometry>();
  const boundaryEdgeIdsByX = new Map<number, number[]>();
  const faceByUpperEdge = new Map<number | null, number | null>();
  const outerFaceId = mesh.outerFace?.id ?? null;

  for (const edge of mesh.uniqueUndirectedEdges()) {
    const geometry = edgeGeometryFromHalfEdge(edge);
    if (!geometry) {
      continue;
    }

    edgeGeometryById.set(edge.id, geometry);
    addBoundaryEdge(boundaryEdgeIdsByX, geometry.x1, edge.id);
    addBoundaryEdge(boundaryEdgeIdsByX, geometry.x2, edge.id);
    faceByUpperEdge.set(edge.id, faceBelowEdge(mesh, edge));
  }

  faceByUpperEdge.set(null, outerFaceId);

  const boundaryXValues = Array.from(boundaryEdgeIdsByX.keys()).sort((a, b) => a - b);
  return {
    edgeGeometryById,
    boundaryXValues,
    boundaryEdgeIdsByX,
    faceByUpperEdge
  };
}

export function buildPointLocationIndex(mesh: Mesh): PointLocationIndex {
  return buildPointLocationIndexWithTrace(mesh).index;
}

export function buildPointLocationIndexWithTrace(mesh: Mesh): PointLocationBuildResult {
  const slabResult = buildSlabIndexWithTrace(mesh);
  const slabIndex = slabResult.index;
  const {
    edgeGeometryById,
    boundaryXValues,
    boundaryEdgeIdsByX,
    faceByUpperEdge
  } = buildEdgeIndexes(mesh);

  return {
    index: {
      slabIndex,
      // The edge->face relation is topology-based and independent of slab partitioning.
      faceByUpperEdge,
      edgeGeometryById,
      boundaryXValues,
      boundaryEdgeIdsByX
    },
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
        slabVersion: slab.version,
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

function pushFaceResolvedEvent(
  events: QueryTraceEvent[],
  params: {
    readonly pointName: string;
    readonly slabVersion: number | null;
    readonly faceId: number | null;
    readonly classification: "inside" | "outer" | "boundary";
  }
): void {
  events.push({
    kind: "face-resolved",
    pointName: params.pointName,
    slabVersion: params.slabVersion,
    faceId: params.faceId,
    classification: params.classification
  });
}

function pushBoundaryCheckEvent(events: QueryTraceEvent[], pointName: string, isBoundary: boolean): void {
  events.push({
    kind: "boundary-check",
    pointName,
    isBoundary
  });
}

function findSlabForQuery(index: PointLocationIndex, queryX: number, events: QueryTraceEvent[]): SlabRecord | null {
  const slabNode = index.slabIndex.slabTree.searchLETrace(queryX, (step) => {
    const slab = step.node.value;
    events.push({
      kind: "slab-search-step",
      queryX,
      comparedSlabStart: slab.start,
      comparedSlabEnd: slab.end,
      direction: step.direction,
      candidateSlabStart: step.candidate?.value.start ?? null
    });
  });

  return slabNode?.value ?? index.slabIndex.slabs[0] ?? null;
}

function resolveFaceForSelection(
  mesh: Mesh,
  index: PointLocationIndex,
  slabName: string,
  upperEdgeId: number | null
): PointLocationResult {
  const faceId = index.faceByUpperEdge.get(upperEdgeId) ?? mesh.outerFace?.id ?? null;
  const face = faceId !== null ? mesh.faces[faceId] ?? null : null;

  if (face === null || face.isOuter) {
    return {
      slabName,
      faceId,
      faceName: "outerFace",
      classification: "outer"
    };
  }

  return {
    slabName,
    faceId: face.id,
    faceName: `F${face.id}`,
    classification: "inside"
  };
}

function boundaryResult(
  pointName: string,
  slabName: string,
  slabVersion: number | null,
  events: QueryTraceEvent[]
): PointLocationTraceResult {
  const result: PointLocationResult = {
    slabName,
    faceId: null,
    faceName: "boundary",
    classification: "boundary"
  };
  pushFaceResolvedEvent(events, {
    pointName,
    slabVersion,
    faceId: null,
    classification: "boundary"
  });
  return { result, events };
}

export function locatePoint(mesh: Mesh, index: PointLocationIndex, point: QueryPoint): PointLocationResult {
  return traceLocatePoint(mesh, index, point).result;
}

export function traceLocatePoint(mesh: Mesh, index: PointLocationIndex, point: QueryPoint): PointLocationTraceResult {
  const pointName = point.name ?? "query";
  const events: QueryTraceEvent[] = [];

  // Query pipeline: locate slab by x, run boundary checks, locate upper edge by y, then resolve face.
  const slab = findSlabForQuery(index, point.x, events);
  if (!slab) {
    pushBoundaryCheckEvent(events, pointName, false);

    const result: PointLocationResult = {
      slabName: "none",
      faceId: mesh.outerFace?.id ?? null,
      faceName: "outerFace",
      classification: "outer"
    };
    pushFaceResolvedEvent(events, {
      pointName,
      slabVersion: null,
      faceId: result.faceId,
      classification: "outer"
    });
    return { result, events };
  }

  events.push({
    kind: "slab-selected",
    pointName,
    slabVersion: slab.version
  });

  // Fast boundary-line pass avoids unnecessary tree lookups for obvious boundary points.
  if (isBoundaryOnBoundaryLine(index, point.x, point.y)) {
    pushBoundaryCheckEvent(events, pointName, true);
    return boundaryResult(pointName, slab.name, slab.version, events);
  }

  const upperEdgeId = locateBandTreeSearch(index, slab, point.x, point.y, (step) => {
    events.push(step);
  });

  const boundary = isBoundaryOnEdge(index, upperEdgeId, point.x, point.y);
  pushBoundaryCheckEvent(events, pointName, boundary);

  if (boundary) {
    return boundaryResult(pointName, slab.name, slab.version, events);
  }

  events.push({
    kind: "band-selected",
    pointName,
    slabVersion: slab.version,
    segmentEdgeId: upperEdgeId
  });

  const result = resolveFaceForSelection(mesh, index, slab.name, upperEdgeId);
  pushFaceResolvedEvent(events, {
    pointName,
    slabVersion: slab.version,
    faceId: result.faceId,
    classification: result.classification
  });
  return { result, events };
}
