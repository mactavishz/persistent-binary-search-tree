import { resolveCompare, resolveKeyOf } from "../shared/compare.js";
import { toArray } from "../shared/iterables.js";
import type {
  Comparator,
  MaybeIterable,
  NodeView,
  TreeOptions
} from "../shared/types.js";
import type { ModificationRecord, PersistentField } from "./modification-record.js";
import { PersistentNode } from "./persistent-node.js";
import type { TreeSnapshot } from "./snapshot.js";

export class PartialPersistentBinarySearchTree<T, K = T> {
  private readonly roots: Array<PersistentNode<T, K> | null> = [];
  private readonly updateQueue: Array<PersistentNode<T, K>> = [];
  private readonly keyOf: (value: T) => K;
  private readonly compare: Comparator<K>;

  constructor(options?: TreeOptions<T, K>) {
    this.keyOf = resolveKeyOf(options?.keyOf);
    this.compare = resolveCompare(options?.compare);
  }

  getLatestVersion(): number {
    return this.roots.length - 1;
  }

  insert(values: MaybeIterable<T>): number {
    const items = toArray(values);
    if (items.length === 0) {
      return this.getLatestVersion();
    }

    let version: number;
    let startIndex = 0;
    if (this.roots.length === 0) {
      version = 0;
      const firstValue = items[0]!;
      this.roots.push(new PersistentNode(firstValue, this.keyOf(firstValue), version));
      startIndex = 1;
    } else {
      version = this.getLatestVersion() + 1;
      const lastRoot = this.roots[this.roots.length - 1] ?? null;
      if (lastRoot === null) {
        const firstValue = items[0]!;
        this.roots.push(new PersistentNode(firstValue, this.keyOf(firstValue), version));
        startIndex = 1;
      } else {
        this.roots.push(lastRoot);
      }
    }

    for (let i = startIndex; i < items.length; i += 1) {
      const value = items[i]!;
      const node = new PersistentNode(value, this.keyOf(value), version);
      this.insertNode(node, version);
      this.updatePointers();
    }

    return this.getLatestVersion();
  }

  search(key: K, version?: number): NodeView<T, K> | null {
    const node = this.searchNode(key, version);
    return node ? this.toView(node) : null;
  }

  delete(keys: MaybeIterable<K>): number | null {
    const items = toArray(keys);
    if (this.roots.length === 0 || items.length === 0) {
      return null;
    }

    const version = this.getLatestVersion() + 1;
    let changed = false;

    for (const key of items) {
      const node = this.searchNode(key, version);
      if (!node) {
        continue;
      }
      this.deleteNode(node, version);
      if (version !== this.getLatestVersion()) {
        this.roots.push(this.roots[this.roots.length - 1] ?? null);
      }
      this.updatePointers();
      changed = true;
    }

    return changed ? version : null;
  }

  inorder(version?: number): K[] {
    const normalized = this.normalizeVersion(version);
    if (normalized < 0) {
      return [];
    }
    const root = this.roots[normalized] ?? null;
    const stack: Array<PersistentNode<T, K>> = [];
    const out: K[] = [];
    let current = root;

    while (current || stack.length > 0) {
      while (current) {
        stack.push(current);
        current = current.get("left", normalized);
      }
      const node = stack.pop();
      if (!node) {
        break;
      }
      out.push(node.key);
      current = node.get("right", normalized);
    }

    return out;
  }

  snapshot(version?: number): TreeSnapshot<T, K> | null {
    const normalized = this.normalizeVersion(version);
    if (normalized < 0) {
      return null;
    }
    const root = this.roots[normalized] ?? null;
    if (!root) {
      return { version: normalized, nodes: [] };
    }

    const stack: Array<PersistentNode<T, K>> = [root];
    const seen = new Set<PersistentNode<T, K>>();
    const nodes: TreeSnapshot<T, K>["nodes"] = [];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || seen.has(current)) {
        continue;
      }
      seen.add(current);

      const left = current.get("left", normalized);
      const right = current.get("right", normalized);
      nodes.push({
        nodeId: current.nodeId,
        copiedFromNodeId: current.copiedFromNodeId,
        key: current.key,
        value: current.value,
        left: left ? { nodeId: left.nodeId, key: left.key } : null,
        right: right ? { nodeId: right.nodeId, key: right.key } : null
      });

