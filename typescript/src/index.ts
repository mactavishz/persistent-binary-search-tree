export { BinarySearchTree } from "./bst/binary-search-tree.js";
export { PartialPersistentBinarySearchTree } from "./persistent/partial-persistent-bst.js";

export type {
  Comparator,
  KeyOf,
  NodeView,
  TreeOptions,
  MaybeIterable
} from "./shared/types.js";

export type { TreeSnapshot, SnapshotNode } from "./persistent/snapshot.js";
