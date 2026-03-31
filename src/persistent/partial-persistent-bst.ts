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

export interface PersistentTraceNodeRef<K> {
  readonly nodeId: number;
  readonly key: K;
  readonly copiedFromNodeId: number | null;
}

export type PersistentTraceEventPhase =
  | "start"
  | "compare"
  | "duplicate"
  | "attach"
  | "search-hit"
  | "search-miss"
  | "delete-case"
  | "successor"
  | "transplant"
  | "mutate"
  | "clone"
  | "finish";

export interface PersistentTraceEvent<T, K> {
  readonly phase: PersistentTraceEventPhase;
  readonly detail: string;
  readonly version: number;
  readonly snapshot: TreeSnapshot<T, K> | null;
  readonly focus: PersistentTraceNodeRef<K> | null;
  readonly related: PersistentTraceNodeRef<K> | null;
  readonly cmp?: number;
  readonly direction?: "left" | "right";
}

export interface PersistentOperationTrace<T, K> {
  readonly kind: "insert" | "delete" | "query";
  readonly key: K;
  readonly sourceVersion: number;
  readonly targetVersion: number;
  readonly changed: boolean;
  readonly found: boolean;
  readonly events: PersistentTraceEvent<T, K>[];
}

interface TraceRecorder<T, K> {
  readonly version: number;
  readonly push: (event: PersistentTraceEvent<T, K>) => void;
}

export class PartialPersistentBinarySearchTree<T, K = T> {
  private readonly roots: Array<PersistentNode<T, K> | null> = [];
  private readonly updateQueue: Array<PersistentNode<T, K>> = [];
  private readonly keyOf: (value: T) => K;
  private readonly compare: Comparator<K>;
  private traceRecorder: TraceRecorder<T, K> | null = null;

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

  traceSearchExact(key: K, version?: number): PersistentOperationTrace<T, K> {
    const sourceVersion = this.normalizeVersion(version);
    const events: PersistentTraceEvent<T, K>[] = [];

    const found = this.withTraceContext(sourceVersion, (event) => {
      events.push(event);
    }, () => {
      if (sourceVersion < 0) {
        this.trace({
          phase: "start",
          detail: "Tree is empty; exact search cannot begin.",
          snapshotVersion: sourceVersion
        });
        this.trace({
          phase: "search-miss",
          detail: `Key ${this.keyLabel(key)} was not found.`,
          snapshotVersion: sourceVersion
        });
        this.trace({
          phase: "finish",
          detail: "Search finished.",
          snapshotVersion: sourceVersion
        });
        return false;
      }

      this.trace({
        phase: "start",
        detail: `Search for key ${this.keyLabel(key)} in version v${sourceVersion}.`,
        snapshotVersion: sourceVersion
      });

      const node = this.searchNodeWithTrace(key, sourceVersion);

      this.trace({
        phase: "finish",
        detail: node
          ? `Search finished with key ${this.keyLabel(key)}.`
          : `Search finished without a match for key ${this.keyLabel(key)}.`,
        focus: node,
        snapshotVersion: sourceVersion
      });

      return node !== null;
    });

    return {
      kind: "query",
      key,
      sourceVersion,
      targetVersion: sourceVersion,
      changed: false,
      found,
      events
    };
  }