      if (left) {
        stack.push(left);
      }
      if (right) {
        stack.push(right);
      }
    }

    return { version: normalized, nodes };
  }

  private normalizeVersion(version?: number): number {
    if (this.getLatestVersion() < 0) {
      return -1;
    }
    if (version === undefined) {
      return this.getLatestVersion();
    }
    if (version < 0) {
      return -1;
    }
    return Math.min(version, this.getLatestVersion());
  }

  private insertNode(node: PersistentNode<T, K>, version: number): void {
    let root = this.roots[version] ?? null;
    let parent: PersistentNode<T, K> | null = null;
    while (root) {
      parent = root;
      const cmp = this.compare(node.key, root.key);
      if (cmp < 0) {
        root = root.get("left", version);
      } else if (cmp > 0) {
        root = root.get("right", version);
      } else {
        return;
      }
    }

    node.parent = parent;
    if (!parent) {
      this.roots[version] = node;
      return;
    }
    if (this.compare(node.key, parent.key) < 0) {
      this.setField(parent, "left", node, version);
    } else {
      this.setField(parent, "right", node, version);
    }
  }

  private searchNode(key: K, version?: number): PersistentNode<T, K> | null {
    const normalized = this.normalizeVersion(version);
    if (normalized < 0) {
      return null;
    }
    let root = this.roots[normalized] ?? null;
    while (root) {
      const cmp = this.compare(key, root.key);
      if (cmp < 0) {
        root = root.get("left", normalized);
      } else if (cmp > 0) {
        root = root.get("right", normalized);
      } else {
        return root;
      }
    }
    return null;
  }

  private deleteNode(node: PersistentNode<T, K>, version: number): void {
    const nodeLeft = node.get("left", version);
    const nodeRight = node.get("right", version);

    if (nodeLeft === null) {
      this.transplant(node, nodeRight, version);
      return;
    }
    if (nodeRight === null) {
      this.transplant(node, nodeLeft, version);
      return;
    }

    let successor = this.successor(node, version);
    if (!successor) {
      return;
    }

    if (successor !== nodeRight) {
      const successorRight = successor.get("right", version);
      this.transplant(successor, successorRight, version);
      node = PersistentNode.getLiveNode(node) ?? node;
      this.setField(successor, "right", node.get("right", version), version);
      successor = PersistentNode.getLiveNode(successor) ?? successor;
      const rightNow = successor.get("right", version);
      if (rightNow) {
        rightNow.parent = successor;
      }
    }

    this.transplant(node, successor, version);
    node = PersistentNode.getLiveNode(node) ?? node;
    this.setField(successor, "left", node.get("left", version), version);
    successor = PersistentNode.getLiveNode(successor) ?? successor;
    const leftNow = successor.get("left", version);
    if (leftNow) {
      leftNow.parent = successor;
    }
  }

  private findMin(node: PersistentNode<T, K>, version: number): PersistentNode<T, K> {
    let current = node;
    while (current.get("left", version)) {
      current = current.get("left", version)!;
    }
    return current;
  }

  private successor(node: PersistentNode<T, K>, version: number): PersistentNode<T, K> | null {
    const right = node.get("right", version);
    if (right) {
      return this.findMin(right, version);
    }

    let current = node;
    let parent = current.get("parent", version);
    while (parent && parent.get("right", version) === current) {
      current = parent;
      parent = current.get("parent", version);
    }
    return current.get("parent", version);
  }

  private transplant(
    oldNode: PersistentNode<T, K>,
    newNode: PersistentNode<T, K> | null,
    version: number
  ): void {
    const oldParent = oldNode.parent;
    if (!oldParent) {
      if (version !== this.getLatestVersion()) {
        this.roots.push(newNode);
      } else {
        this.roots[this.roots.length - 1] = newNode;
      }
    } else {
      const oldParentLeft = oldParent.get("left", version);
      if (oldNode === oldParentLeft) {
        this.setField(oldParent, "left", newNode, version);
      } else {
        this.setField(oldParent, "right", newNode, version);
      }
    }

    if (newNode) {
      newNode.parent = PersistentNode.getLiveNode(oldParent);
    }
  }

  private setField(
    node: PersistentNode<T, K>,
    field: PersistentField,
    newValue: PersistentNode<T, K> | null,
    version: number
  ): PersistentNode<T, K> {
    const value = PersistentNode.getLiveNode(newValue);

    if (version === node.version) {
      node[field] = value;
      return node;
    }

    if (version < node.version) {
      return node;
    }

    const slot = node.getSlotIndex(field, version);
    if (slot !== -1) {
      const record: ModificationRecord<T, K> = { field, value, version };
      node.mods[slot as 0 | 1] = record;
      return node;
    }

    const copyNode = node.cloneForVersion(version);
    for (const mod of node.mods) {
      if (mod) {
        this.setField(copyNode, mod.field, mod.value, version);
      }
    }
    this.setField(copyNode, field, value, version);
    node.copy = copyNode;
    this.updateReversePointers(copyNode);
    this.updateQueue.push(copyNode);
    return copyNode;
  }

  private updateReversePointers(node: PersistentNode<T, K>): void {
    const left = PersistentNode.getLiveNode(node.left);
    if (left) {
      left.parent = node;
    }
    const right = PersistentNode.getLiveNode(node.right);
    if (right) {
      right.parent = node;
    }
  }

  private updatePointers(): void {
    while (this.updateQueue.length > 0) {
      const node = this.updateQueue.pop();
      if (!node) {
        continue;
      }
      const version = node.version;
      const parent = node.parent;

      if (!parent) {
        if (this.getLatestVersion() === version) {
          this.roots[version] = node;
        } else {
          this.roots.push(node);
        }
        continue;
      }

      const liveParent = PersistentNode.getLiveNode(parent);
      if (!liveParent) {
        continue;
      }
      const parentLeft = PersistentNode.getLiveNode(liveParent.get("left", version));
      if (parentLeft === node) {
        this.setField(liveParent, "left", node, version);
      } else {
        this.setField(liveParent, "right", node, version);
      }
    }
  }

  private toView(node: PersistentNode<T, K>): NodeView<T, K> {
    return {
      value: node.value,
      key: node.key
    };
  }
}
