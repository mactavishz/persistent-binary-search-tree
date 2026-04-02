import type { TreeSnapshot } from "../../../persistent/snapshot.js";
import type {
  PersistentOperationTrace,
  PersistentTraceEvent,
  PersistentTraceNodeRef
} from "../../../persistent/partial-persistent-bst.js";

export type BstStepperPhase = "Prepare" | "Traverse" | "Modify" | "Commit";

export interface BstHistoryEntry {
  readonly id: string;
  readonly operation: "insert" | "delete" | "query";
  readonly key: number;
  readonly sourceVersion: number;
  readonly targetVersion: number;
  readonly changed: boolean;
  readonly found: boolean;
}

export interface BstResultRow {
  readonly name: string;
  readonly slab: string;
  readonly face: string;
  readonly status?: "pending" | "active" | "done";
}

export interface BstMemoryNode {
  readonly nodeId: number;
  readonly key: number;
  readonly label: string;
  readonly copiedFromNodeId: number | null;
  readonly versions: number[];
}

export interface BstMemoryEdge {
  readonly key: string;
  readonly fromNodeId: number;
  readonly toNodeId: number;
  readonly versions: number[];
}

export interface BstMemoryGraph {
  readonly versions: number[];
  readonly nodes: BstMemoryNode[];
  readonly edges: BstMemoryEdge[];
  readonly copyEdges: BstMemoryEdge[];
  readonly rootByVersion: ReadonlyMap<number, number | null>;
}

export interface BstStepHighlight {
  readonly focusNodeId: number | null;
  readonly relatedNodeId: number | null;
  readonly activeNodeIds: number[];
  readonly enteredNodeIds: number[];
  readonly removedNodeIds: number[];
  readonly phase?: PersistentTraceEvent<number, number>["phase"];
  readonly direction?: "left" | "right";
  readonly stepToken?: string;
}

export interface BstVisualizerFrame {
  readonly id: string;
  readonly stepperPhase: BstStepperPhase;
  readonly title: string;
  readonly detail: string;
  readonly detailLines: string[];
  readonly memoryGraph: BstMemoryGraph;
  readonly highlight: BstStepHighlight;
  readonly visibleVersions: number[];
  readonly activeVersion: number | null;
  readonly latestVersion: number | null;
}

export interface BstVisualizerRun {
  readonly frames: BstVisualizerFrame[];
}

interface EventLabelSummary {
  readonly active: number[];
  readonly entered: number[];
  readonly removed: number[];
}

function toNodeLabel(key: number): string {
  return String(key);
}

function nodeIdFromRef(ref: PersistentTraceNodeRef<number> | null): number | null {
  return ref ? ref.nodeId : null;
}

function uniqueNodeIds(...groups: Array<Array<number | null>>): number[] {
  const nodeIds = new Set<number>();
  for (const group of groups) {
    for (const nodeId of group) {
      if (nodeId !== null) {
        nodeIds.add(nodeId);
      }
    }
  }
  return Array.from(nodeIds);
}

function highlightsForEvent(event: PersistentTraceEvent<number, number>): EventLabelSummary {
  const focusNodeId = nodeIdFromRef(event.focus);
  const relatedNodeId = nodeIdFromRef(event.related);

  if (event.phase === "attach") {
    return {
      active: uniqueNodeIds([focusNodeId], [relatedNodeId]),
      entered: uniqueNodeIds([relatedNodeId ?? focusNodeId]),
      removed: []
    };
  }

  if (event.phase === "duplicate") {
    return {
      active: uniqueNodeIds([focusNodeId]),
      entered: [],
      removed: []
    };
  }

  if (event.phase === "clone") {
    return {
      active: uniqueNodeIds([focusNodeId]),
      entered: uniqueNodeIds([relatedNodeId]),
      removed: []
    };
  }

  if (event.phase === "transplant") {
    return {
      active: uniqueNodeIds([focusNodeId], [relatedNodeId]),
      entered: uniqueNodeIds([relatedNodeId]),
      removed: uniqueNodeIds([focusNodeId])
    };
  }

  if (event.phase === "delete-case") {
    return {
      active: uniqueNodeIds([focusNodeId], [relatedNodeId]),
      entered: [],
      removed: []
    };
  }

  if (event.phase === "finish") {
    return {
      active: uniqueNodeIds([focusNodeId]),
      entered: [],
      removed: []
    };
  }

  if (event.phase === "mutate" || event.phase === "successor" || event.phase === "compare" || event.phase === "search-hit") {
    return {
      active: uniqueNodeIds([focusNodeId], [relatedNodeId]),
      entered: [],
      removed: []
    };
  }

  return {
    active: [],
    entered: [],
    removed: []
  };
}

function toStepperPhase(phase: PersistentTraceEvent<number, number>["phase"]): BstStepperPhase {
  if (phase === "start") {
    return "Prepare";
  }
  if (phase === "compare" || phase === "search-hit" || phase === "search-miss") {
    return "Traverse";
  }
  if (
    phase === "attach" ||
    phase === "duplicate" ||
    phase === "delete-case" ||
    phase === "successor" ||
    phase === "transplant" ||
    phase === "mutate" ||
    phase === "clone"
  ) {
    return "Modify";
  }
  return "Commit";
}

