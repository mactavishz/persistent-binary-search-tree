import { describe, expect, it } from "vitest";
import { BinarySearchTree } from "../src/bst/binary-search-tree.js";
import { SHUFFLED_0_TO_99, range } from "./helpers/seeded-data.js";

describe("BinarySearchTree", () => {
  it("searches inserted keys", () => {
    const tree = new BinarySearchTree<number>();
    for (const key of SHUFFLED_0_TO_99) {
      tree.insert(key);
      expect(tree.search(key)?.key).toBe(key);
    }
  });

  it("returns sorted inorder keys", () => {
    const tree = new BinarySearchTree<number>();
    const seen = new Set<number>();
    for (const key of SHUFFLED_0_TO_99) {
      tree.insert(key);
      seen.add(key);
      expect(tree.inorder()).toEqual(Array.from(seen).sort((a, b) => a - b));
    }
  });

  it("supports searchLE behavior", () => {
    const tree = new BinarySearchTree<number>();
    for (let i = 0; i < 100; i += 1) {
      tree.insert(i);
      expect(tree.searchLE(-1)).toBeNull();
      expect(tree.searchLE(i + 1)?.key).toBe(i);
    }
    for (let i = 0; i < 99; i += 1) {
      expect(tree.searchLE(i)?.key).toBe(i);
    }

    const evenTree = new BinarySearchTree<number>();
    for (let i = 0; i < 100; i += 2) {
      evenTree.insert(i);
    }
    for (let i = 1; i < 99; i += 2) {
      expect(evenTree.searchLE(i)?.key).toBe(i - 1);
    }
  });

  it("supports searchGT behavior", () => {
    const tree = new BinarySearchTree<number>();
    expect(tree.searchGT(1)).toBeNull();
    tree.insert(0);

    for (let i = 1; i < 100; i += 1) {
      tree.insert(i);
      expect(tree.searchGT(i)).toBeNull();
      expect(tree.searchGT(i - 1)?.key).toBe(i);
    }

    for (let i = 0; i < 99; i += 1) {
      expect(tree.searchGT(i)?.key).toBe(i + 1);
    }

    const evenTree = new BinarySearchTree<number>();
    for (let i = 0; i < 100; i += 2) {
      evenTree.insert(i);
    }

    for (let i = 1; i < 99; i += 2) {
      expect(evenTree.searchGT(i)?.key).toBe(i + 1);
    }
  });

  it("supports searchLE with gaps", () => {
    const tree = new BinarySearchTree<number>();
    for (let i = 0; i < 100; i += 2) {
      tree.insert(i);
      expect(tree.searchLE(-1)).toBeNull();
      expect(tree.searchLE(i)?.key).toBe(i);
      if (i >= 2) {
        expect(tree.searchLE(i - 1)?.key).toBe(i - 2);
      }
    }
  });

  it("deletes keys in ordered sequence", () => {
    const tree = new BinarySearchTree<number>();
    const control = range(0, 100);
    for (const k of control) {
      tree.insert(k);
    }

    const remaining = [...control];
    for (const key of control) {
      tree.delete(key);
      const idx = remaining.indexOf(key);
      if (idx >= 0) {
        remaining.splice(idx, 1);
      }
      expect(tree.search(key)).toBeNull();
      expect(tree.inorder()).toEqual(remaining);
    }
  });

  it("deletes keys in shuffled sequence", () => {
    const tree = new BinarySearchTree<number>();
    const control = [...SHUFFLED_0_TO_99];
    for (const k of control) {
      tree.insert(k);
    }

    const remaining = [...control];
    for (const key of control) {
      tree.delete(key);
      const idx = remaining.indexOf(key);
      if (idx >= 0) {
        remaining.splice(idx, 1);
      }
      expect(tree.search(key)).toBeNull();
      expect(tree.inorder()).toEqual([...remaining].sort((a, b) => a - b));
    }
  });

  it("supports generic objects with key extractor and comparator", () => {
    type Item = { id: number; label: string };
    const tree = new BinarySearchTree<Item, number>({
      keyOf: (item) => item.id,
      compare: (a, b) => a - b
    });

    tree.insert([
      { id: 3, label: "c" },
      { id: 1, label: "a" },
      { id: 2, label: "b" }
    ]);

    expect(tree.inorder()).toEqual([1, 2, 3]);
    expect(tree.search(2)?.value.label).toBe("b");
  });
});
