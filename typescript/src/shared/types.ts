export type Comparator<K> = (a: K, b: K) => number;
export type KeyOf<T, K> = (value: T) => K;

export interface TreeOptions<T, K = T> {
  keyOf?: KeyOf<T, K>;
  compare?: Comparator<K>;
}

export interface NodeView<T, K> {
  readonly value: T;
  readonly key: K;
}

export type MaybeIterable<T> = T | Iterable<T>;
