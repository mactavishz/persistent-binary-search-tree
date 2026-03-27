import { Vec3 } from "../vec/vec.js";

type VecLike3 = readonly [number, number, number] | readonly number[];

function edgeKey(originId: number, destinationId: number): string {
  return `${originId},${destinationId}`;
}

export class Vertex {
  readonly id: number;
  position: Vec3;
  halfEdge: HalfEdge | null = null;

  constructor(id: number, x: number, y: number, z: number) {
    this.id = id;
    this.position = new Vec3(x, y, z);
  }

  setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
  }

  cloneShallow(): Vertex {
    return new Vertex(this.id, this.position.x, this.position.y, this.position.z);
  }
}

export class Face {
  readonly id: number;
  halfEdge: HalfEdge | null = null;
  readonly isOuter: boolean;

  constructor(id: number, isOuter = false) {
    this.id = id;
    this.isOuter = isOuter;
  }

  cloneShallow(): Face {
    return new Face(this.id, this.isOuter);
  }
}

export class HalfEdge {
  readonly id: number;
  origin: Vertex | null = null;
  twin: HalfEdge | null = null;
  prev: HalfEdge | null = null;
  next: HalfEdge | null = null;
  face: Face | null = null;

  constructor(id: number) {
    this.id = id;
  }

  destination(): Vertex | null {
    return this.next?.origin ?? this.twin?.origin ?? null;
  }

  cloneShallow(): HalfEdge {
    return new HalfEdge(this.id);
  }
}

export interface MeshValidationIssue {
  readonly type: string;
  readonly message: string;
}

export class Mesh {
  readonly vertices: Vertex[] = [];
  readonly edges: HalfEdge[] = [];
  readonly faces: Face[] = [];
  readonly normals: Vec3[] = [];

  outerFace: Face | null = null;

  private readonly edgeMap = new Map<string, HalfEdge>();

  clear(): void {
    this.vertices.length = 0;
    this.edges.length = 0;
    this.faces.length = 0;
    this.normals.length = 0;
    this.outerFace = null;
    this.edgeMap.clear();
  }

  addVertexPos(x: number, y: number, z: number, id = this.vertices.length): Vertex {
    const vertex = new Vertex(id, x, y, z);
    this.vertices.push(vertex);
    return vertex;
  }

  addFace(isOuter = false): Face {
    const face = new Face(this.faces.length, isOuter);
    this.faces.push(face);
    return face;
  }

  addHalfEdge(): HalfEdge {
    const edge = new HalfEdge(this.edges.length);
    this.edges.push(edge);
    return edge;
  }

  findHalfEdge(origin: Vertex, destination: Vertex): HalfEdge | null {
    return this.edgeMap.get(edgeKey(origin.id, destination.id)) ?? null;
  }

  addEdge(origin: Vertex, destination: Vertex): HalfEdge {
    const key = edgeKey(origin.id, destination.id);
    if (this.edgeMap.has(key)) {
      throw new Error(`Duplicate half-edge between v${origin.id} and v${destination.id}`);
    }

    const edge = this.addHalfEdge();
    edge.origin = origin;
    this.edgeMap.set(key, edge);

    if (origin.halfEdge === null) {
      origin.halfEdge = edge;
    }

    const twin = this.edgeMap.get(edgeKey(destination.id, origin.id)) ?? null;
    if (twin !== null) {
      edge.twin = twin;
      twin.twin = edge;
    }

    return edge;
  }

  addFaceByVerts(vertices: readonly Vertex[]): Face {
    if (vertices.length < 3) {
      throw new Error("A face must have at least 3 vertices");
    }

    const edges: HalfEdge[] = [];
    for (let i = 0; i < vertices.length; i += 1) {
      const origin = vertices[i]!;
      const destination = vertices[(i + 1) % vertices.length]!;
      edges.push(this.addEdge(origin, destination));
    }

    return this.addFaceByHalfEdges(edges);
  }

  addFaceByVertexIndices(indices: readonly number[]): Face {
    const vertices = indices.map((index) => {
      const vertex = this.vertices[index];
      if (!vertex) {
        throw new Error(`Invalid vertex index ${index}`);
      }
      return vertex;
    });
    return this.addFaceByVerts(vertices);
  }

