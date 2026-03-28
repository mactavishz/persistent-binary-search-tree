import { BinarySearchTree } from "../bst/binary-search-tree.js";
import { HalfEdge, Mesh } from "../mesh/mesh.js";
import { PartialPersistentBinarySearchTree } from "../persistent/partial-persistent-bst.js";
import type { SlabBuildTraceStep } from "./trace-types.js";

export interface SegmentKey {
  readonly order: number;
  readonly tie: number;
}

export interface ActiveSegment {
  readonly id: number;
  readonly edgeId: number;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  key: SegmentKey;
}

export interface SlabRecord {
  readonly name: string;
  readonly start: number;
  readonly end: number;
  readonly sampleX: number;
  readonly version: number;
  readonly segments: ActiveSegment[];
}

interface SegmentGeometry {
  readonly edgeId: number;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly minX: number;
  readonly maxX: number;
}

const LABEL_STEP = 1024;
const MIN_LABEL_GAP = 1e-6;

function compareSegmentKeys(a: SegmentKey, b: SegmentKey): number {
  if (a.order < b.order) {
    return -1;
  }
  if (a.order > b.order) {
    return 1;
  }
  if (a.tie < b.tie) {
    return -1;
  }
  if (a.tie > b.tie) {
    return 1;
  }
  return 0;
}

function yAtX(segment: Pick<ActiveSegment, "x1" | "y1" | "x2" | "y2">, x: number): number {
  if (segment.x1 === segment.x2) {
    return Math.min(segment.y1, segment.y2);
  }
  const t = (x - segment.x1) / (segment.x2 - segment.x1);
  return segment.y1 + t * (segment.y2 - segment.y1);
}

function compareSegmentsAtX(
  a: Pick<ActiveSegment, "x1" | "y1" | "x2" | "y2" | "edgeId">,
  b: Pick<ActiveSegment, "x1" | "y1" | "x2" | "y2" | "edgeId">,
  x: number
): number {
  const ay = yAtX(a, x);
  const by = yAtX(b, x);
  if (ay < by) {
    return -1;
  }
  if (ay > by) {
    return 1;
  }
  return a.edgeId - b.edgeId;
}

function segmentGeometryFromHalfEdge(edge: HalfEdge): SegmentGeometry | null {
  const origin = edge.origin;
  const destination = edge.twin?.origin ?? edge.destination();
  if (origin === null || destination === null) {
    return null;
  }

  const x1 = origin.position.x;
  const y1 = origin.position.y;
  const x2 = destination.position.x;
  const y2 = destination.position.y;

  if (x1 === x2) {
    return null;
  }

  return {
    edgeId: edge.id,
    x1,
    y1,
    x2,
    y2,
    minX: Math.min(x1, x2),
    maxX: Math.max(x1, x2)
  };
}

function segmentFromGeometry(geometry: SegmentGeometry, order: number): ActiveSegment {
  return {
    id: geometry.edgeId,
    edgeId: geometry.edgeId,
    x1: geometry.x1,
    y1: geometry.y1,
    x2: geometry.x2,
    y2: geometry.y2,
    key: {
      order,
      tie: geometry.edgeId
    }
  };
}

function addToEventMap(map: Map<number, SegmentGeometry[]>, x: number, segment: SegmentGeometry): void {
  const bucket = map.get(x);
  if (bucket) {
    bucket.push(segment);
  } else {
    map.set(x, [segment]);
  }
}

function collectSlabStarts(mesh: Mesh): number[] {
  const xs = mesh.vertices.map((vertex) => vertex.position.x);
  return Array.from(new Set(xs)).sort((a, b) => a - b);
}

function sortSegmentsByYAtX(segments: ActiveSegment[], x: number): void {
  segments.sort((a, b) => compareSegmentsAtX(a, b, x));
}

function mergeActiveSegmentsByY(
  active: readonly ActiveSegment[],
  entering: readonly ActiveSegment[],
  sampleX: number
): ActiveSegment[] {
  const merged: ActiveSegment[] = [];
  let i = 0;
  let j = 0;

  while (i < active.length && j < entering.length) {
    const keep = active[i]!;
    const add = entering[j]!;
    if (compareSegmentsAtX(keep, add, sampleX) <= 0) {
      merged.push(keep);
      i += 1;
    } else {
      merged.push(add);
      j += 1;
    }
  }

  while (i < active.length) {
    merged.push(active[i]!);
    i += 1;
  }
  while (j < entering.length) {
    merged.push(entering[j]!);
    j += 1;
  }

  return merged;
}