  traceInsert(value: T): PersistentOperationTrace<T, K> {
    const key = this.keyOf(value);
    const sourceVersion = this.getLatestVersion();
    const events: PersistentTraceEvent<T, K>[] = [];
    let targetVersion = sourceVersion;
    let changed = true;
    let found = false;

    if (this.roots.length === 0) {
      targetVersion = 0;
      const root = new PersistentNode(value, key, targetVersion);
      this.roots.push(root);

      this.withTraceContext(targetVersion, (event) => {
        events.push(event);
      }, () => {
        this.trace({
          phase: "start",
          detail: `Insert key ${this.keyLabel(key)} into an empty tree.`,
          snapshotVersion: targetVersion
        });
        this.trace({
          phase: "attach",
          detail: `Created root node for key ${this.keyLabel(key)}.`,
          focus: root,
          snapshotVersion: targetVersion
        });
        this.trace({
          phase: "finish",
          detail: `Insertion finished at version v${targetVersion}.`,
          focus: root,
          snapshotVersion: targetVersion
        });
      });

      return {
        kind: "insert",
        key,
        sourceVersion,
        targetVersion,
        changed: true,
        found: true,
        events
      };
    }

    targetVersion = sourceVersion + 1;
    const lastRoot = this.roots[this.roots.length - 1] ?? null;

    if (lastRoot === null) {
      const root = new PersistentNode(value, key, targetVersion);
      this.roots.push(root);

      this.withTraceContext(targetVersion, (event) => {
        events.push(event);
      }, () => {
        this.trace({
          phase: "start",
          detail: `Insert key ${this.keyLabel(key)} after an empty latest root.`,
          snapshotVersion: targetVersion
        });
        this.trace({
          phase: "attach",
          detail: `Created root node for key ${this.keyLabel(key)}.`,
          focus: root,
          snapshotVersion: targetVersion
        });
        this.trace({
          phase: "finish",
          detail: `Insertion finished at version v${targetVersion}.`,
          focus: root,
          snapshotVersion: targetVersion
        });
      });

      return {
        kind: "insert",
        key,
        sourceVersion,
        targetVersion,
        changed: true,
        found: true,
        events
      };
    }

    this.roots.push(lastRoot);
    const existedBefore = this.searchNode(key, sourceVersion) !== null;
    const node = new PersistentNode(value, key, targetVersion);

    this.withTraceContext(targetVersion, (event) => {
      events.push(event);
    }, () => {
      this.trace({
        phase: "start",
        detail: `Insert key ${this.keyLabel(key)} using base version v${sourceVersion}.`,
        snapshotVersion: targetVersion
      });

      this.insertNode(node, targetVersion);
      this.updatePointers();

      const located = this.searchNode(key, targetVersion);
      found = located !== null;
      changed = !existedBefore;

      this.trace({
        phase: "finish",
        detail: changed
          ? `Insertion finished at version v${targetVersion}.`
          : `Key ${this.keyLabel(key)} already existed; version v${targetVersion} keeps the same structure.`,
        focus: located,
        snapshotVersion: targetVersion
      });
    });

    return {
      kind: "insert",
      key,
      sourceVersion,
      targetVersion,
      changed,
      found,
      events
    };
  }

