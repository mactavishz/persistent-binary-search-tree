export { BinarySearchTree } from "./bst/binary-search-tree.js";
export { PartialPersistentBinarySearchTree } from "./persistent/partial-persistent-bst.js";
export { Vec3 } from "./vec/vec.js";
export { Mesh, Vertex, HalfEdge, Face } from "./mesh/mesh.js";
export { parseObj } from "./mesh/obj-loader.js";
export { buildSlabIndex } from "./planar/slabs.js";
export { buildPointLocationIndex, locatePoint } from "./planar/point-location.js";
export { meshToRenderModel } from "./planar/render-model.js";

export type {
  Comparator,
  KeyOf,
  NodeView,
  TreeOptions,
  MaybeIterable
} from "./shared/types.js";

export type { TreeSnapshot, SnapshotNode } from "./persistent/snapshot.js";