function detailLinesForEvent(event: PersistentTraceEvent<number, number>): string[] {
  const lines: string[] = [];
  if (event.version >= 0) {
    lines.push(`Version: v${event.version}`);
  }
  if (event.focus) {
    lines.push(`Focus node: ${toNodeLabel(event.focus.key)} (#${event.focus.nodeId})`);
  }
  if (event.related) {
    lines.push(`Related node: ${toNodeLabel(event.related.key)} (#${event.related.nodeId})`);
  }
  if (event.direction) {
    lines.push(`Direction: ${event.direction}`);
  }
  if (event.cmp !== undefined) {
    lines.push(`Comparator: ${event.cmp}`);
  }
  return lines;
}

function operationVerb(operation: BstHistoryEntry["operation"]): string {
  if (operation === "insert") {
    return "insert";
  }
  if (operation === "delete") {
    return "delete";
  }
  return "query";
}

function edgeKey(fromNodeId: number, toNodeId: number): string {
  return `${fromNodeId}->${toNodeId}`;
}

function compareNumbers(a: number, b: number): number {
  return a - b;
}

function sortSnapshotsByVersion(
  snapshots: TreeSnapshot<number, number>[]
): TreeSnapshot<number, number>[] {
  return [...snapshots].sort((left, right) => left.version - right.version);
}

export function buildBstMemoryGraph(
  snapshots: TreeSnapshot<number, number>[]
): BstMemoryGraph {
  const sortedSnapshots = sortSnapshotsByVersion(snapshots);
  const nodesById = new Map<
    number,
    {
      readonly nodeId: number;
      readonly key: number;
      readonly label: string;
      readonly copiedFromNodeId: number | null;
      readonly versions: Set<number>;
    }
  >();
  const edgesByKey = new Map<string, { readonly key: string; readonly fromNodeId: number; readonly toNodeId: number; readonly versions: Set<number> }>();
  const copyEdgesByKey = new Map<string, { readonly key: string; readonly fromNodeId: number; readonly toNodeId: number; readonly versions: Set<number> }>();
  const rootByVersion = new Map<number, number | null>();
  const versions = sortedSnapshots.map((snapshot) => snapshot.version);

  for (const snapshot of sortedSnapshots) {
    const childNodeIds = new Set<number>();
    const nodeIds = new Set<number>();

    for (const node of snapshot.nodes) {
      nodeIds.add(node.nodeId);
      const existing = nodesById.get(node.nodeId);
      if (existing) {
        existing.versions.add(snapshot.version);
      } else {
        nodesById.set(node.nodeId, {
          nodeId: node.nodeId,
          key: node.key,
          label: toNodeLabel(node.key),
          copiedFromNodeId: node.copiedFromNodeId,
          versions: new Set([snapshot.version])
        });
      }

      if (node.left !== null) {
        childNodeIds.add(node.left.nodeId);
        const key = edgeKey(node.nodeId, node.left.nodeId);
        const existingEdge = edgesByKey.get(key);
        if (existingEdge) {
          existingEdge.versions.add(snapshot.version);
        } else {
          edgesByKey.set(key, {
            key,
            fromNodeId: node.nodeId,
            toNodeId: node.left.nodeId,
            versions: new Set([snapshot.version])
          });
        }
      }

      if (node.right !== null) {
        childNodeIds.add(node.right.nodeId);
        const key = edgeKey(node.nodeId, node.right.nodeId);
        const existingEdge = edgesByKey.get(key);
        if (existingEdge) {
          existingEdge.versions.add(snapshot.version);
        } else {
          edgesByKey.set(key, {
            key,
            fromNodeId: node.nodeId,
            toNodeId: node.right.nodeId,
            versions: new Set([snapshot.version])
          });
        }
      }

      if (node.copiedFromNodeId !== null) {
        const key = `${node.copiedFromNodeId}=>${node.nodeId}`;
        const existingCopyEdge = copyEdgesByKey.get(key);
        if (existingCopyEdge) {
          existingCopyEdge.versions.add(snapshot.version);
        } else {
          copyEdgesByKey.set(key, {
            key,
            fromNodeId: node.copiedFromNodeId,
            toNodeId: node.nodeId,
            versions: new Set([snapshot.version])
          });
        }
      }
    }

    const roots = Array.from(nodeIds).filter((nodeId) => !childNodeIds.has(nodeId)).sort(compareNumbers);
    rootByVersion.set(snapshot.version, roots[0] ?? null);
  }

  const nodes: BstMemoryNode[] = Array.from(nodesById.values())
    .map((node) => ({
      nodeId: node.nodeId,
      key: node.key,
      label: node.label,
      copiedFromNodeId: node.copiedFromNodeId,
      versions: Array.from(node.versions).sort(compareNumbers)
    }))
    .sort((left, right) => left.nodeId - right.nodeId);

  const edges: BstMemoryEdge[] = Array.from(edgesByKey.values())
    .map((edge) => ({
      key: edge.key,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      versions: Array.from(edge.versions).sort(compareNumbers)
    }))
    .sort((left, right) => (left.fromNodeId === right.fromNodeId ? left.toNodeId - right.toNodeId : left.fromNodeId - right.fromNodeId));

  const copyEdges: BstMemoryEdge[] = Array.from(copyEdgesByKey.values())
    .map((edge) => ({
      key: edge.key,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      versions: Array.from(edge.versions).sort(compareNumbers)
    }))
    .sort((left, right) => (left.fromNodeId === right.fromNodeId ? left.toNodeId - right.toNodeId : left.fromNodeId - right.fromNodeId));

  return {
    versions,
    nodes,
    edges,
    copyEdges,
    rootByVersion
  };
}

