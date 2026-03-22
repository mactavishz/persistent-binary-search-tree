import type { Comparator, KeyOf } from "./types.js";

function defaultComparator<T>(a: T, b: T): number {
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  if (typeof a === "string" && typeof b === "string") {
    return a.localeCompare(b);
  }
  if (typeof a === "bigint" && typeof b === "bigint") {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  throw new Error("No comparator provided for key type");
}

export function resolveCompare<K>(compare?: Comparator<K>): Comparator<K> {
  if (compare) {
    return compare;
  }
  return defaultComparator as Comparator<K>;
}

export function resolveKeyOf<T, K>(keyOf?: KeyOf<T, K>): KeyOf<T, K> {
  if (keyOf) {
    return keyOf;
  }
  return ((value: T) => value as unknown as K) as KeyOf<T, K>;
}
