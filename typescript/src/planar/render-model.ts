import { Face, Mesh } from "../mesh/mesh.js";

export interface RenderVertex {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly label: string;
}

export interface RenderHalfEdge {
  readonly id: number;
  readonly source: number;
  readonly target: number;
  readonly twinId: number | null;
}

export interface RenderFace {
  readonly id: number;
  readonly isOuter: boolean;
  readonly label: string;
  readonly vertices: ReadonlyArray<{ x: number; y: number }>;
  readonly centroid: { x: number; y: number };
}

export interface GraphRenderModel {
  readonly vertices: RenderVertex[];
  readonly halfEdges: RenderHalfEdge[];
  readonly faces: RenderFace[];
  readonly bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

function centroid(points: ReadonlyArray<{ x: number; y: number }>): { x: number; y: number } {
  const count = points.length;
  if (count === 0) {
    return { x: 0, y: 0 };
  }
  let sx = 0;
  let sy = 0;
  for (const point of points) {
    sx += point.x;
    sy += point.y;
  }
  return { x: sx / count, y: sy / count };
}

function toRenderFace(mesh: Mesh, face: Face): RenderFace {
  const vertices = mesh.faceVertices(face).map((vertex) => ({
    x: vertex.position.x,
    y: vertex.position.y
  }));
  return {
    id: face.id,
    isOuter: face.isOuter,
    label: face.isOuter ? "Outer" : `F${face.id}`,
    vertices,
    centroid: centroid(vertices)
  };
}

export function meshToRenderModel(mesh: Mesh): GraphRenderModel {
  const bbox = mesh.boundingBox();
  if (bbox === null) {
    return {
      vertices: [],
      halfEdges: [],
      faces: [],
      bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 }
    };
  }

  const [min, max] = bbox;

  return {
    vertices: mesh.vertices.map((vertex) => ({
      id: vertex.id,
      x: vertex.position.x,
      y: vertex.position.y,
      label: `v${vertex.id}`
    })),
    halfEdges: mesh.edges.map((edge) => {
      const source = edge.origin?.id;
      const target = edge.destination()?.id;
      if (source === undefined || target === undefined) {
        throw new Error(`Half-edge ${edge.id} is missing source or target`);
      }
      return {
        id: edge.id,
        source,
        target,
        twinId: edge.twin?.id ?? null
      };
    }),
    faces: mesh.faces.map((face) => toRenderFace(mesh, face)),
    bounds: {
      minX: min.x,
      maxX: max.x,
      minY: min.y,
      maxY: max.y
    }
  };
}
