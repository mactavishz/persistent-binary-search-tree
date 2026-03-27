export interface SnapshotNode<T, K> {
  nodeId: number;
  copiedFromNodeId: number | null;
  key: K;
  value: T;
  left: { nodeId: number; key: K } | null;
  right: { nodeId: number; key: K } | null;
}

export interface TreeSnapshot<T, K> {
  version: number;
  nodes: SnapshotNode<T, K>[];
}