  traceDelete(key: K): PersistentOperationTrace<T, K> {
    const sourceVersion = this.getLatestVersion();
    const events: PersistentTraceEvent<T, K>[] = [];

    if (sourceVersion < 0) {
      this.withTraceContext(-1, (event) => {
        events.push(event);
      }, () => {
        this.trace({
          phase: "start",
          detail: "Delete cannot begin because the tree is empty.",
          snapshotVersion: -1
        });
        this.trace({
          phase: "search-miss",
          detail: `Key ${this.keyLabel(key)} was not found.`,
          snapshotVersion: -1
        });
        this.trace({
          phase: "finish",
          detail: "Delete finished without changes.",
          snapshotVersion: -1
        });
      });

      return {
        kind: "delete",
        key,
        sourceVersion,
        targetVersion: sourceVersion,
        changed: false,
        found: false,
        events
      };
    }

    const exists = this.searchNode(key, sourceVersion);
    if (!exists) {
      this.withTraceContext(sourceVersion, (event) => {
        events.push(event);
      }, () => {
        this.trace({
          phase: "start",
          detail: `Attempt to delete key ${this.keyLabel(key)} from version v${sourceVersion}.`,
          snapshotVersion: sourceVersion
        });
        this.searchNodeWithTrace(key, sourceVersion);
        this.trace({
          phase: "finish",
          detail: "Delete finished without changes.",
          snapshotVersion: sourceVersion
        });
      });

      return {
        kind: "delete",
        key,
        sourceVersion,
        targetVersion: sourceVersion,
        changed: false,
        found: false,
        events
      };
    }

    const targetVersion = sourceVersion + 1;
    this.roots.push(this.roots[sourceVersion] ?? null);
    let found = false;

    this.withTraceContext(targetVersion, (event) => {
      events.push(event);
    }, () => {
      this.trace({
        phase: "start",
        detail: `Delete key ${this.keyLabel(key)} from version v${sourceVersion}.`,
        snapshotVersion: targetVersion
      });

      const node = this.searchNodeWithTrace(key, targetVersion);
      if (!node) {
        this.trace({
          phase: "finish",
          detail: "Delete finished without changes.",
          snapshotVersion: targetVersion
        });
        return;
      }

      found = true;
      this.deleteNode(node, targetVersion);
      this.updatePointers();

      this.trace({
        phase: "finish",
        detail: `Delete finished at version v${targetVersion}.`,
        snapshotVersion: targetVersion
      });
    });

    return {
      kind: "delete",
      key,
      sourceVersion,
      targetVersion,
      changed: found,
      found,
      events
    };
  }

