import { Face, Mesh } from "../mesh/mesh.js";
import { buildSlabIndex, yAtX } from "./slabs.js";
import type { SlabIndex, SlabRecord } from "./slabs.js";

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
  readonly faceBandsBySlab: Map<string, Array<number | null>>;
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

function probeBandFaces(mesh: Mesh, slab: SlabRecord, yMin: number, yMax: number): Array<number | null> {
  const segmentYs = slab.segments.map((segment) => yAtX(segment, slab.sampleX));
  const bands: Array<number | null> = [];

  for (let band = 0; band <= slab.segments.length; band += 1) {
    const yProbe =
      band === 0
        ? yMin - 1
        : band === slab.segments.length
          ? yMax + 1
          : (segmentYs[band - 1]! + segmentYs[band]!) / 2;
    const face = findContainingFace(mesh, slab.sampleX, yProbe);
    bands.push(face ? face.id : mesh.outerFace?.id ?? null);
  }

  return bands;
}

export function buildPointLocationIndex(mesh: Mesh): PointLocationIndex {
  const slabIndex = buildSlabIndex(mesh);
  const bbox = mesh.boundingBox();
  if (bbox === null) {
    throw new Error("Cannot build point-location index for empty mesh");
  }

  const [, max] = bbox;
  const [min] = bbox;
  const faceBandsBySlab = new Map<string, Array<number | null>>();
  for (const slab of slabIndex.slabs) {
    const bands = probeBandFaces(mesh, slab, min.y, max.y);
    faceBandsBySlab.set(slab.name, bands);
  }

  return { slabIndex, faceBandsBySlab };
}

function locateBand(slab: SlabRecord, x: number, y: number): number {
  for (let i = 0; i < slab.segments.length; i += 1) {
    const segmentY = yAtX(slab.segments[i]!, x);
    if (y <= segmentY + EPSILON) {
      return i;
    }
  }
  return slab.segments.length;
}

export function locatePoint(mesh: Mesh, index: PointLocationIndex, point: QueryPoint): PointLocationResult {
  if (isBoundaryPoint(mesh, point.x, point.y)) {
    return {
      slabName: "boundary",
      faceId: null,
      faceName: "boundary",
      classification: "boundary"
    };
  }

  const slabNode = index.slabIndex.slabTree.searchLE(point.x);
  const slab = slabNode?.value ?? index.slabIndex.slabs[0];
  if (!slab) {
    return {
      slabName: "none",
      faceId: mesh.outerFace?.id ?? null,
      faceName: "outerFace",
      classification: "outer"
    };
  }

  const band = locateBand(slab, point.x, point.y);
  const faceId = index.faceBandsBySlab.get(slab.name)?.[band] ?? mesh.outerFace?.id ?? null;
  const face = faceId !== null ? mesh.faces[faceId] ?? null : null;

  if (face === null || face.isOuter) {
    return {
      slabName: slab.name,
      faceId,
      faceName: "outerFace",
      classification: "outer"
    };
  }

  return {
    slabName: slab.name,
    faceId: face.id,
    faceName: `F${face.id}`,
    classification: "inside"
  };
}
