# TypeScript Library + Web Demo

This workspace now contains:

- strict TypeScript implementations of the BST and partial persistent BST,
- a strict numeric half-edge mesh implementation,
- planar point-location utilities,
- a simple React + D3 SPA for the two planar OBJ demos.

## Install

```bash
npm --prefix typescript install
```

## Run the web demo

```bash
npm --prefix typescript run dev
```

Then open the local Vite URL shown in the terminal.

## Build

```bash
npm --prefix typescript run build
```

## Tests

```bash
npm --prefix typescript run test -- --run
```

Environment-specific test runs:

- Node:

```bash
npm --prefix typescript run test:node
```

- Browser-like (jsdom):

```bash
npm --prefix typescript run test:browser
```

## Type check

```bash
npm --prefix typescript run typecheck
```

## What is included

- `src/bst/` and `src/persistent/`: generic BST and partial persistent BST.
- `src/vec/vec.ts`: numeric `Vec3` utility class.
- `src/mesh/mesh.ts`: numeric half-edge mesh (`Vertex`, `HalfEdge`, `Face`, `Mesh`).
- `src/mesh/obj-loader.ts`: OBJ parser for vertices/faces.
- `src/planar/`: slab decomposition and point-location utilities.
- `src/app/`: React components and D3 rendering logic for the demo SPA.
- `public/models/`: copied demo meshes (`planar_1.obj`, `planar_2.obj`).

## Notes

- The v1 web demo targets only the two provided planar OBJ models.
- General planarity certification from the Python/NetworkX path is not ported in this phase.