  searchFirstGreaterOrEqual(
    compareSearchToNode: (node: NodeView<T, K>) => number,
    version?: number,
    onStep?: (step: {
      readonly node: NodeView<T, K>;
      readonly cmp: number;
      readonly direction: "left" | "right";
      readonly candidate: NodeView<T, K> | null;
    }) => void
  ): NodeView<T, K> | null {
    const normalized = this.normalizeVersion(version);
    if (normalized < 0) {
      return null;
    }

    let current = this.roots[normalized] ?? null;
    let candidate: PersistentNode<T, K> | null = null;

    while (current) {
      const view = this.toView(current);
      const cmp = compareSearchToNode(view);
      if (cmp <= 0) {
        candidate = current;
        onStep?.({
          node: view,
          cmp,
          direction: "left",
          candidate: this.toView(candidate)
        });
        current = current.get("left", normalized);
      } else {
        onStep?.({
          node: view,
          cmp,
          direction: "right",
          candidate: candidate ? this.toView(candidate) : null
        });
        current = current.get("right", normalized);
      }
    }

    return candidate ? this.toView(candidate) : null;
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

  private withTraceContext<R>(
    version: number,
    push: (event: PersistentTraceEvent<T, K>) => void,
    run: () => R
  ): R {
    const previous = this.traceRecorder;
    this.traceRecorder = { version, push };
    try {
      return run();
    } finally {
      this.traceRecorder = previous;
    }
  }

  private trace(params: {
    readonly phase: PersistentTraceEventPhase;
    readonly detail: string;
    readonly focus?: PersistentNode<T, K> | null;
    readonly related?: PersistentNode<T, K> | null;
    readonly cmp?: number;
    readonly direction?: "left" | "right";
    readonly snapshotVersion?: number;
  }): void {
    if (!this.traceRecorder) {
      return;
    }

    const snapshotVersion = params.snapshotVersion ?? this.traceRecorder.version;
    const focus = this.resolveTraceNode(params.focus ?? null, snapshotVersion);
    const related = this.resolveTraceNode(params.related ?? null, snapshotVersion);
    const event = {
      phase: params.phase,
      detail: params.detail,
      version: snapshotVersion,
      snapshot: snapshotVersion < 0 ? null : this.snapshot(snapshotVersion),
      focus: this.toTraceRef(focus),
      related: this.toTraceRef(related),
      ...(params.cmp !== undefined ? { cmp: params.cmp } : {}),
      ...(params.direction !== undefined ? { direction: params.direction } : {})
    } satisfies PersistentTraceEvent<T, K>;

    this.traceRecorder.push(event);
  }

  private searchNodeWithTrace(key: K, version: number): PersistentNode<T, K> | null {
    let root = this.roots[version] ?? null;
    while (root) {
      const cmp = this.compare(key, root.key);
      if (cmp < 0) {
        const next = root.get("left", version);
        this.trace({
          phase: "compare",
          detail: `Compare ${this.keyLabel(key)} with ${this.keyLabel(root.key)} and move left.`,
          focus: root,
          related: next,
          cmp,
          direction: "left",
          snapshotVersion: version
        });
        root = next;
      } else if (cmp > 0) {
        const next = root.get("right", version);
        this.trace({
          phase: "compare",
          detail: `Compare ${this.keyLabel(key)} with ${this.keyLabel(root.key)} and move right.`,
          focus: root,
          related: next,
          cmp,
          direction: "right",
          snapshotVersion: version
        });
        root = next;
      } else {
        this.trace({
          phase: "search-hit",
          detail: `Found key ${this.keyLabel(key)}.`,
          focus: root,
          cmp: 0,
          snapshotVersion: version
        });
        return root;
      }
    }

    this.trace({
      phase: "search-miss",
      detail: `Key ${this.keyLabel(key)} was not found in v${version}.`,
      snapshotVersion: version
    });
    return null;
  }

  private insertNode(node: PersistentNode<T, K>, version: number): void {
    let root = this.roots[version] ?? null;
    let parent: PersistentNode<T, K> | null = null;
    while (root) {
      parent = root;
      const cmp = this.compare(node.key, root.key);
      if (cmp < 0) {
        const next = root.get("left", version);
        this.trace({
          phase: "compare",
          detail: `Compare ${this.keyLabel(node.key)} with ${this.keyLabel(root.key)} and move left.`,
          focus: root,
          related: next,
          cmp,
          direction: "left",
          snapshotVersion: version
        });
        root = next;
      } else if (cmp > 0) {
        const next = root.get("right", version);
        this.trace({
          phase: "compare",
          detail: `Compare ${this.keyLabel(node.key)} with ${this.keyLabel(root.key)} and move right.`,
          focus: root,
          related: next,
          cmp,
          direction: "right",
          snapshotVersion: version
        });
        root = next;
      } else {
        this.trace({
          phase: "duplicate",
          detail: `Key ${this.keyLabel(node.key)} already exists; insertion stops.`,
          focus: root,
          snapshotVersion: version
        });
        return;
      }
    }

    node.parent = parent;
    if (!parent) {
      this.roots[version] = node;
      this.trace({
        phase: "attach",
        detail: `Attached ${this.keyLabel(node.key)} as root.`,
        focus: node,
        snapshotVersion: version
      });
      return;
    }

    if (this.compare(node.key, parent.key) < 0) {
      this.trace({
        phase: "attach",
        detail: `Attach ${this.keyLabel(node.key)} as left child of ${this.keyLabel(parent.key)}.`,
        focus: parent,
        related: node,
        direction: "left",
        snapshotVersion: version
      });
      this.setField(parent, "left", node, version);
    } else {
      this.trace({
        phase: "attach",
        detail: `Attach ${this.keyLabel(node.key)} as right child of ${this.keyLabel(parent.key)}.`,
        focus: parent,
        related: node,
        direction: "right",
        snapshotVersion: version
      });
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
      this.trace({
        phase: "delete-case",
        detail: `Delete case: ${this.keyLabel(node.key)} has no left child.`,
        focus: node,
        related: nodeRight,
        snapshotVersion: version
      });
      this.transplant(node, nodeRight, version);
      return;
    }

    if (nodeRight === null) {
      this.trace({
        phase: "delete-case",
        detail: `Delete case: ${this.keyLabel(node.key)} has no right child.`,
        focus: node,
        related: nodeLeft,
        snapshotVersion: version
      });
      this.transplant(node, nodeLeft, version);
      return;
    }

    this.trace({
      phase: "delete-case",
      detail: `Delete case: ${this.keyLabel(node.key)} has two children; locate successor.`,
      focus: node,
      snapshotVersion: version
    });

    let successor = this.successor(node, version);
    if (!successor) {
      this.trace({
        phase: "successor",
        detail: `No successor found for ${this.keyLabel(node.key)}.`,
        focus: node,
        snapshotVersion: version
      });
      return;
    }

    this.trace({
      phase: "successor",
      detail: `Successor for ${this.keyLabel(node.key)} is ${this.keyLabel(successor.key)}.`,
      focus: node,
      related: successor,
      snapshotVersion: version
    });

    if (successor !== nodeRight) {
      const successorRight = successor.get("right", version);
      this.transplant(successor, successorRight, version);
      node = PersistentNode.getLiveNode(node) ?? node;
      this.setField(successor, "right", node.get("right", version), version);
      successor = PersistentNode.getLiveNode(successor) ?? successor;
      const rightNow = successor.get("right", version);
      if (rightNow) {
        rightNow.parent = successor;
        this.trace({
          phase: "mutate",
          detail: `Updated parent pointer for right subtree after successor transplant.`,
          focus: successor,
          related: rightNow,
          snapshotVersion: version
        });
      }
    }

    this.transplant(node, successor, version);
    node = PersistentNode.getLiveNode(node) ?? node;
    this.setField(successor, "left", node.get("left", version), version);
    successor = PersistentNode.getLiveNode(successor) ?? successor;
    const leftNow = successor.get("left", version);
    if (leftNow) {
      leftNow.parent = successor;
      this.trace({
        phase: "mutate",
        detail: `Updated parent pointer for left subtree after delete transplant.`,
        focus: successor,
        related: leftNow,
        snapshotVersion: version
      });
    }
  }

  private findMin(node: PersistentNode<T, K>, version: number): PersistentNode<T, K> {
    let current = node;
    while (current.get("left", version)) {
      this.trace({
        phase: "successor",
        detail: `Move left from ${this.keyLabel(current.key)} while searching minimum successor.`,
        focus: current,
        direction: "left",
        snapshotVersion: version
      });
      current = current.get("left", version)!;
    }

    this.trace({
      phase: "successor",
      detail: `Minimum successor candidate is ${this.keyLabel(current.key)}.`,
      focus: current,
      snapshotVersion: version
    });

    return current;
  }

  private successor(node: PersistentNode<T, K>, version: number): PersistentNode<T, K> | null {
    const right = node.get("right", version);
    if (right) {
      this.trace({
        phase: "successor",
        detail: `Successor search enters right subtree of ${this.keyLabel(node.key)}.`,
        focus: node,
        related: right,
        snapshotVersion: version
      });
      return this.findMin(right, version);
    }

    let current = node;
    let parent = current.get("parent", version);
    while (parent && parent.get("right", version) === current) {
      this.trace({
        phase: "successor",
        detail: `Move up from ${this.keyLabel(current.key)} while traversing right ancestry.`,
        focus: current,
        related: parent,
        snapshotVersion: version
      });
      current = parent;
      parent = current.get("parent", version);
    }

    const resolved = current.get("parent", version);
    this.trace({
      phase: "successor",
      detail: resolved
        ? `Resolved successor as ${this.keyLabel(resolved.key)}.`
        : `No successor exists for ${this.keyLabel(node.key)} in this version.`,
      focus: node,
      related: resolved,
      snapshotVersion: version
    });
    return resolved;
  }

  private transplant(
    oldNode: PersistentNode<T, K>,
    newNode: PersistentNode<T, K> | null,
    version: number
  ): void {
    this.trace({
      phase: "transplant",
      detail: newNode
        ? `Transplant ${this.keyLabel(oldNode.key)} with ${this.keyLabel(newNode.key)}.`
        : `Transplant ${this.keyLabel(oldNode.key)} with null.`,
      focus: oldNode,
      related: newNode,
      snapshotVersion: version
    });

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
      this.trace({
        phase: "mutate",
        detail: `Updated parent of ${this.keyLabel(newNode.key)} after transplant.`,
        focus: newNode,
        related: oldParent,
        snapshotVersion: version
      });
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
      this.trace({
        phase: "mutate",
        detail: `Set ${field} on ${this.keyLabel(node.key)} in node version v${node.version}.`,
        focus: node,
        related: value,
        snapshotVersion: version
      });
      return node;
    }

    if (version < node.version) {
      return node;
    }

    const slot = node.getSlotIndex(field, version);
    if (slot !== -1) {
      const record: ModificationRecord<T, K> = { field, value, version };
      node.mods[slot as 0 | 1] = record;
      this.trace({
        phase: "mutate",
        detail: `Record modification ${field}=${value ? this.keyLabel(value.key) : "null"} on ${this.keyLabel(node.key)} for v${version}.`,
        focus: node,
        related: value,
        snapshotVersion: version
      });
      return node;
    }

    const copyNode = node.cloneForVersion(version);
    this.trace({
      phase: "clone",
      detail: `Clone node ${this.keyLabel(node.key)} for version v${version}.`,
      focus: node,
      related: copyNode,
      snapshotVersion: version
    });

    for (const mod of node.mods) {
      if (mod) {
        this.setField(copyNode, mod.field, mod.value, version);
      }
    }
    this.setField(copyNode, field, value, version);
    node.copy = copyNode;
    this.updateReversePointers(copyNode);
    this.updateQueue.push(copyNode);
    this.trace({
      phase: "mutate",
      detail: `Queue cloned node ${this.keyLabel(copyNode.key)} for pointer reconciliation.`,
      focus: copyNode,
      snapshotVersion: version
    });
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
        this.trace({
          phase: "mutate",
          detail: `Promoted ${this.keyLabel(node.key)} as root for v${version} during pointer updates.`,
          focus: node,
          snapshotVersion: version
        });
        continue;
      }

