import { Badge, Group, Paper, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import type { JSX } from "react";
import { splitLabelParts } from "./labelParts.js";

interface PersistentTreeNodeView {
  readonly nodeId: number;
  readonly copiedFromNodeId: number | null;
  readonly leftNodeId: number | null;
  readonly rightNodeId: number | null;
  readonly label: string;
}

interface PersistentTreeSummaryView {
  readonly activeEdgeLabels: string[];
  readonly enteredEdgeLabels: string[];
  readonly removedEdgeLabels: string[];
}

interface PersistentTreeVersionView {
  readonly version: number;
  readonly slabName: string;
  readonly nodes: PersistentTreeNodeView[];
  readonly summary: PersistentTreeSummaryView;
}

interface PersistentTreeViewProps {
  readonly versions: PersistentTreeVersionView[];
  readonly activeVersion: number | null;
  readonly latestVersion: number | null;
}

interface UnifiedNode {
  readonly nodeId: number;
  readonly label: string;
  readonly copiedFromNodeId: number | null;
  readonly versions: Set<number>;
  readonly x: number;
  readonly y: number;
  readonly depth: number;
}

interface UnifiedEdge {
  readonly key: string;
  readonly fromNodeId: number;
  readonly toNodeId: number;
  readonly versions: Set<number>;
}

interface UnifiedTreeModel {
  readonly nodes: UnifiedNode[];
  readonly nodeById: Map<number, UnifiedNode>;
  readonly edges: UnifiedEdge[];
  readonly edgesByKey: Map<string, UnifiedEdge>;
  readonly copyEdges: UnifiedEdge[];
  readonly versionEdges: Map<number, Set<string>>;
  readonly versionNodes: Map<number, Set<number>>;
  readonly rootByVersion: Map<number, number | null>;
}

const VIEWBOX_WIDTH = 1280;
const VIEWBOX_HEIGHT = 880;
const NODE_RADIUS = 48;
const DUMMY_ROOT_NODE_ID = -1;
const DUMMY_ROOT_LABEL = "root";
const CANVAS_PADDING = {
  left: 70,
  right: 70,
  top: 62,
  bottom: 104
} as const;

function edgeKey(fromNodeId: number, toNodeId: number): string {
  return `${fromNodeId}->${toNodeId}`;
}

function normalizeVersion(version: number): string {
  return `v${version}`;
}

function formatLabels(labels: string[]): string {
  return labels.length > 0 ? labels.join(", ") : "none";
}

function formatVersionMembership(versions: Set<number>): string {
  return Array.from(versions)
    .sort(compareNumbers)
    .map((version) => normalizeVersion(version))
    .join(",");
}

function asTspanLabel(label: string): JSX.Element {
  const { letters, number } = splitLabelParts(label);
  return (
    <>
      {letters}
      {number !== null ? <tspan className="label-number" dy="4px">{number}</tspan> : null}
    </>
  );
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function compareNumbers(a: number, b: number): number {
  return a - b;
}

function buildUnifiedModel(versions: PersistentTreeVersionView[]): UnifiedTreeModel {
  const sorted = [...versions].sort((a, b) => a.version - b.version);

  const nodeMetaById = new Map<number, { label: string; copiedFromNodeId: number | null; versions: Set<number> }>();
  const canonicalNodeIdByLabel = new Map<string, number>();
  const originalNodeIdToCanonicalId = new Map<number, number>();
  const usedCanonicalIds = new Set<number>();

  let nextCanonicalId = 1;
  const ensureCanonicalNodeId = (label: string, preferredNodeId: number): number => {
    const existing = canonicalNodeIdByLabel.get(label);
    if (existing !== undefined) {
      return existing;
    }

    let candidate = preferredNodeId;
    if (candidate === DUMMY_ROOT_NODE_ID || usedCanonicalIds.has(candidate)) {
      while (usedCanonicalIds.has(nextCanonicalId) || nextCanonicalId === DUMMY_ROOT_NODE_ID) {
        nextCanonicalId += 1;
      }
      candidate = nextCanonicalId;
      nextCanonicalId += 1;
    }

    canonicalNodeIdByLabel.set(label, candidate);
    usedCanonicalIds.add(candidate);
    return candidate;
  };
  const structuralEdges = new Map<string, UnifiedEdge>();
  const copyEdges = new Map<string, UnifiedEdge>();
  const versionEdges = new Map<number, Set<string>>();
  const versionNodes = new Map<number, Set<number>>();
  const rootByVersion = new Map<number, number | null>();
  const versionsByRootNodeId = new Map<number, Set<number>>();

  for (const snapshot of sorted) {
    const childrenInSnapshot = new Set<number>();
    const edgeKeysForVersion = new Set<string>();
    const nodeIdsForVersion = new Set<number>();
    const snapshotCanonicalByOriginalNodeId = new Map<number, number>();

    for (const node of snapshot.nodes) {
      const canonicalNodeId = ensureCanonicalNodeId(node.label, node.nodeId);
      snapshotCanonicalByOriginalNodeId.set(node.nodeId, canonicalNodeId);
      originalNodeIdToCanonicalId.set(node.nodeId, canonicalNodeId);
      nodeIdsForVersion.add(canonicalNodeId);

      const existing = nodeMetaById.get(canonicalNodeId);
      if (existing) {
        existing.versions.add(snapshot.version);
      } else {
        nodeMetaById.set(canonicalNodeId, {
          label: node.label,
          copiedFromNodeId: null,
          versions: new Set([snapshot.version])
        });
      }
    }

    for (const node of snapshot.nodes) {
      const canonicalNodeId = snapshotCanonicalByOriginalNodeId.get(node.nodeId);
      if (canonicalNodeId === undefined) {
        continue;
      }

      const nodeMeta = nodeMetaById.get(canonicalNodeId);
      if (nodeMeta) {
        nodeMeta.versions.add(snapshot.version);
      }

      if (node.leftNodeId !== null) {
        const leftCanonicalNodeId =
          snapshotCanonicalByOriginalNodeId.get(node.leftNodeId) ?? originalNodeIdToCanonicalId.get(node.leftNodeId);
        if (leftCanonicalNodeId !== undefined && leftCanonicalNodeId !== canonicalNodeId) {
          childrenInSnapshot.add(leftCanonicalNodeId);
          const key = edgeKey(canonicalNodeId, leftCanonicalNodeId);
          edgeKeysForVersion.add(key);
          const existingEdge = structuralEdges.get(key);
          if (existingEdge) {
            existingEdge.versions.add(snapshot.version);
          } else {
            structuralEdges.set(key, {
              key,
              fromNodeId: canonicalNodeId,
              toNodeId: leftCanonicalNodeId,
              versions: new Set([snapshot.version])
            });
          }
        }
      }

      if (node.rightNodeId !== null) {
        const rightCanonicalNodeId =
          snapshotCanonicalByOriginalNodeId.get(node.rightNodeId) ?? originalNodeIdToCanonicalId.get(node.rightNodeId);
        if (rightCanonicalNodeId !== undefined && rightCanonicalNodeId !== canonicalNodeId) {
          childrenInSnapshot.add(rightCanonicalNodeId);
          const key = edgeKey(canonicalNodeId, rightCanonicalNodeId);
          edgeKeysForVersion.add(key);
          const existingEdge = structuralEdges.get(key);
          if (existingEdge) {
            existingEdge.versions.add(snapshot.version);
          } else {
            structuralEdges.set(key, {
              key,
              fromNodeId: canonicalNodeId,
              toNodeId: rightCanonicalNodeId,
              versions: new Set([snapshot.version])
            });
          }
        }
      }

      if (node.copiedFromNodeId !== null) {
        const copiedFromCanonicalNodeId =
          snapshotCanonicalByOriginalNodeId.get(node.copiedFromNodeId) ??
          originalNodeIdToCanonicalId.get(node.copiedFromNodeId);

        if (
          copiedFromCanonicalNodeId !== undefined &&
          copiedFromCanonicalNodeId !== canonicalNodeId
        ) {
          if (nodeMeta && nodeMeta.copiedFromNodeId === null) {
            nodeMeta.copiedFromNodeId = copiedFromCanonicalNodeId;
          }

          const key = `${copiedFromCanonicalNodeId}=>${canonicalNodeId}`;
          const existingCopyEdge = copyEdges.get(key);
          if (existingCopyEdge) {
            existingCopyEdge.versions.add(snapshot.version);
          } else {
            copyEdges.set(key, {
              key,
              fromNodeId: copiedFromCanonicalNodeId,
              toNodeId: canonicalNodeId,
              versions: new Set([snapshot.version])
            });
          }
        }
      }
    }

    const rootCandidates = Array.from(nodeIdsForVersion)
      .filter((nodeId) => !childrenInSnapshot.has(nodeId))
      .sort(compareNumbers);
    const selectedRoot = rootCandidates[0] ?? null;
    rootByVersion.set(snapshot.version, selectedRoot);
    if (selectedRoot !== null) {
      const versionsForRoot = versionsByRootNodeId.get(selectedRoot);
      if (versionsForRoot) {
        versionsForRoot.add(snapshot.version);
      } else {
        versionsByRootNodeId.set(selectedRoot, new Set([snapshot.version]));
      }
    }
    versionEdges.set(snapshot.version, edgeKeysForVersion);
    versionNodes.set(snapshot.version, nodeIdsForVersion);
  }

  const indegreeSeed = new Map<number, number>();
  for (const nodeId of nodeMetaById.keys()) {
    indegreeSeed.set(nodeId, 0);
  }
  for (const edge of structuralEdges.values()) {
    indegreeSeed.set(edge.toNodeId, (indegreeSeed.get(edge.toNodeId) ?? 0) + 1);
  }

  const candidateRootIds = Array.from(
    new Set([
      ...versionsByRootNodeId.keys(),
      ...Array.from(nodeMetaById.keys()).filter((nodeId) => (indegreeSeed.get(nodeId) ?? 0) === 0)
    ])
  ).sort(compareNumbers);

  if (candidateRootIds.length === 0 && nodeMetaById.size > 0) {
    candidateRootIds.push(Math.min(...Array.from(nodeMetaById.keys())));
  }

  let graphRootIds = [...candidateRootIds];
  if (graphRootIds.length > 1) {
    nodeMetaById.set(DUMMY_ROOT_NODE_ID, {
      label: DUMMY_ROOT_LABEL,
      copiedFromNodeId: null,
      versions: new Set(sorted.map((snapshot) => snapshot.version))
    });

    for (const rootNodeId of graphRootIds) {
      const versionsForRoot = versionsByRootNodeId.get(rootNodeId) ?? new Set(sorted.map((snapshot) => snapshot.version));
      const key = edgeKey(DUMMY_ROOT_NODE_ID, rootNodeId);
      structuralEdges.set(key, {
        key,
        fromNodeId: DUMMY_ROOT_NODE_ID,
        toNodeId: rootNodeId,
        versions: new Set(versionsForRoot)
      });

      for (const version of versionsForRoot) {
        const edgeKeysForVersion = versionEdges.get(version);
        if (edgeKeysForVersion) {
          edgeKeysForVersion.add(key);
        }
        const nodeIdsForVersion = versionNodes.get(version);
        if (nodeIdsForVersion) {
          nodeIdsForVersion.add(DUMMY_ROOT_NODE_ID);
        }
      }
    }

    for (const snapshot of sorted) {
      rootByVersion.set(snapshot.version, DUMMY_ROOT_NODE_ID);
    }

    graphRootIds = [DUMMY_ROOT_NODE_ID];
  } else if (graphRootIds.length === 1) {
    const singleRoot = graphRootIds[0]!;
    for (const snapshot of sorted) {
      if (rootByVersion.get(snapshot.version) === null) {
        rootByVersion.set(snapshot.version, singleRoot);
      }
    }
  }

  const parentById = new Map<number, Set<number>>();
  const childById = new Map<number, Set<number>>();
  for (const nodeId of nodeMetaById.keys()) {
    parentById.set(nodeId, new Set());
    childById.set(nodeId, new Set());
  }

  for (const edge of structuralEdges.values()) {
    if (!parentById.has(edge.toNodeId) || !childById.has(edge.fromNodeId)) {
      continue;
    }
    parentById.get(edge.toNodeId)?.add(edge.fromNodeId);
    childById.get(edge.fromNodeId)?.add(edge.toNodeId);
  }

  const indegree = new Map<number, number>();
  for (const nodeId of nodeMetaById.keys()) {
    indegree.set(nodeId, parentById.get(nodeId)?.size ?? 0);
  }

  const depthById = new Map<number, number>();
  for (const rootId of graphRootIds) {
    depthById.set(rootId, 0);
  }

  const queue: number[] = [...graphRootIds];
  const queued = new Set<number>(queue);

  const enqueue = (nodeId: number): void => {
    if (!queued.has(nodeId)) {
      queue.push(nodeId);
      queued.add(nodeId);
    }
  };

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      break;
    }

    const currentDepth = depthById.get(current) ?? 0;
    for (const childId of childById.get(current) ?? []) {
      const nextDepth = Math.max(depthById.get(childId) ?? 0, currentDepth + 1);
      depthById.set(childId, nextDepth);

      const nextIndegree = (indegree.get(childId) ?? 0) - 1;
      indegree.set(childId, nextIndegree);
      if (nextIndegree <= 0) {
        enqueue(childId);
      }
    }
  }

  for (const nodeId of nodeMetaById.keys()) {
    if (!depthById.has(nodeId)) {
      depthById.set(nodeId, 0);
    }
  }

  const levels = new Map<number, number[]>();
  for (const nodeId of nodeMetaById.keys()) {
    const depth = depthById.get(nodeId) ?? 0;
    const bucket = levels.get(depth);
    if (bucket) {
      bucket.push(nodeId);
    } else {
      levels.set(depth, [nodeId]);
    }
  }

  const levelIndexes = Array.from(levels.keys()).sort(compareNumbers);
  const orderById = new Map<number, number>();

  for (const depth of levelIndexes) {
    const ids = levels.get(depth) ?? [];
    if (depth === 0) {
      ids.sort(compareNumbers);
    } else {
      ids.sort((a, b) => {
        const aParents = Array.from(parentById.get(a) ?? []);
        const bParents = Array.from(parentById.get(b) ?? []);

        const aScore =
          aParents.length === 0
            ? a
            : aParents.reduce((sum, parent) => sum + (orderById.get(parent) ?? parent), 0) / aParents.length;
        const bScore =
          bParents.length === 0
            ? b
            : bParents.reduce((sum, parent) => sum + (orderById.get(parent) ?? parent), 0) / bParents.length;

        return aScore === bScore ? a - b : aScore - bScore;
      });
    }

    ids.forEach((nodeId, index) => {
      orderById.set(nodeId, index);
    });
    levels.set(depth, ids);
  }

  const maxDepth = Math.max(...Array.from(depthById.values()), 0);
  const maxLevelWidth = Math.max(...Array.from(levels.values(), (nodesAtLevel) => nodesAtLevel.length), 1);

  const xPositions = new Map<number, number>();
  for (const depth of levelIndexes) {
    const ids = levels.get(depth) ?? [];
    if (ids.length === 0) {
      continue;
    }

    if (ids.length === 1) {
      xPositions.set(ids[0]!, maxLevelWidth / 2);
      continue;
    }

    const step = (maxLevelWidth - 1) / (ids.length - 1);
    ids.forEach((nodeId, index) => {
      xPositions.set(nodeId, index * step);
    });
  }

  const xScale = (VIEWBOX_WIDTH - CANVAS_PADDING.left - CANVAS_PADDING.right) / Math.max(maxLevelWidth - 1, 1);
  const yScale = (VIEWBOX_HEIGHT - CANVAS_PADDING.top - CANVAS_PADDING.bottom) / Math.max(maxDepth, 1);
  const singleLevelY = CANVAS_PADDING.top + (VIEWBOX_HEIGHT - CANVAS_PADDING.top - CANVAS_PADDING.bottom) / 2;

  const nodes: UnifiedNode[] = Array.from(nodeMetaById.entries())
    .map(([nodeId, meta]) => {
      const depth = depthById.get(nodeId) ?? 0;
      const xUnit = xPositions.get(nodeId) ?? 0;
      return {
        nodeId,
        label: meta.label,
        copiedFromNodeId: meta.copiedFromNodeId,
        versions: meta.versions,
        x: CANVAS_PADDING.left + xUnit * xScale,
        y: maxDepth === 0 ? singleLevelY : CANVAS_PADDING.top + depth * yScale,
        depth
      };
    })
    .sort((a, b) => (a.depth === b.depth ? a.x - b.x : a.depth - b.depth));

  const nodeById = new Map(nodes.map((node) => [node.nodeId, node]));
  const edges = Array.from(structuralEdges.values()).filter(
    (edge) => nodeById.has(edge.fromNodeId) && nodeById.has(edge.toNodeId)
  );
  const edgesByKey = new Map(edges.map((edge) => [edge.key, edge]));

  const copyPointers = Array.from(copyEdges.values()).filter(
    (edge) => nodeById.has(edge.fromNodeId) && nodeById.has(edge.toNodeId)
  );

  return {
    nodes,
    nodeById,
    edges,
    edgesByKey,
    copyEdges: copyPointers,
    versionEdges,
    versionNodes,
    rootByVersion
  };
}