function assignLabelsToNewSegments(segments: ActiveSegment[]): boolean {
  let i = 0;
  while (i < segments.length) {
    if (Number.isFinite(segments[i]!.key.order)) {
      i += 1;
      continue;
    }

    const runStart = i;
    while (i < segments.length && !Number.isFinite(segments[i]!.key.order)) {
      i += 1;
    }
    const runEnd = i;
    const runCount = runEnd - runStart;

    const leftOrder = runStart > 0 ? segments[runStart - 1]!.key.order : null;
    const rightOrder = runEnd < segments.length ? segments[runEnd]!.key.order : null;

    if (leftOrder === null && rightOrder === null) {
      for (let k = 0; k < runCount; k += 1) {
        const segment = segments[runStart + k]!;
        segment.key = {
          order: (k + 1) * LABEL_STEP,
          tie: segment.edgeId
        };
      }
      continue;
    }

    if (leftOrder === null && rightOrder !== null) {
      for (let k = 0; k < runCount; k += 1) {
        const segment = segments[runStart + k]!;
        segment.key = {
          order: rightOrder - LABEL_STEP * (runCount - k),
          tie: segment.edgeId
        };
      }
      continue;
    }

    if (leftOrder !== null && rightOrder === null) {
      for (let k = 0; k < runCount; k += 1) {
        const segment = segments[runStart + k]!;
        segment.key = {
          order: leftOrder + LABEL_STEP * (k + 1),
          tie: segment.edgeId
        };
      }
      continue;
    }

    const span = (rightOrder ?? 0) - (leftOrder ?? 0);
    const step = span / (runCount + 1);
    if (!(step > MIN_LABEL_GAP)) {
      return false;
    }

    for (let k = 0; k < runCount; k += 1) {
      const segment = segments[runStart + k]!;
      segment.key = {
        order: (leftOrder ?? 0) + step * (k + 1),
        tie: segment.edgeId
      };
    }
  }

  return true;
}

function relabelAllSegments(segments: ActiveSegment[]): void {
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i]!;
    segment.key = {
      order: (i + 1) * LABEL_STEP,
      tie: segment.edgeId
    };
  }
}

function toBalancedInsertionOrder<T>(values: readonly T[]): T[] {
  const ordered: T[] = [];

  const collect = (start: number, end: number): void => {
    if (start >= end) {
      return;
    }
    const mid = Math.floor((start + end) / 2);
    ordered.push(values[mid]!);
    collect(start, mid);
    collect(mid + 1, end);
  };

  collect(0, values.length);
  return ordered;
}

export interface SlabIndex {
  readonly slabs: SlabRecord[];
  readonly slabTree: BinarySearchTree<SlabRecord, number>;
  readonly segmentTree: PartialPersistentBinarySearchTree<ActiveSegment, SegmentKey>;
}

function insertBalancedSlabs(tree: BinarySearchTree<SlabRecord, number>, slabs: readonly SlabRecord[]): void {
  const insertRange = (start: number, end: number): void => {
    if (start >= end) {
      return;
    }
    const mid = Math.floor((start + end) / 2);
    tree.insert(slabs[mid]!);
    insertRange(start, mid);
    insertRange(mid + 1, end);
  };

  insertRange(0, slabs.length);
}

function isActiveAtX(segment: SegmentGeometry, sampleX: number): boolean {
  return sampleX > segment.minX && sampleX < segment.maxX;
}

export function buildSlabIndex(mesh: Mesh): SlabIndex {
  return buildSlabIndexWithTrace(mesh).index;
}

