import { describe, expect, it } from "vitest";
import { Mesh } from "../src/mesh/mesh.js";
import { parseObj } from "../src/mesh/obj-loader.js";
import { buildPointLocationIndex, locatePoint } from "../src/planar/point-location.js";

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
});