  buildMesh(
    verts: readonly VecLike3[],
    normals: readonly VecLike3[],
    faces: readonly (readonly number[])[]
  ): void {
    this.clear();

    verts.forEach((vertex, index) => {
      const [x = 0, y = 0, z = 0] = vertex;
      this.addVertexPos(x, y, z, index);
    });

    normals.forEach((normal) => {
      const [x = 0, y = 0, z = 0] = normal;
      this.normals.push(new Vec3(x, y, z));
    });

    faces.forEach((face) => {
      this.addFaceByVertexIndices(face);
    });

    this.finalizeBoundary();
  }

  private addFaceByHalfEdges(edges: readonly HalfEdge[]): Face {
    const face = this.addFace(false);
    face.halfEdge = edges[0] ?? null;

    const edgeCount = edges.length;
    for (let i = 0; i < edgeCount; i += 1) {
      const edge = edges[i]!;
      const next = edges[(i + 1) % edgeCount]!;
      const prev = edges[(i - 1 + edgeCount) % edgeCount]!;
      edge.face = face;
      edge.next = next;
      edge.prev = prev;
    }

    return face;
  }

  private finalizeBoundary(): void {
    const interiorEdges = [...this.edges];
    for (const edge of interiorEdges) {
      if (edge.twin !== null) {
        continue;
      }
      const next = edge.next;
      const origin = edge.origin;
      if (next === null || origin === null || next.origin === null) {
        throw new Error("Incomplete half-edge cycle while creating boundary edges");
      }
      this.addEdge(next.origin, origin);
    }

    for (const edge of this.edges) {
      if (edge.face !== null) {
        continue;
      }
      if (edge.next !== null) {
        continue;
      }

      const twin = edge.twin;
      if (twin === null) {
        throw new Error("Boundary edge missing twin");
      }

      let next = twin;
      do {
        const prev = next.prev;
        if (prev === null || prev.twin === null) {
          throw new Error("Cannot stitch boundary cycle due to missing links");
        }
        next = prev.twin;
      } while (next.face !== null);

      edge.next = next;
      next.prev = edge;
    }

    this.attachOuterFace();
  }

  private attachOuterFace(): void {
    const outer = this.addFace(true);
    this.outerFace = outer;

    for (const edge of this.edges) {
      if (edge.face !== null) {
        continue;
      }
      edge.face = outer;
      if (outer.halfEdge === null) {
        outer.halfEdge = edge;
      }
    }
  }

  faceHalfEdges(face: Face): HalfEdge[] {
    const start = face.halfEdge;
    if (start === null) {
      return [];
    }

    const edges: HalfEdge[] = [];
    const seen = new Set<number>();
    let current: HalfEdge | null = start;
    while (current !== null && !seen.has(current.id)) {
      edges.push(current);
      seen.add(current.id);
      current = current.next;
    }
    return edges;
  }

  faceVertices(face: Face): Vertex[] {
    return this.faceHalfEdges(face)
      .map((edge) => edge.origin)
      .filter((vertex): vertex is Vertex => vertex !== null);
  }

  vertexOutgoingHalfEdges(vertex: Vertex): HalfEdge[] {
    const start = vertex.halfEdge;
    if (start === null) {
      return [];
    }

    const edges: HalfEdge[] = [];
    const seen = new Set<number>();
    let current: HalfEdge | null = start;
    while (current !== null && !seen.has(current.id)) {
      edges.push(current);
      seen.add(current.id);
      current = current.twin?.next ?? null;
    }
    return edges;
  }

  uniqueUndirectedEdges(): HalfEdge[] {
    return this.edges.filter((edge) => edge.twin === null || edge.id < edge.twin.id);
  }