      const liveParent = PersistentNode.getLiveNode(parent);
      if (!liveParent) {
        continue;
      }
      const parentLeft = PersistentNode.getLiveNode(liveParent.get("left", version));
      if (parentLeft === node) {
        this.trace({
          phase: "mutate",
          detail: `Reconnect ${this.keyLabel(node.key)} as left child of ${this.keyLabel(liveParent.key)}.`,
          focus: liveParent,
          related: node,
          direction: "left",
          snapshotVersion: version
        });
        this.setField(liveParent, "left", node, version);
      } else {
        this.trace({
          phase: "mutate",
          detail: `Reconnect ${this.keyLabel(node.key)} as right child of ${this.keyLabel(liveParent.key)}.`,
          focus: liveParent,
          related: node,
          direction: "right",
          snapshotVersion: version
        });
        this.setField(liveParent, "right", node, version);
      }
    }
  }

  private keyLabel(key: K): string {
    return String(key);
  }

  private resolveTraceNode(node: PersistentNode<T, K> | null, snapshotVersion: number): PersistentNode<T, K> | null {
    if (!node || snapshotVersion < 0) {
      return node;
    }

    let resolved = node;
    while (resolved.copy && resolved.copy.version <= snapshotVersion) {
      resolved = resolved.copy;
    }

    return resolved;
  }

  private toTraceRef(node: PersistentNode<T, K> | null): PersistentTraceNodeRef<K> | null {
    if (!node) {
      return null;
    }

    return {
      nodeId: node.nodeId,
      key: node.key,
      copiedFromNodeId: node.copiedFromNodeId
    };
  }

  private toView(node: PersistentNode<T, K>): NodeView<T, K> {
    return {
      value: node.value,
      key: node.key
    };
  }
}