function versionColor(versionIndex: number, total: number, isActive: boolean, isLatest: boolean): string {
  if (isActive) {
    return "#2563eb";
  }
  if (isLatest) {
    return "#0f766e";
  }
  const hue = total <= 1 ? 210 : Math.round((versionIndex / Math.max(total - 1, 1)) * 300);
  return `hsl(${hue} 72% 46%)`;
}

function edgeOffset(
  edge: UnifiedEdge,
  sortedVersions: PersistentTreeVersionView[],
  version: number
): number {
  const carryingVersions = sortedVersions
    .map((snapshot) => snapshot.version)
    .filter((candidateVersion) => edge.versions.has(candidateVersion));
  if (carryingVersions.length <= 1) {
    return 0;
  }

  const index = carryingVersions.indexOf(version);
  if (index === -1) {
    return 0;
  }

  return (index - (carryingVersions.length - 1) / 2) * 2.8;
}

export function PersistentTreeView({ versions, activeVersion, latestVersion }: PersistentTreeViewProps): JSX.Element {
  const sortedVersions = useMemo(() => [...versions].sort((a, b) => a.version - b.version), [versions]);
  const unified = useMemo(() => buildUnifiedModel(sortedVersions), [sortedVersions]);

  const activeSnapshot = useMemo(() => {
    if (activeVersion !== null) {
      const explicit = sortedVersions.find((snapshot) => snapshot.version === activeVersion);
      if (explicit) {
        return explicit;
      }
    }

    if (latestVersion !== null) {
      return sortedVersions.find((snapshot) => snapshot.version === latestVersion) ?? null;
    }

    return sortedVersions.length > 0 ? sortedVersions[sortedVersions.length - 1]! : null;
  }, [activeVersion, latestVersion, sortedVersions]);

  const activeAddedLabels = useMemo(
    () => new Set(activeSnapshot?.summary.enteredEdgeLabels ?? []),
    [activeSnapshot?.summary.enteredEdgeLabels]
  );

  const activeRemovedLabels = useMemo(
    () => new Set(activeSnapshot?.summary.removedEdgeLabels ?? []),
    [activeSnapshot?.summary.removedEdgeLabels]
  );

  return (
    <Paper className="tree-panel tree-panel-large" withBorder radius="md" p="md">
      <Stack gap="xs">
        <Text fw={600} size="sm">
          Persistent Tree (All Versions)
        </Text>
        <Text size="xs" c="dimmed">
          One persistent tree graph is shown for all versions. Colored path overlays indicate each version, and active/latest versions are emphasized.
        </Text>

        {sortedVersions.length === 0 ? (
          <div className="tree-empty-state">
            <Text size="xs" c="dimmed">
              Start an algorithm run to generate persistent tree versions.
            </Text>
          </div>
        ) : (
          <>
            <Group gap={8} wrap="wrap">
              {sortedVersions.map((snapshot, index) => {
                const isActive = activeVersion !== null && snapshot.version === activeVersion;
                const isLatest = latestVersion !== null && snapshot.version === latestVersion;
                const color = versionColor(index, sortedVersions.length, isActive, isLatest);
                const dotColor = isActive || isLatest ? "#ffffff" : color;

                return (
                  <Badge
                    key={snapshot.version}
                    size="md"
                    className="tree-version-badge"
                    variant={isActive || isLatest ? "filled" : "light"}
                    style={{
                      backgroundColor: isActive || isLatest ? color : undefined,
                      borderColor: color,
                      color: isActive || isLatest ? "#ffffff" : color
                    }}
                    leftSection={<span className="tree-version-dot" style={{ backgroundColor: dotColor }} />}
                  >
                    {normalizeVersion(snapshot.version)}
                    {isLatest ? " latest" : ""}
                    {isActive ? " current" : ""}
                  </Badge>
                );
              })}
            </Group>

            {activeSnapshot ? (
              <Text size="xs" c="dimmed">
                {normalizeVersion(activeSnapshot.version)} updates for {activeSnapshot.slabName}: active {formatLabels(activeSnapshot.summary.activeEdgeLabels)}, added {formatLabels(activeSnapshot.summary.enteredEdgeLabels)}, removed {formatLabels(activeSnapshot.summary.removedEdgeLabels)}.
              </Text>
            ) : null}

            <svg className="tree-canvas tree-unified-canvas" viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}>
              <g className="tree-unified-base-edges" pointerEvents="none">
                {unified.edges.map((edge) => {
                  const source = unified.nodeById.get(edge.fromNodeId);
                  const target = unified.nodeById.get(edge.toNodeId);
                  if (!source || !target) {
                    return null;
                  }

                  return (
                    <line
                      key={`base-${edge.key}`}
                      className="tree-edge tree-edge-base"
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                    />
                  );
                })}
              </g>

              <g className="tree-unified-version-overlays" pointerEvents="none">
                {sortedVersions.map((snapshot, versionIndex) => {
                  const versionEdgeKeys = unified.versionEdges.get(snapshot.version);
                  if (!versionEdgeKeys) {
                    return null;
                  }

                  const isActive = activeVersion !== null && snapshot.version === activeVersion;
                  const isLatest = latestVersion !== null && snapshot.version === latestVersion;
                  const stroke = versionColor(versionIndex, sortedVersions.length, isActive, isLatest);

                  return Array.from(versionEdgeKeys)
                    .map((key) => unified.edgesByKey.get(key))
                    .filter(isDefined)
                    .map((edge) => {
                      const source = unified.nodeById.get(edge.fromNodeId);
                      const target = unified.nodeById.get(edge.toNodeId);
                      if (!source || !target) {
                        return null;
                      }

                      const dx = target.x - source.x;
                      const dy = target.y - source.y;
                      const length = Math.hypot(dx, dy) || 1;
                      const normalX = -dy / length;
                      const normalY = dx / length;
                      const offset = edgeOffset(edge, sortedVersions, snapshot.version);

                      return (
                        <line
                          key={`version-${snapshot.version}-${edge.key}`}
                          className={`tree-version-path${isActive ? " tree-version-path-active" : ""}${isLatest ? " tree-version-path-latest" : ""}`}
                          x1={source.x + normalX * offset}
                          y1={source.y + normalY * offset}
                          x2={target.x + normalX * offset}
                          y2={target.y + normalY * offset}
                          data-version={snapshot.version}
                          style={{ stroke }}
                        />
                      );
                    });
                })}
              </g>

              <g className="tree-unified-copy-edges" pointerEvents="none">
                {unified.copyEdges.map((edge) => {
                  const source = unified.nodeById.get(edge.fromNodeId);
                  const target = unified.nodeById.get(edge.toNodeId);
                  if (!source || !target) {
                    return null;
                  }

                  return (
                    <line
                      key={`copy-${edge.key}`}
                      className="tree-copy-edge"
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                    />
                  );
                })}
              </g>

              <g className="tree-unified-nodes" pointerEvents="none">
                {unified.nodes.map((node) => {
                  const classNames = ["tree-node"];
                  const membership = node.nodeId === DUMMY_ROOT_NODE_ID ? null : formatVersionMembership(node.versions);
                  const membershipWidth = membership ? Math.max(60, membership.length * 10 + 20) : 0;
                  if (node.nodeId === DUMMY_ROOT_NODE_ID) {
                    classNames.push("tree-node-dummy");
                  }
                  if (node.nodeId !== DUMMY_ROOT_NODE_ID && node.versions.size > 1) {
                    classNames.push("tree-node-reused");
                  }
                  if (activeVersion !== null && node.versions.has(activeVersion)) {
                    classNames.push("tree-node-active-version");
                  }
                  if (latestVersion !== null && node.versions.has(latestVersion)) {
                    classNames.push("tree-node-latest-version");
                  }
                  if (node.copiedFromNodeId !== null) {
                    classNames.push("tree-node-copied");
                  }
                  if (activeAddedLabels.has(node.label)) {
                    classNames.push("tree-node-added");
                  }
                  if (activeRemovedLabels.has(node.label)) {
                    classNames.push("tree-node-removed");
                  }

                  return (
                    <g
                      key={node.nodeId}
                      className={classNames.join(" ")}
                      transform={`translate(${node.x} ${node.y})`}
                      data-node-id={node.nodeId}
                    >
                      <circle className="tree-node-circle" r={NODE_RADIUS} />
                      {node.copiedFromNodeId !== null && node.nodeId !== DUMMY_ROOT_NODE_ID ? <circle className="tree-node-copy-ring" r={NODE_RADIUS + 5} /> : null}
                      <text className="tree-node-label" y={7} textAnchor="middle">
                        {asTspanLabel(node.label)}
                      </text>
                      {node.nodeId !== DUMMY_ROOT_NODE_ID && node.versions.size > 1 ? (
                        <text className="tree-node-reuse" x={NODE_RADIUS - 13} y={-NODE_RADIUS + 14} textAnchor="middle">
                          x{node.versions.size}
                        </text>
                      ) : null}
                      {membership ? (
                        <g className="tree-node-membership" transform={`translate(${-membershipWidth / 2} ${NODE_RADIUS + 14})`}>
                          <rect className="tree-node-membership-pill" width={membershipWidth} height={28} rx={14} ry={14} />
                          <text className="tree-node-membership-text" x={membershipWidth / 2} y={19} textAnchor="middle">
                            {membership}
                          </text>
                        </g>
                      ) : null}
                    </g>
                  );
                })}
              </g>

              <g className="tree-version-root-labels" pointerEvents="none">
                {(() => {
                  const rootLabelOffsetByNodeId = new Map<number, number>();

                  return sortedVersions.map((snapshot, index) => {
                    const rootNodeId = unified.rootByVersion.get(snapshot.version);
                    if (rootNodeId === null || rootNodeId === undefined) {
                      return null;
                    }

                    const root = unified.nodeById.get(rootNodeId);
                    if (!root) {
                      return null;
                    }

                    const isActive = activeVersion !== null && snapshot.version === activeVersion;
                    const isLatest = latestVersion !== null && snapshot.version === latestVersion;
                    const color = versionColor(index, sortedVersions.length, isActive, isLatest);
                    const offsetIndex = rootLabelOffsetByNodeId.get(rootNodeId) ?? 0;
                    rootLabelOffsetByNodeId.set(rootNodeId, offsetIndex + 1);

                    return (
                      <text
                        key={`root-${snapshot.version}`}
                        className="tree-version-root-label"
                        x={root.x + NODE_RADIUS + 10}
                        y={root.y - NODE_RADIUS - 8 + offsetIndex * 15}
                        style={{ fill: color }}
                      >
                        {normalizeVersion(snapshot.version)}
                      </text>
                    );
                  });
                })()}
              </g>
            </svg>
          </>
        )}
      </Stack>
    </Paper>
  );
}