  boundingBox(): [Vec3, Vec3] | null {
    if (this.vertices.length === 0) {
      return null;
    }

    const min = this.vertices[0]!.position.clone();
    const max = this.vertices[0]!.position.clone();

    for (const vertex of this.vertices) {
      min.x = Math.min(min.x, vertex.position.x);
      min.y = Math.min(min.y, vertex.position.y);
      min.z = Math.min(min.z, vertex.position.z);
      max.x = Math.max(max.x, vertex.position.x);
      max.y = Math.max(max.y, vertex.position.y);
      max.z = Math.max(max.z, vertex.position.z);
    }

    return [min, max];
  }

  getBoundingBox(): [Vec3, Vec3] | null {
    return this.boundingBox();
  }

  validate(): MeshValidationIssue[] {
    const issues: MeshValidationIssue[] = [];

    for (const edge of this.edges) {
      if (edge.origin === null) {
        issues.push({ type: "edge-origin", message: `Half-edge ${edge.id} missing origin` });
      }

      if (edge.twin === null || edge.twin.twin !== edge) {
        issues.push({ type: "edge-twin", message: `Half-edge ${edge.id} has inconsistent twin` });
      }

      if (edge.next === null || edge.prev === null) {
        issues.push({ type: "edge-cycle", message: `Half-edge ${edge.id} missing prev/next` });
      } else {
        if (edge.next.prev !== edge) {
          issues.push({
            type: "edge-next-prev",
            message: `Half-edge ${edge.id} next pointer is not invertible`
          });
        }
        if (edge.prev.next !== edge) {
          issues.push({
            type: "edge-prev-next",
            message: `Half-edge ${edge.id} prev pointer is not invertible`
          });
        }
      }

      if (edge.face === null) {
        issues.push({ type: "edge-face", message: `Half-edge ${edge.id} missing face` });
      }
    }

    for (const vertex of this.vertices) {
      if (vertex.halfEdge !== null && vertex.halfEdge.origin !== vertex) {
        issues.push({
          type: "vertex-halfedge",
          message: `Vertex ${vertex.id} has a half-edge with different origin`
        });
      }
    }

    for (const face of this.faces) {
      const edge = face.halfEdge;
      if (edge === null) {
        issues.push({ type: "face-halfedge", message: `Face ${face.id} missing half-edge` });
        continue;
      }

      if (edge.face !== face) {
        issues.push({
          type: "face-edge-face",
          message: `Face ${face.id} half-edge ${edge.id} references a different face`
        });
      }
    }

    return issues;
  }

  checkConsistency(): void {
    const issues = this.validate();
    for (const issue of issues) {
      console.error(issue.message);
    }
  }

  copy(): Mesh {
    const other = new Mesh();

    this.vertices.forEach((vertex) => other.vertices.push(vertex.cloneShallow()));
    this.faces.forEach((face) => other.faces.push(face.cloneShallow()));
    this.edges.forEach((edge) => other.edges.push(edge.cloneShallow()));
    this.normals.forEach((normal) => other.normals.push(normal.clone()));

    this.vertices.forEach((vertex) => {
      const copyVertex = other.vertices[vertex.id]!;
      copyVertex.halfEdge = vertex.halfEdge ? other.edges[vertex.halfEdge.id]! : null;
    });

    this.faces.forEach((face) => {
      const copyFace = other.faces[face.id]!;
      copyFace.halfEdge = face.halfEdge ? other.edges[face.halfEdge.id]! : null;
    });

    this.edges.forEach((edge) => {
      const copyEdge = other.edges[edge.id]!;
      copyEdge.origin = edge.origin ? other.vertices[edge.origin.id]! : null;
      copyEdge.twin = edge.twin ? other.edges[edge.twin.id]! : null;
      copyEdge.prev = edge.prev ? other.edges[edge.prev.id]! : null;
      copyEdge.next = edge.next ? other.edges[edge.next.id]! : null;
      copyEdge.face = edge.face ? other.faces[edge.face.id]! : null;

      const destination = copyEdge.destination();
      if (copyEdge.origin !== null && destination !== null) {
        other.edgeMap.set(edgeKey(copyEdge.origin.id, destination.id), copyEdge);
      }
    });

    if (this.outerFace !== null) {
      other.outerFace = other.faces[this.outerFace.id] ?? null;
    }

    return other;
  }
}
