# TypeScript Rewrite

This directory contains the TypeScript rewrite of the BST logic for interactive web usage.

Implemented in this phase:

- plain binary search tree
- partial persistent BST with node-copying only
- vitest parity tests ported from the Python suite (partial persistence only)

Not implemented in this phase:

- fat-node persistence
- full persistence

## Install

```bash
npm --prefix typescript install
```

## Run tests

```bash
npm --prefix typescript run test -- --run
```

Both environments are supported:

- Browser-like runtime (default):

```bash
npm --prefix typescript run test:browser
```

- Node runtime:

```bash
npm --prefix typescript run test:node
```

## Type check

```bash
npm --prefix typescript run typecheck
```

The TypeScript config is ESM + bundler-oriented (`moduleResolution: "Bundler"`) with DOM libs enabled, so the package can be consumed cleanly by both browser builds and Node.js ESM tooling.

## Generic usage

```ts
import { PartialPersistentBinarySearchTree } from "./src/index.js";

type Item = { id: number; name: string };

const tree = new PartialPersistentBinarySearchTree<Item, number>({
  keyOf: (item) => item.id,
  compare: (a, b) => a - b
});

tree.insert({ id: 2, name: "two" });
tree.insert({ id: 1, name: "one" });
const version = tree.getLatestVersion();

console.log(tree.inorder(version)); // [1, 2]
console.log(tree.search(2, version)?.value.name); // two
```
