import type { TreeSnapshot } from "../../../persistent/snapshot.js";
import type {
  PersistentOperationTrace,
  PersistentTraceEvent,
  PersistentTraceEventPhase,
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

export interface BstTreeNodeView {
  readonly nodeId: number;
  readonly copiedFromNodeId: number | null;
  readonly leftNodeId: number | null;
  readonly rightNodeId: number | null;
  readonly label: string;
}

export interface BstTreeVersionView {
  readonly version: number;
  readonly slabName: string;
  readonly nodes: BstTreeNodeView[];
  readonly summary: {
    activeEdgeLabels: string[];
    enteredEdgeLabels: string[];
    removedEdgeLabels: string[];
    phase?: PersistentTraceEventPhase;
    focusLabel?: string | null;
    relatedLabel?: string | null;
    direction?: "left" | "right";
    stepToken?: string;
  };
}

export interface BstVisualizerFrame {
  readonly id: string;
  readonly stepperPhase: BstStepperPhase;
  readonly title: string;
  readonly detail: string;
  readonly detailLines: string[];
  readonly treeVersions: BstTreeVersionView[];
  readonly visibleVersions: number[];
  readonly activeVersion: number | null;
  readonly latestVersion: number | null;
}

export interface BstVisualizerRun {
  readonly frames: BstVisualizerFrame[];
}

interface EventLabelSummary {
  readonly active: string[];
  readonly entered: string[];
  readonly removed: string[];
}

function toNodeLabel(key: number): string {
  return String(key);
}

function labelFromRef(ref: PersistentTraceNodeRef<number> | null): string | null {
  return ref ? toNodeLabel(ref.key) : null;
}

function uniqueLabels(...groups: Array<Array<string | null>>): string[] {
  const labels = new Set<string>();
  for (const group of groups) {
    for (const label of group) {
      if (label) {
        labels.add(label);
      }
    }
  }
  return Array.from(labels);
}

function labelsForEvent(event: PersistentTraceEvent<number, number>): EventLabelSummary {
  const focusLabel = labelFromRef(event.focus);
  const relatedLabel = labelFromRef(event.related);

  if (event.phase === "attach") {
    return {
      active: uniqueLabels([focusLabel], [relatedLabel]),
      entered: uniqueLabels([relatedLabel ?? focusLabel]),
      removed: []
    };
  }

  if (event.phase === "duplicate") {
    return {
      active: uniqueLabels([focusLabel]),
      entered: [],
      removed: []
    };
  }

  if (event.phase === "clone") {
    return {
      active: uniqueLabels([focusLabel]),
      entered: uniqueLabels([relatedLabel]),
      removed: []
    };
  }

  if (event.phase === "transplant") {
    return {
      active: uniqueLabels([focusLabel], [relatedLabel]),
      entered: uniqueLabels([relatedLabel]),
      removed: uniqueLabels([focusLabel])
    };
  }

  if (event.phase === "delete-case") {
    return {
      active: uniqueLabels([focusLabel], [relatedLabel]),
      entered: [],
      removed: []
    };
  }

  if (event.phase === "finish") {
    return {
      active: uniqueLabels([focusLabel]),
      entered: [],
      removed: []
    };
  }

  if (event.phase === "mutate" || event.phase === "successor" || event.phase === "compare" || event.phase === "search-hit") {
    return {
      active: uniqueLabels([focusLabel], [relatedLabel]),
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

export function buildTreeVersionsFromSnapshots(snapshots: TreeSnapshot<number, number>[]): BstTreeVersionView[] {
  return snapshots.map((snapshot) => ({
    version: snapshot.version,
    slabName: `v${snapshot.version}`,
    nodes: snapshot.nodes.map((node) => ({
      nodeId: node.nodeId,
      copiedFromNodeId: node.copiedFromNodeId,
      leftNodeId: node.left?.nodeId ?? null,
      rightNodeId: node.right?.nodeId ?? null,
      label: toNodeLabel(node.key)
    })),
    summary: {
      activeEdgeLabels: [],
      enteredEdgeLabels: [],
      removedEdgeLabels: []
    }
  }));
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
  const baseVersions = buildTreeVersionsFromSnapshots(snapshots);
  const latestVersion = baseVersions.length > 0 ? baseVersions[baseVersions.length - 1]!.version : null;

  const effectiveVisibleVersions = baseVersions.map((version) => version.version);

  const frames = trace.events.map((event, index) => {
    const labels = labelsForEvent(event);
    const activeVersion = event.version >= 0 ? event.version : latestVersion;
    const focusLabel = labelFromRef(event.focus);
    const relatedLabel = labelFromRef(event.related);
    const stepToken = `${trace.kind}-${trace.key}-${index}`;

    const treeVersions = baseVersions.map((snapshot) => {
      if (snapshot.version !== activeVersion) {
        return {
          ...snapshot,
          summary: {
            slabName: `v${snapshot.version}`,
            activeEdgeLabels: [],
            enteredEdgeLabels: [],
            removedEdgeLabels: []
          }
        };
      }

      return {
        ...snapshot,
        summary: {
          slabName: `v${snapshot.version}`,
          activeEdgeLabels: labels.active,
          enteredEdgeLabels: labels.entered,
          removedEdgeLabels: labels.removed,
          phase: event.phase,
          focusLabel,
          relatedLabel,
          ...(event.direction !== undefined ? { direction: event.direction } : {}),
          stepToken
        }
      };
    });

    return {
      id: `${trace.kind}-${trace.key}-${index}`,
      stepperPhase: toStepperPhase(event.phase),
      title: `${operationVerb(trace.kind)} ${trace.key}`,
      detail: event.detail,
      detailLines: detailLinesForEvent(event),
      treeVersions,
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
          treeVersions: baseVersions,
          visibleVersions: effectiveVisibleVersions,
          activeVersion: latestVersion,
          latestVersion
        }
      ]
    };
  }

  return { frames };
}