function emptyStepHighlight(): BstStepHighlight {
  return {
    focusNodeId: null,
    relatedNodeId: null,
    activeNodeIds: [],
    enteredNodeIds: [],
    removedNodeIds: []
  };
}

function snapshotsForEvent(
  snapshots: TreeSnapshot<number, number>[],
  event: PersistentTraceEvent<number, number>,
  activeVersion: number | null
): TreeSnapshot<number, number>[] {
  if (snapshots.length === 0) {
    return event.snapshot ? [event.snapshot] : [];
  }

  if (activeVersion === null) {
    return snapshots;
  }

  const withEventSnapshot = snapshots.map((snapshot) => {
    if (snapshot.version !== activeVersion) {
      return snapshot;
    }

    if (event.snapshot && event.snapshot.version === activeVersion) {
      return event.snapshot;
    }

    return snapshot;
  });

  if (event.snapshot && event.snapshot.version === activeVersion) {
    const containsVersion = withEventSnapshot.some((snapshot) => snapshot.version === activeVersion);
    if (!containsVersion) {
      return [...withEventSnapshot, event.snapshot].sort((left, right) => left.version - right.version);
    }
  }

  return withEventSnapshot;
}

export function collectSnapshotSeries(
  tree: { getLatestVersion: () => number; snapshot: (version?: number) => TreeSnapshot<number, number> | null }
): TreeSnapshot<number, number>[] {
  const latest = tree.getLatestVersion();
  if (latest < 0) {
    return [];
  }

  const snapshots: TreeSnapshot<number, number>[] = [];
  for (let version = 0; version <= latest; version += 1) {
    const snapshot = tree.snapshot(version);
    if (snapshot) {
      snapshots.push(snapshot);
    }
  }

  return snapshots;
}

export function buildBstVisualizerRun(params: {
  readonly trace: PersistentOperationTrace<number, number>;
  readonly snapshots: TreeSnapshot<number, number>[];
  readonly queryVersion: number | null;
}): BstVisualizerRun {
  const { trace, snapshots } = params;
  const sortedSnapshots = sortSnapshotsByVersion(snapshots);
  const latestVersion = sortedSnapshots.length > 0 ? sortedSnapshots[sortedSnapshots.length - 1]!.version : null;
  const effectiveVisibleVersions = sortedSnapshots.map((snapshot) => snapshot.version);

  const frames = trace.events.map((event, index) => {
    const highlights = highlightsForEvent(event);
    const activeVersion = event.version >= 0 ? event.version : latestVersion;
    const stepToken = `${trace.kind}-${trace.key}-${index}`;

    const eventSnapshots = snapshotsForEvent(sortedSnapshots, event, activeVersion);
    const memoryGraph = buildBstMemoryGraph(eventSnapshots);
    const highlight: BstStepHighlight = {
      focusNodeId: nodeIdFromRef(event.focus),
      relatedNodeId: nodeIdFromRef(event.related),
      activeNodeIds: highlights.active,
      enteredNodeIds: highlights.entered,
      removedNodeIds: highlights.removed,
      phase: event.phase,
      ...(event.direction !== undefined ? { direction: event.direction } : {}),
      stepToken
    };

    return {
      id: `${trace.kind}-${trace.key}-${index}`,
      stepperPhase: toStepperPhase(event.phase),
      title: `${operationVerb(trace.kind)} ${trace.key}`,
      detail: event.detail,
      detailLines: detailLinesForEvent(event),
      memoryGraph,
      highlight,
      visibleVersions: effectiveVisibleVersions,
      activeVersion,
      latestVersion
    };
  });

  if (frames.length === 0) {
    return {
      frames: [
        {
          id: `${trace.kind}-${trace.key}-idle`,
          stepperPhase: "Prepare",
          title: `${operationVerb(trace.kind)} ${trace.key}`,
          detail: "No trace events were emitted.",
          detailLines: [],
          memoryGraph: buildBstMemoryGraph(sortedSnapshots),
          highlight: emptyStepHighlight(),
          visibleVersions: effectiveVisibleVersions,
          activeVersion: latestVersion,
          latestVersion
        }
      ]
    };
  }

  return { frames };
}
