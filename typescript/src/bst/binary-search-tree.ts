import { resolveCompare, resolveKeyOf } from "../shared/compare.js";
import { toArray } from "../shared/iterables.js";
import type { Comparator, MaybeIterable, NodeView, TreeOptions } from "../shared/types.js";
import { TreeNode } from "./tree-node.js";

export class BinarySearchTree<T, K = T> {
  private root: TreeNode<T, K> | null = null;
  private readonly keyOf: (value: T) => K;
  private readonly compare: Comparator<K>;

  constructor(options?: TreeOptions<T, K>) {
    this.keyOf = resolveKeyOf(options?.keyOf);
    this.compare = resolveCompare(options?.compare);
  }

  insert(values: MaybeIterable<T>): NodeView<T, K> | null {
    const items = toArray(values);
    let last: TreeNode<T, K> | null = null;
    for (const value of items) {
      last = this.insertOne(value);
    }
    return last ? this.toView(last) : null;
  }

  search(key: K): NodeView<T, K> | null {
    const node = this.searchNode(key);
    return node ? this.toView(node) : null;
  }

  searchLE(key: K): NodeView<T, K> | null {
    let current = this.root;
    let candidate: TreeNode<T, K> | null = null;

    while (current) {
      const cmp = this.compare(key, current.key);
      if (cmp < 0) {
        current = current.left;
      } else {
        candidate = current;
        current = current.right;
      }
    }

    return candidate ? this.toView(candidate) : null;
  }

  searchGT(key: K): NodeView<T, K> | null {
    let current = this.root;
    let candidate: TreeNode<T, K> | null = null;

    while (current) {
      const cmp = this.compare(key, current.key);
      if (cmp < 0) {
        candidate = current;
        current = current.left;
      } else {
        current = current.right;
      }
    }

    return candidate ? this.toView(candidate) : null;
  }

  delete(keys: MaybeIterable<K>): NodeView<T, K> | null {
    const items = toArray(keys);
    let last: TreeNode<T, K> | null = null;
    for (const key of items) {
      const node = this.searchNode(key);
      if (node) {
        this.deleteNode(node);
        last = node;
      }
    }
    return last ? this.toView(last) : null;
  }

  inorder(): K[] {
    const out: K[] = [];
    const stack: Array<TreeNode<T, K>> = [];
    let current = this.root;

    while (current || stack.length > 0) {
      while (current) {
        stack.push(current);
        current = current.left;
      }

      const node = stack.pop();
      if (!node) {
        break;
      }
      out.push(node.key);
      current = node.right;
    }

    return out;
  }

  private insertOne(value: T): TreeNode<T, K> {
    const key = this.keyOf(value);
    if (!this.root) {
      this.root = new TreeNode(value, key);
      return this.root;
    }

    let parent: TreeNode<T, K> | null = null;
    let current: TreeNode<T, K> | null = this.root;

    while (current) {
      parent = current;
      const cmp = this.compare(key, current.key);
      if (cmp < 0) {
        current = current.left;
      } else if (cmp > 0) {
        current = current.right;
      } else {
        current.value = value;
        return current;
      }
    }

    const node = new TreeNode(value, key);
    node.parent = parent;
    if (parent && this.compare(key, parent.key) < 0) {
      parent.left = node;
    } else if (parent) {
      parent.right = node;
    }
    return node;
  }

  private searchNode(key: K): TreeNode<T, K> | null {
    let node = this.root;
    while (node) {
      const cmp = this.compare(key, node.key);
      if (cmp < 0) {
        node = node.left;
      } else if (cmp > 0) {
        node = node.right;
      } else {
        return node;
      }
    }
    return null;
  }

  private deleteNode(node: TreeNode<T, K>): void {
    if (!node.left) {
      this.transplant(node, node.right);
      return;
    }
    if (!node.right) {
      this.transplant(node, node.left);
      return;
    }

    const successor = this.findMin(node.right);
    if (successor.parent !== node) {
      this.transplant(successor, successor.right);
      successor.right = node.right;
      if (successor.right) {
        successor.right.parent = successor;
      }
    }
    this.transplant(node, successor);
    successor.left = node.left;
    if (successor.left) {
      successor.left.parent = successor;
    }
  }

  private transplant(oldNode: TreeNode<T, K>, newNode: TreeNode<T, K> | null): void {
    if (!oldNode.parent) {
      this.root = newNode;
    } else if (oldNode.parent.left === oldNode) {
      oldNode.parent.left = newNode;
    } else {
      oldNode.parent.right = newNode;
    }
    if (newNode) {
      newNode.parent = oldNode.parent;
    }
  }

  private findMin(node: TreeNode<T, K>): TreeNode<T, K> {
    let current = node;
    while (current.left) {
      current = current.left;
    }
    return current;
  }

  private toView(node: TreeNode<T, K>): NodeView<T, K> {
    return { value: node.value, key: node.key };
  }
}
