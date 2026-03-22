export interface SnapshotNode<T, K> {
  key: K;
  value: T;
  left: K | null;
  right: K | null;
}

export interface TreeSnapshot<T, K> {
  version: number;
  nodes: SnapshotNode<T, K>[];
}
