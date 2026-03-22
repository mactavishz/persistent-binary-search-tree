import type { PersistentNode } from "./persistent-node.js";

export type PersistentField = "left" | "right" | "parent";

export interface ModificationRecord<T, K> {
  field: PersistentField;
  value: PersistentNode<T, K> | null;
  version: number;
}