export function buildSlabIndexWithTrace(mesh: Mesh): {
  readonly index: SlabIndex;
  readonly steps: SlabBuildTraceStep[];
} {
  const bbox = mesh.boundingBox();
  if (bbox === null) {
    throw new Error("Cannot build slabs for an empty mesh");
  }

  const [min, max] = bbox;
  const starts = collectSlabStarts(mesh);
  const padding = Math.max(1, (max.x - min.x) * 0.25);
  const boundaries = [-Infinity, ...starts, Infinity];

  const slabTree = new BinarySearchTree<SlabRecord, number>({
    keyOf: (slab) => slab.start,
    compare: (a, b) => a - b
  });

  const segmentTree = new PartialPersistentBinarySearchTree<ActiveSegment, SegmentKey>({
    keyOf: (segment) => segment.key,
    compare: compareSegmentKeys
  });

  const segmentGeometries = mesh
    .uniqueUndirectedEdges()
    .map((edge) => segmentGeometryFromHalfEdge(edge))
    .filter((segment): segment is SegmentGeometry => segment !== null);

  const enterEvents = new Map<number, SegmentGeometry[]>();
  const leaveEvents = new Map<number, SegmentGeometry[]>();
  for (const segment of segmentGeometries) {
    addToEventMap(enterEvents, segment.minX, segment);
    addToEventMap(leaveEvents, segment.maxX, segment);
  }

  const slabs: SlabRecord[] = [];
  const steps: SlabBuildTraceStep[] = [];
  let activeSegments: ActiveSegment[] = [];
  const activeByEdgeId = new Map<number, ActiveSegment>();

  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const start = boundaries[i]!;
    const end = boundaries[i + 1]!;

    const sampleX =
      Number.isFinite(start) && Number.isFinite(end)
        ? (start + end) / 2
        : Number.isFinite(start)
          ? start + padding
          : Number.isFinite(end)
            ? end - padding
            : min.x;

    const leftEdgeIds: number[] = [];
    const enteredEdgeIds: number[] = [];

    if (Number.isFinite(start)) {
      const leaving = leaveEvents.get(start) ?? [];
      const removedKeys: SegmentKey[] = [];
      for (const segment of leaving) {
        const active = activeByEdgeId.get(segment.edgeId);
        if (!active) {
          continue;
        }
        leftEdgeIds.push(segment.edgeId);
        removedKeys.push(active.key);
      }

      if (removedKeys.length > 0) {
        segmentTree.delete(removedKeys);
        const leftSet = new Set(leftEdgeIds);
        activeSegments = activeSegments.filter((segment) => !leftSet.has(segment.edgeId));
        for (const edgeId of leftEdgeIds) {
          activeByEdgeId.delete(edgeId);
        }
      }

      const entering = (enterEvents.get(start) ?? [])
        .filter((segment) => isActiveAtX(segment, sampleX))
        .map((segment) => segmentFromGeometry(segment, Number.NaN));

      if (entering.length > 0) {
        sortSegmentsByYAtX(entering, sampleX);
        const merged = mergeActiveSegmentsByY(activeSegments, entering, sampleX);
        const survivorKeys = activeSegments.map((segment) => segment.key);

        if (!assignLabelsToNewSegments(merged)) {
          // Rare fallback when nearby insertions exhaust numeric label gaps.
          relabelAllSegments(merged);
          if (survivorKeys.length > 0) {
            segmentTree.delete(survivorKeys);
          }
          segmentTree.insert(toBalancedInsertionOrder(merged));
        } else {
          segmentTree.insert(toBalancedInsertionOrder(entering));
        }

        for (const segment of entering) {
          enteredEdgeIds.push(segment.edgeId);
        }
        activeSegments = merged;
      }
    }

    const version = segmentTree.getLatestVersion();
    const snapshot = segmentTree.snapshot(version);
    const snapshotSegments = (snapshot?.nodes ?? [])
      .map((node) => node.value)
      .sort((a, b) => compareSegmentKeys(a.key, b.key));

    const slab: SlabRecord = {
      name: `s${i}`,
      start,
      end,
      sampleX,
      version,
      segments: snapshotSegments
    };

    slabs.push(slab);
    const activeEdgeIds = Array.from(new Set(snapshotSegments.map((segment) => segment.edgeId)));
    steps.push({
      kind: "slab-built",
      slab,
      enteredEdgeIds,
      leftEdgeIds,
      activeEdgeIds,
      snapshot
    });

    activeSegments = snapshotSegments;
    activeByEdgeId.clear();
    for (const segment of activeSegments) {
      activeByEdgeId.set(segment.edgeId, segment);
    }
  }

  insertBalancedSlabs(slabTree, slabs);

  return {
    index: { slabs, slabTree, segmentTree },
    steps
  };
}

export { compareSegmentKeys, yAtX };
