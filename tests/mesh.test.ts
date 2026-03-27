import { describe, expect, it } from "vitest";
import { Mesh } from "../src/mesh/mesh.js";
import { parseObj } from "../src/mesh/obj-loader.js";

const SIMPLE_VERTS: Array<[number, number, number]> = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0]
];

describe("Mesh", () => {
  it("builds a basic half-edge mesh with twins and outer face", () => {
    const mesh = new Mesh();
    mesh.buildMesh(SIMPLE_VERTS, [], [[0, 1, 2], [0, 2, 3]]);

    expect(mesh.vertices).toHaveLength(4);
    expect(mesh.faces.length).toBeGreaterThanOrEqual(3);
    expect(mesh.outerFace).not.toBeNull();
    expect(mesh.edges.every((edge) => edge.twin !== null)).toBe(true);
    expect(mesh.validate()).toEqual([]);
  });

  it("rejects duplicate directed edges", () => {
    const mesh = new Mesh();
    mesh.buildMesh(SIMPLE_VERTS, [], [[0, 1, 2]]);
    expect(() => mesh.addFaceByVertexIndices([0, 1, 3])).toThrow(/Duplicate half-edge/);
  });

  it("computes bounding box", () => {
    const mesh = new Mesh();
    mesh.buildMesh(SIMPLE_VERTS, [], [[0, 1, 2], [0, 2, 3]]);
    const bbox = mesh.boundingBox();
    expect(bbox).not.toBeNull();
    expect(bbox?.[0].toArray()).toEqual([0, 0, 0]);
    expect(bbox?.[1].toArray()).toEqual([1, 1, 0]);
  });

  it("deep copies topology", () => {
    const mesh = new Mesh();
    mesh.buildMesh(SIMPLE_VERTS, [], [[0, 1, 2], [0, 2, 3]]);
    const cloned = mesh.copy();

    cloned.vertices[0]!.setPosition(20, 20, 20);
    expect(mesh.vertices[0]!.position.toArray()).toEqual([0, 0, 0]);
    expect(cloned.validate()).toEqual([]);
  });

  it("parses and builds planar_1 counts", () => {
    const obj = `
# demo
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
    const parsed = parseObj(obj);
    const mesh = new Mesh();
    mesh.buildMesh(parsed.vertices, [], parsed.faces);

    expect(mesh.vertices).toHaveLength(7);
    expect(mesh.edges).toHaveLength(24);
    expect(mesh.faces).toHaveLength(7);
    expect(mesh.validate()).toEqual([]);
  });

  it("parses and builds planar_2 counts", () => {
    const obj = `
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
    const parsed = parseObj(obj);
    const mesh = new Mesh();
    mesh.buildMesh(parsed.vertices, [], parsed.faces);

    expect(mesh.vertices).toHaveLength(8);
    expect(mesh.edges).toHaveLength(30);
    expect(mesh.faces).toHaveLength(9);
    expect(mesh.validate()).toEqual([]);
  });
});
