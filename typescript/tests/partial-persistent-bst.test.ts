import { describe, expect, it } from "vitest";
import { PartialPersistentBinarySearchTree } from "../src/persistent/partial-persistent-bst.js";
import { SHUFFLED_0_TO_99, range } from "./helpers/seeded-data.js";

describe("PartialPersistentBinarySearchTree (node-copying)", () => {
  it("insert + search keep previous version unchanged", () => {
    const tree = new PartialPersistentBinarySearchTree<number>();
    for (const i of SHUFFLED_0_TO_99) {
      tree.insert(i);
      const version = tree.getLatestVersion();
      expect(tree.search(i)?.key).toBe(i);
      expect(tree.search(i, version - 1)).toBeNull();
    }
  });

  it("insert multi keeps batch on single version", () => {
    const tree = new PartialPersistentBinarySearchTree<number>();
    const control = [...SHUFFLED_0_TO_99];
    const k1 = 30;
    const k2 = 70;

    for (const i of control.slice(0, k1)) {
      tree.insert(i);
      const version = tree.getLatestVersion();
      expect(tree.search(i)?.key).toBe(i);
      expect(tree.search(i, version - 1)).toBeNull();
    }

    tree.insert(control.slice(k1, k2));
    const batchVersion = tree.getLatestVersion();
    for (const i of control.slice(k1, k2)) {
      expect(tree.search(i)?.key).toBe(i);
      expect(tree.search(i, batchVersion - 1)).toBeNull();
    }

    for (const i of control.slice(k2)) {
      tree.insert(i);
      const version = tree.getLatestVersion();
      expect(tree.search(i)?.key).toBe(i);
      expect(tree.search(i, version - 1)).toBeNull();
    }
  });

  it("inorder stays sorted at latest version", () => {
    const tree = new PartialPersistentBinarySearchTree<number>();
    const compareList: number[] = [];
    for (const i of SHUFFLED_0_TO_99) {
      compareList.push(i);
      tree.insert(i);
      const version = tree.getLatestVersion();
      const sorted = [...compareList].sort((a, b) => a - b);
      expect(tree.inorder()).toEqual(sorted);
      expect(tree.inorder(version - 1)).not.toEqual(sorted);
    }
  });

  it("deletes ordered sequence", () => {
    const tree = new PartialPersistentBinarySearchTree<number>();
    const control = [...SHUFFLED_0_TO_99];
    for (const i of control) {
      tree.insert(i);
    }

    const remaining = [...control];
    expect(tree.inorder()).toEqual([...control].sort((a, b) => a - b));
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

  it("deletes random sequence", () => {
    const tree = new PartialPersistentBinarySearchTree<number>();
    const control = [...SHUFFLED_0_TO_99];
    for (const i of control) {
      tree.insert(i);
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

  it("deletes in mixed single and batch operations", () => {
    const tree = new PartialPersistentBinarySearchTree<number>();
    const control = [...SHUFFLED_0_TO_99];
    const k1 = 40;
    const k2 = 75;

    tree.insert(control);
    expect(tree.inorder()).toEqual([...control].sort((a, b) => a - b));

    for (const i of control.slice(0, k1)) {
      tree.delete(i);
      expect(tree.search(i)).toBeNull();
    }
    expect(tree.inorder()).toEqual([...control.slice(k1)].sort((a, b) => a - b));

    tree.delete(control.slice(k1, k2));
    const version = tree.getLatestVersion();
    for (const i of control.slice(k1, k2)) {
      expect(tree.search(i, version)).toBeNull();
      expect(tree.search(i, version - 1)?.key).toBe(i);
    }
    expect(tree.inorder()).toEqual([...control.slice(k2)].sort((a, b) => a - b));
  });

  it("delete all and reinsert", () => {
    const tree = new PartialPersistentBinarySearchTree<number>();
    for (let i = 0; i < 100; i += 1) {
      tree.insert(i);
    }
    expect(tree.inorder()).toEqual(range(0, 100));

    for (let i = 99; i >= 0; i -= 1) {
      tree.delete(i);
    }
    expect(tree.inorder()).toEqual([]);

    for (let i = 0; i < 100; i += 1) {
      tree.insert(i);
    }
    expect(tree.inorder()).toEqual(range(0, 100));
  });

  it("manual scenario parity", () => {
    const tree = new PartialPersistentBinarySearchTree<number>();
    tree.insert([8, 3, 10]);
    tree.insert(1);
    tree.insert(6);
    tree.insert([14, 4]);
    tree.insert(7);
    tree.delete(4);
    tree.delete([6, 3]);
    tree.delete(8);
    tree.insert(0);
    tree.insert([2, 5]);
    tree.delete(tree.inorder(9));
    tree.insert(1);

    expect(tree.inorder(0)).toEqual([3, 8, 10]);
    expect(tree.inorder(1)).toEqual([1, 3, 8, 10]);
    expect(tree.inorder(2)).toEqual([1, 3, 6, 8, 10]);
    expect(tree.inorder(3)).toEqual([1, 3, 4, 6, 8, 10, 14]);
    expect(tree.inorder(4)).toEqual([1, 3, 4, 6, 7, 8, 10, 14]);

    expect(tree.search(8, 4)?.key).toBe(8);
    expect(tree.search(3, 4)?.key).toBe(3);
    expect(tree.search(4, 4)?.key).toBe(4);
    expect(tree.search(6, 4)?.key).toBe(6);
    expect(tree.search(0, 9)?.key).toBe(0);
    expect(tree.search(1, 9)?.key).toBe(1);
    expect(tree.search(2, 9)?.key).toBe(2);
    expect(tree.search(5, 9)?.key).toBe(5);
    expect(tree.search(7, 9)?.key).toBe(7);
    expect(tree.search(10, 9)?.key).toBe(10);
    expect(tree.search(14, 9)?.key).toBe(14);

    expect(tree.search(4, 5)).toBeNull();
    expect(tree.search(6, 6)).toBeNull();
    expect(tree.search(3, 6)).toBeNull();
    expect(tree.search(8, 7)).toBeNull();
    expect(tree.search(0, 10)).toBeNull();
    expect(tree.search(1, 10)).toBeNull();
    expect(tree.search(2, 10)).toBeNull();
    expect(tree.search(5, 10)).toBeNull();
    expect(tree.search(7, 10)).toBeNull();
    expect(tree.search(10, 10)).toBeNull();
    expect(tree.search(14, 10)).toBeNull();

    expect(tree.inorder(5)).toEqual([1, 3, 6, 7, 8, 10, 14]);
    expect(tree.inorder(6)).toEqual([1, 7, 8, 10, 14]);
    expect(tree.inorder(7)).toEqual([1, 7, 10, 14]);
    expect(tree.inorder(10)).toEqual([]);
    expect(tree.inorder(8)).toEqual([0, 1, 7, 10, 14]);
    expect(tree.inorder(9)).toEqual([0, 1, 2, 5, 7, 10, 14]);
    expect(tree.inorder(11)).toEqual([1]);
  });

  it("clamps future versions to latest", () => {
    const tree = new PartialPersistentBinarySearchTree<number>();
    tree.insert([2, 1, 3]);
    expect(tree.search(2, 1000)?.key).toBe(2);
    expect(tree.inorder(1000)).toEqual([1, 2, 3]);
  });

  it("supports object payloads with keyOf and compare", () => {
    type Edge = { id: string; rank: number };
    const tree = new PartialPersistentBinarySearchTree<Edge, number>({
      keyOf: (e) => e.rank,
      compare: (a, b) => a - b
    });
    tree.insert([
      { id: "a", rank: 3 },
      { id: "b", rank: 1 },
      { id: "c", rank: 2 }
    ]);
    const version = tree.getLatestVersion();
    expect(tree.inorder(version)).toEqual([1, 2, 3]);
    expect(tree.search(2, version)?.value.id).toBe("c");
  });

  it("creates serializable snapshots", () => {
    const tree = new PartialPersistentBinarySearchTree<number>();
    tree.insert([4, 2, 6, 1, 3]);
    const version = tree.getLatestVersion();
    const snap = tree.snapshot(version);

    expect(snap?.version).toBe(version);
    expect(snap?.nodes.map((n) => n.key).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 6
    ]);
  });
});
