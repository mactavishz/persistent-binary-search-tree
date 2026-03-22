import type { MaybeIterable } from "./types.js";

export function toArray<T>(input: MaybeIterable<T>): T[] {
  if (typeof input === "string") {
    return [input as unknown as T];
  }
  if (
    input !== null &&
    typeof input === "object" &&
    Symbol.iterator in (input as object)
  ) {
    return [...(input as Iterable<T>)];
  }
  return [input as T];
}
