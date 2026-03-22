export interface ObjModel {
  readonly vertices: Array<[number, number, number]>;
  readonly faces: number[][];
}

function parseVertex(line: string): [number, number, number] {
  const [, ...parts] = line.trim().split(/\s+/);
  const x = Number(parts[0] ?? "0");
  const y = Number(parts[1] ?? "0");
  const z = Number(parts[2] ?? "0");
  return [x, y, z];
}

function parseFaceIndex(token: string): number {
  const [index] = token.split("/");
  const value = Number(index);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid face index token: ${token}`);
  }
  return value - 1;
}

function signedAreaXY(face: readonly number[], vertices: readonly [number, number, number][]): number {
  let area = 0;
  for (let i = 0; i < face.length; i += 1) {
    const a = vertices[face[i]!]!;
    const b = vertices[face[(i + 1) % face.length]!]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area * 0.5;
}

export function parseObj(text: string): ObjModel {
  const vertices: Array<[number, number, number]> = [];
  const faces: number[][] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    if (line.startsWith("v ")) {
      vertices.push(parseVertex(line));
      continue;
    }
    if (line.startsWith("f ")) {
      const [, ...parts] = line.split(/\s+/);
      if (parts.length < 3) {
        continue;
      }
      faces.push(parts.map(parseFaceIndex));
    }
  }

  const normalizedFaces = faces.map((face) => {
    const area = signedAreaXY(face, vertices);
    if (area < 0) {
      return [...face].reverse();
    }
    return face;
  });

  return { vertices, faces: normalizedFaces };
}
