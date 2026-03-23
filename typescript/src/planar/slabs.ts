import { BinarySearchTree } from "../bst/binary-search-tree.js";
import { HalfEdge, Mesh } from "../mesh/mesh.js";
import { PartialPersistentBinarySearchTree } from "../persistent/partial-persistent-bst.js";

export interface SegmentKey {
  readonly y: number;
  readonly tie: number;
}

export interface ActiveSegment {
  readonly id: number;
  readonly edgeId: number;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly key: SegmentKey;
}

export interface SlabRecord {
  readonly name: string;
  readonly start: number;
  readonly end: number;
  readonly sampleX: number;
  readonly version: number;
  readonly segments: ActiveSegment[];
}

function compareSegmentKeys(a: SegmentKey, b: SegmentKey): number {
  if (a.y < b.y) {
    return -1;
  }
  if (a.y > b.y) {
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

function segmentFromHalfEdge(edge: HalfEdge, sampleX: number): ActiveSegment | null {
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

  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  if (!(sampleX > minX && sampleX < maxX)) {
    return null;
  }

  const y = yAtX({ x1, y1, x2, y2 }, sampleX);
  return {
    id: edge.id,
    edgeId: edge.id,
    x1,
    y1,
    x2,
    y2,
    key: { y, tie: edge.id }
  };
}

function collectSlabStarts(mesh: Mesh): number[] {
  const xs = mesh.vertices.map((vertex) => vertex.position.x);
  const unique = Array.from(new Set(xs)).sort((a, b) => a - b);
  return unique;
}

export interface SlabIndex {
  readonly slabs: SlabRecord[];
  readonly slabTree: BinarySearchTree<SlabRecord, number>;
  readonly segmentTree: PartialPersistentBinarySearchTree<ActiveSegment, SegmentKey>;
}

export function buildSlabIndex(mesh: Mesh): SlabIndex {
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

  const slabs: SlabRecord[] = [];
  let previousKeys: SegmentKey[] = [];
  const graphEdges = mesh.uniqueUndirectedEdges();

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

    const activeSegments = graphEdges
      .map((edge) => segmentFromHalfEdge(edge, sampleX))
      .filter((segment): segment is ActiveSegment => segment !== null)
      .sort((a, b) => compareSegmentKeys(a.key, b.key));

    if (previousKeys.length > 0) {
      segmentTree.delete(previousKeys);
    }
    if (activeSegments.length > 0) {
      segmentTree.insert(activeSegments);
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
    slabTree.insert(slab);
    previousKeys = snapshotSegments.map((segment) => segment.key);
  }

  return { slabs, slabTree, segmentTree };
}

export { compareSegmentKeys, yAtX };
