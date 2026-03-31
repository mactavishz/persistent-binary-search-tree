import { Badge, Group, Paper, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import type { JSX, KeyboardEvent } from "react";
import type { BstMemoryEdge, BstMemoryGraph, BstMemoryNode, BstStepHighlight } from "./bst-visualizer.js";

interface BstTreeViewProps {
  readonly memoryGraph: BstMemoryGraph;
  readonly highlight: BstStepHighlight;
  readonly activeVersion: number | null;
  readonly latestVersion: number | null;
  readonly selectedVersion?: number | null;
  readonly onSelectVersion?: (version: number) => void;
}

interface PositionedNode extends BstMemoryNode {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
}

interface BstTreeLayout {
  readonly nodes: PositionedNode[];
  readonly nodeById: Map<number, PositionedNode>;
  readonly edges: BstMemoryEdge[];
  readonly copyEdges: BstMemoryEdge[];
  readonly canvasWidth: number;
  readonly canvasHeight: number;
}

const VIEWBOX_WIDTH = 1280;
const VIEWBOX_HEIGHT = 880;
const NODE_RADIUS = 42;
const MIN_HORIZONTAL_GAP = NODE_RADIUS * 2 + 24;
const MIN_VERTICAL_GAP = NODE_RADIUS * 2 + 58;
const ROOT_LABEL_ROW_STEP = 20;
const ROOT_LABEL_COL_STEP = 92;
const ROOT_LABELS_PER_COLUMN = 5;
const DUMMY_ROOT_NODE_ID = -1;
const DUMMY_ROOT_LABEL = "root";
const CANVAS_PADDING = {
  left: 70,
  right: 70,
  top: 120,
  bottom: 116
} as const;

function compareNumbers(left: number, right: number): number {
  return left - right;
}

function isDummyNode(nodeId: number): boolean {
  return nodeId === DUMMY_ROOT_NODE_ID;
}

function formatVersionMembership(rawVersions: readonly number[]): string {
  const versions = Array.from(new Set(rawVersions)).sort(compareNumbers);
  if (versions.length === 0) {
    return "";
  }

  const parts: string[] = [];
  let start = versions[0]!;
  let end = versions[0]!;

  const pushRange = (rangeStart: number, rangeEnd: number): void => {
    const rangeLength = rangeEnd - rangeStart + 1;
    if (rangeLength >= 3) {
      parts.push(`v${rangeStart}-v${rangeEnd}`);
      return;
    }

    if (rangeLength === 2) {
      parts.push(`v${rangeStart}`);
      parts.push(`v${rangeEnd}`);
      return;
    }

    parts.push(`v${rangeStart}`);
  };

  for (let index = 1; index < versions.length; index += 1) {
    const current = versions[index]!;
    if (current === end + 1) {
      end = current;
      continue;
    }

    pushRange(start, end);
    start = current;
    end = current;
  }

  pushRange(start, end);
  return parts.join(",");
}

function buildLayout(memoryGraph: BstMemoryGraph): BstTreeLayout {
  if (memoryGraph.nodes.length === 0) {
    return {
      nodes: [],
      nodeById: new Map(),
      edges: [],
      copyEdges: [],
      canvasWidth: VIEWBOX_WIDTH,
      canvasHeight: VIEWBOX_HEIGHT
    };
  }

  const nodeIds = new Set(memoryGraph.nodes.map((node) => node.nodeId));
  const parentById = new Map<number, Set<number>>();
  const childById = new Map<number, Set<number>>();

  for (const nodeId of nodeIds) {
    parentById.set(nodeId, new Set());
    childById.set(nodeId, new Set());
  }

  const baseEdges = memoryGraph.edges.filter(
    (edge) => nodeIds.has(edge.fromNodeId) && nodeIds.has(edge.toNodeId)
  );

  for (const edge of baseEdges) {
    parentById.get(edge.toNodeId)?.add(edge.fromNodeId);
    childById.get(edge.fromNodeId)?.add(edge.toNodeId);
  }

  const copyEdges = memoryGraph.copyEdges.filter(
    (edge) => nodeIds.has(edge.fromNodeId) && nodeIds.has(edge.toNodeId)
  );

  const rootIds = new Set<number>();
  const versionsByRootNodeId = new Map<number, Set<number>>();
  for (const version of memoryGraph.versions) {
    const rootNodeId = memoryGraph.rootByVersion.get(version);
    if (rootNodeId === undefined || rootNodeId === null || !nodeIds.has(rootNodeId)) {
      continue;
    }

    rootIds.add(rootNodeId);
    const versions = versionsByRootNodeId.get(rootNodeId);
    if (versions) {
      versions.add(version);
    } else {
      versionsByRootNodeId.set(rootNodeId, new Set([version]));
    }
  }

  for (const nodeId of nodeIds) {
    if ((parentById.get(nodeId)?.size ?? 0) === 0) {
      rootIds.add(nodeId);
    }
  }

  if (rootIds.size === 0) {
    rootIds.add(memoryGraph.nodes[0]!.nodeId);
  }

  const nodes: BstMemoryNode[] = [...memoryGraph.nodes];
  const edges: BstMemoryEdge[] = [...baseEdges];

  if (rootIds.size > 0) {
    parentById.set(DUMMY_ROOT_NODE_ID, new Set());
    childById.set(DUMMY_ROOT_NODE_ID, new Set());

    nodes.push({
      nodeId: DUMMY_ROOT_NODE_ID,
      key: 0,
      label: DUMMY_ROOT_LABEL,
      copiedFromNodeId: null,
      versions: [...memoryGraph.versions]
    });

    for (const rootNodeId of Array.from(rootIds).sort(compareNumbers)) {
      const versionsForRoot = Array.from(
        versionsByRootNodeId.get(rootNodeId) ?? new Set(memoryGraph.versions)
      ).sort(compareNumbers);
      const key = `${DUMMY_ROOT_NODE_ID}->${rootNodeId}`;
      edges.push({
        key,
        fromNodeId: DUMMY_ROOT_NODE_ID,
        toNodeId: rootNodeId,
        versions: versionsForRoot
      });
      parentById.get(rootNodeId)?.add(DUMMY_ROOT_NODE_ID);
      childById.get(DUMMY_ROOT_NODE_ID)?.add(rootNodeId);
    }
  }

  const layoutNodeIds = new Set(nodes.map((node) => node.nodeId));
  const sortedRootIds = layoutNodeIds.has(DUMMY_ROOT_NODE_ID)
    ? [DUMMY_ROOT_NODE_ID]
    : Array.from(rootIds).sort(compareNumbers);

  const indegree = new Map<number, number>();
  const depthById = new Map<number, number>();

  for (const nodeId of layoutNodeIds) {
    indegree.set(nodeId, parentById.get(nodeId)?.size ?? 0);
  }

  for (const rootId of sortedRootIds) {
    depthById.set(rootId, 0);
  }

  const queue: number[] = [...sortedRootIds];
  const queued = new Set(queue);

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

  for (const nodeId of layoutNodeIds) {
    if (!depthById.has(nodeId)) {
      depthById.set(nodeId, 0);
    }
  }

  const levels = new Map<number, number[]>();
  for (const nodeId of layoutNodeIds) {
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
  const nodeMetaById = new Map(nodes.map((node) => [node.nodeId, node]));

  const directionalBias = (nodeId: number): number => {
    const node = nodeMetaById.get(nodeId);
    if (!node) {
      return 0;
    }

    let score = 0;
    let count = 0;
    for (const parentId of parentById.get(nodeId) ?? []) {
      if (isDummyNode(parentId)) {
        continue;
      }

      const parent = nodeMetaById.get(parentId);
      if (!parent) {
        continue;
      }

      if (node.key < parent.key) {
        score -= 0.45;
      } else if (node.key > parent.key) {
        score += 0.45;
      }
      count += 1;
    }

    return count > 0 ? score / count : 0;
  };

  for (const depth of levelIndexes) {
    const ids = levels.get(depth) ?? [];
    if (depth === 0) {
      ids.sort(compareNumbers);
    } else {
      ids.sort((leftNodeId, rightNodeId) => {
        const leftParents = Array.from(parentById.get(leftNodeId) ?? []);
        const rightParents = Array.from(parentById.get(rightNodeId) ?? []);

        const leftScore =
          leftParents.length === 0
            ? leftNodeId
            : leftParents.reduce((sum, parentId) => sum + (orderById.get(parentId) ?? parentId), 0) /
              leftParents.length;
        const rightScore =
          rightParents.length === 0
            ? rightNodeId
            : rightParents.reduce((sum, parentId) => sum + (orderById.get(parentId) ?? parentId), 0) /
              rightParents.length;

        const leftDirectionalScore = leftScore + directionalBias(leftNodeId);
        const rightDirectionalScore = rightScore + directionalBias(rightNodeId);

        if (leftDirectionalScore !== rightDirectionalScore) {
          return leftDirectionalScore - rightDirectionalScore;
        }

        const leftKey = nodeMetaById.get(leftNodeId)?.key ?? leftNodeId;
        const rightKey = nodeMetaById.get(rightNodeId)?.key ?? rightNodeId;
        if (leftKey !== rightKey) {
          return leftKey - rightKey;
        }

        return leftNodeId - rightNodeId;
      });
    }

    ids.forEach((nodeId, index) => {
      orderById.set(nodeId, index);
    });
    levels.set(depth, ids);
  }

  const maxDepth = Math.max(...Array.from(depthById.values()), 0);
  const maxLevelWidth = Math.max(
    ...Array.from(levels.values(), (nodesAtLevel) => nodesAtLevel.length),
    1
  );

  const xPositions = new Map<number, number>();
  for (const depth of levelIndexes) {
    const ids = levels.get(depth) ?? [];
    if (ids.length === 0) {
      continue;
    }

    if (ids.length === 1) {
      xPositions.set(ids[0]!, Math.max(maxLevelWidth - 1, 1) / 2);
      continue;
    }

    const step = (maxLevelWidth - 1) / (ids.length - 1);
    ids.forEach((nodeId, index) => {
      xPositions.set(nodeId, index * step);
    });
  }

  const xSpanUnits = Math.max(maxLevelWidth - 1, 1);
  const ySpanUnits = Math.max(maxDepth, 1);
  const baseWidth = VIEWBOX_WIDTH - CANVAS_PADDING.left - CANVAS_PADDING.right;
  const baseHeight = VIEWBOX_HEIGHT - CANVAS_PADDING.top - CANVAS_PADDING.bottom;
  const xScale = Math.max(baseWidth / xSpanUnits, MIN_HORIZONTAL_GAP);
  const yScale = Math.max(baseHeight / ySpanUnits, MIN_VERTICAL_GAP);
  const canvasWidth = CANVAS_PADDING.left + CANVAS_PADDING.right + xSpanUnits * xScale;
  const canvasHeight = CANVAS_PADDING.top + CANVAS_PADDING.bottom + ySpanUnits * yScale;
  const singleLevelY =
    CANVAS_PADDING.top + (canvasHeight - CANVAS_PADDING.top - CANVAS_PADDING.bottom) / 2;

  const positionedNodes: PositionedNode[] = nodes
    .map((node) => {
      const depth = depthById.get(node.nodeId) ?? 0;
      const xUnit = xPositions.get(node.nodeId) ?? 0;
      return {
        ...node,
        x: CANVAS_PADDING.left + xUnit * xScale,
        y: maxDepth === 0 ? singleLevelY : CANVAS_PADDING.top + depth * yScale,
        depth
      };
    })
    .sort((left, right) =>
      left.depth === right.depth ? left.x - right.x : left.depth - right.depth
    );

  return {
    nodes: positionedNodes,
    nodeById: new Map(positionedNodes.map((node) => [node.nodeId, node])),
    edges,
    copyEdges,
    canvasWidth,
    canvasHeight
  };
}

function filterMemoryGraph(
  memoryGraph: BstMemoryGraph,
  selectedVersion: number | null,
  latestVersion: number | null
): BstMemoryGraph {
  if (selectedVersion === null) {
    return memoryGraph;
  }

  if (latestVersion !== null && selectedVersion === latestVersion) {
    // Latest version acts as the full memory view with all copied/historical nodes.
    return memoryGraph;
  }

  const visibleVersions = new Set<number>();
  visibleVersions.add(selectedVersion);

  if (visibleVersions.size === 0) {
    return memoryGraph;
  }

  const versions = memoryGraph.versions.filter((version) => visibleVersions.has(version));
  const nodes = memoryGraph.nodes.filter((node) =>
    node.versions.some((version) => visibleVersions.has(version))
  );
  const visibleNodeIds = new Set(nodes.map((node) => node.nodeId));

  const edges = memoryGraph.edges.filter(
    (edge) =>
      edge.versions.some((version) => visibleVersions.has(version)) &&
      visibleNodeIds.has(edge.fromNodeId) &&
      visibleNodeIds.has(edge.toNodeId)
  );

  const copyEdges = memoryGraph.copyEdges.filter(
    (edge) =>
      edge.versions.some((version) => visibleVersions.has(version)) &&
      visibleNodeIds.has(edge.fromNodeId) &&
      visibleNodeIds.has(edge.toNodeId)
  );

  const rootByVersion = new Map<number, number | null>();
  for (const version of versions) {
    rootByVersion.set(version, memoryGraph.rootByVersion.get(version) ?? null);
  }

  return {
    versions,
    nodes,
    edges,
    copyEdges,
    rootByVersion
  };
}

function rootMembershipByNode(memoryGraph: BstMemoryGraph): Array<{ nodeId: number; label: string }> {
  const versionsByRootNodeId = new Map<number, number[]>();

  for (const version of memoryGraph.versions) {
    const rootNodeId = memoryGraph.rootByVersion.get(version);
    if (rootNodeId === undefined || rootNodeId === null || isDummyNode(rootNodeId)) {
      continue;
    }

    const versions = versionsByRootNodeId.get(rootNodeId);
    if (versions) {
      versions.push(version);
    } else {
      versionsByRootNodeId.set(rootNodeId, [version]);
    }
  }

  return Array.from(versionsByRootNodeId.entries())
    .map(([nodeId, versions]) => ({
      nodeId,
      label: formatVersionMembership(versions)
    }))
    .sort((left, right) => left.nodeId - right.nodeId);
}

export function BstTreeView({
  memoryGraph,
  highlight,
  activeVersion,
  latestVersion,
  selectedVersion = null,
  onSelectVersion
}: BstTreeViewProps): JSX.Element {
  const effectiveVersion = useMemo(() => {
    if (selectedVersion !== null && memoryGraph.versions.includes(selectedVersion)) {
      return selectedVersion;
    }
    if (activeVersion !== null && memoryGraph.versions.includes(activeVersion)) {
      return activeVersion;
    }
    if (latestVersion !== null && memoryGraph.versions.includes(latestVersion)) {
      return latestVersion;
    }
    return memoryGraph.versions.length > 0
      ? memoryGraph.versions[memoryGraph.versions.length - 1]!
      : null;
  }, [activeVersion, latestVersion, memoryGraph.versions, selectedVersion]);

  const filteredMemoryGraph = useMemo(
    () => filterMemoryGraph(memoryGraph, effectiveVersion, latestVersion),
    [effectiveVersion, latestVersion, memoryGraph]
  );

  const layout = useMemo(() => buildLayout(filteredMemoryGraph), [filteredMemoryGraph]);

  const activeNodeSet = useMemo(() => new Set(highlight.activeNodeIds), [highlight.activeNodeIds]);
  const enteredNodeSet = useMemo(() => new Set(highlight.enteredNodeIds), [highlight.enteredNodeIds]);
  const removedNodeSet = useMemo(() => new Set(highlight.removedNodeIds), [highlight.removedNodeIds]);
  const currentVersionNodeSet = useMemo(() => {
    if (effectiveVersion === null) {
      return new Set<number>();
    }

    return new Set(
      filteredMemoryGraph.nodes
        .filter((node) => node.versions.includes(effectiveVersion))
        .map((node) => node.nodeId)
    );
  }, [effectiveVersion, filteredMemoryGraph.nodes]);
  const traversalStep = highlight.phase === "compare" || highlight.phase === "search-hit";

  const activeTraversalEdge = useMemo(() => {
    if (highlight.focusNodeId === null || highlight.relatedNodeId === null) {
      return null;
    }

    const hasStructuralEdge = layout.edges.some(
      (edge) =>
        edge.fromNodeId === highlight.focusNodeId &&
        edge.toNodeId === highlight.relatedNodeId
    );
    if (!hasStructuralEdge) {
      return null;
    }

    const source = layout.nodeById.get(highlight.focusNodeId);
    const target = layout.nodeById.get(highlight.relatedNodeId);
    if (!source || !target) {
      return null;
    }

    return { source, target };
  }, [highlight.focusNodeId, highlight.relatedNodeId, layout.nodeById]);

  const rootLabels = useMemo(() => rootMembershipByNode(filteredMemoryGraph), [filteredMemoryGraph]);
  const showRootLabels = !layout.nodeById.has(DUMMY_ROOT_NODE_ID);

  const handleBadgeKeyDown = (event: KeyboardEvent, version: number): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectVersion?.(version);
    }
  };

  return (
    <Paper className="tree-panel tree-panel-large" withBorder radius="md" p="md">
      <Stack gap="xs">
        <Text fw={600} size="sm">
          Persistent BST Memory View
        </Text>
        <Text size="xs" c="dimmed">
          Each node is a physical memory node by nodeId. Dashed links show path-copy lineage.
        </Text>

        {memoryGraph.versions.length > 0 ? (
          <Group gap={8} wrap="wrap">
            {memoryGraph.versions.map((version) => {
              const isActive = activeVersion !== null && version === activeVersion;
              const isLatest = latestVersion !== null && version === latestVersion;
              const isSelected = effectiveVersion !== null && version === effectiveVersion;

              return (
                <Badge
                  key={version}
                  size="md"
                  className={`bst-tree-version-badge${isSelected ? " bst-tree-version-badge-current" : ""}${isLatest ? " bst-tree-version-badge-latest" : ""}`}
                  variant={isSelected ? "filled" : "light"}
                  role={onSelectVersion ? "button" : undefined}
                  tabIndex={onSelectVersion ? 0 : undefined}
                  onClick={onSelectVersion ? () => onSelectVersion(version) : undefined}
                  onKeyDown={onSelectVersion ? (event) => handleBadgeKeyDown(event, version) : undefined}
                >
                  v{version}
                  {isLatest ? " latest" : ""}
                  {isSelected ? " current" : ""}
                  {!isSelected && isActive ? " active" : ""}
                </Badge>
              );
            })}
          </Group>
        ) : null}

        {layout.nodes.length === 0 ? (
          <div className="tree-empty-state">
            <Text size="xs" c="dimmed">
              Run an operation to build the persistent tree memory graph.
            </Text>
          </div>
        ) : (
          <svg
            className="tree-canvas bst-tree-canvas"
            viewBox={`0 0 ${Math.ceil(layout.canvasWidth)} ${Math.ceil(layout.canvasHeight)}`}
          >
            <g className="bst-tree-edges" pointerEvents="none">
              {layout.edges.map((edge) => {
                const source = layout.nodeById.get(edge.fromNodeId);
                const target = layout.nodeById.get(edge.toNodeId);
                if (!source || !target) {
                  return null;
                }

                const isCurrentOnly =
                  effectiveVersion !== null &&
                  edge.versions.includes(effectiveVersion) &&
                  edge.versions.every((version) => version === effectiveVersion);
                const isCurrentVersion =
                  effectiveVersion !== null && edge.versions.includes(effectiveVersion);

                return (
                  <line
                    key={edge.key}
                    className={`tree-edge bst-tree-edge-base${isCurrentVersion ? " bst-tree-edge-current-version" : ""}${isCurrentOnly ? " bst-tree-edge-current-only" : ""}`}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                  />
                );
              })}
            </g>

            <g className="bst-tree-copy-edges" pointerEvents="none">
              {layout.copyEdges.map((edge) => {
                const source = layout.nodeById.get(edge.fromNodeId);
                const target = layout.nodeById.get(edge.toNodeId);
                if (!source || !target) {
                  return null;
                }

                return (
                  <line
                    key={`copy-${edge.key}`}
                    className="tree-edge bst-tree-copy-edge"
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                  />
                );
              })}
            </g>

            <g className="tree-step-overlay" pointerEvents="none">
              {activeTraversalEdge ? (
                <line
                  key={`step-${highlight.stepToken ?? "active"}`}
                  className={`tree-step-edge${highlight.direction ? ` tree-step-edge-${highlight.direction}` : ""}`}
                  x1={activeTraversalEdge.source.x}
                  y1={activeTraversalEdge.source.y}
                  x2={activeTraversalEdge.target.x}
                  y2={activeTraversalEdge.target.y}
                />
              ) : null}
            </g>

            <g className="bst-tree-nodes" pointerEvents="none">
              {layout.nodes.map((node) => {
                const classNames = ["tree-node", "bst-tree-node"];
                const isDummy = isDummyNode(node.nodeId);
                const membership = isDummy ? "" : formatVersionMembership(node.versions);
                const membershipWidth = Math.max(64, membership.length * 10 + 20);

                if (isDummy) {
                  classNames.push("tree-node-dummy");
                }

                if (!isDummy && currentVersionNodeSet.has(node.nodeId)) {
                  classNames.push("bst-tree-node-current-version");
                }

                if (node.copiedFromNodeId !== null && !isDummy) {
                  classNames.push("bst-tree-node-copied");
                }
                if (enteredNodeSet.has(node.nodeId) && !isDummy) {
                  classNames.push("tree-node-added");
                }
                if (removedNodeSet.has(node.nodeId) && !isDummy) {
                  classNames.push("tree-node-removed");
                }
                if (highlight.focusNodeId === node.nodeId && !isDummy) {
                  classNames.push("tree-node-focus-step");
                  if (traversalStep) {
                    classNames.push("tree-node-traverse-step");
                  }
                }
                if (highlight.relatedNodeId === node.nodeId && !isDummy) {
                  classNames.push("tree-node-related-step");
                  if (traversalStep) {
                    classNames.push("tree-node-traverse-step");
                  }
                }
                if (
                  activeNodeSet.has(node.nodeId) &&
                  highlight.focusNodeId !== node.nodeId &&
                  highlight.relatedNodeId !== node.nodeId
                ) {
                  classNames.push("bst-tree-node-active-step");
                }

                const shouldResetAnimation =
                  highlight.stepToken !== undefined &&
                  (node.nodeId === highlight.focusNodeId ||
                    node.nodeId === highlight.relatedNodeId ||
                    enteredNodeSet.has(node.nodeId) ||
                    removedNodeSet.has(node.nodeId));
                const nodeKey = shouldResetAnimation
                  ? `${node.nodeId}-${highlight.stepToken}`
                  : String(node.nodeId);

                return (
                  <g
                    key={nodeKey}
                    className={classNames.join(" ")}
                    transform={`translate(${node.x} ${node.y})`}
                    data-node-id={node.nodeId}
                  >
                    <circle className="tree-node-circle bst-tree-node-circle" r={NODE_RADIUS} />
                    {node.copiedFromNodeId !== null && !isDummy ? (
                      <circle className="bst-tree-node-copy-ring" r={NODE_RADIUS + 5} />
                    ) : null}
                    <text className="tree-node-label bst-tree-node-label" y={7} textAnchor="middle">
                      {node.label}
                    </text>
                    {membership ? (
                      <g
                        className="bst-tree-node-membership"
                        transform={`translate(${-membershipWidth / 2} ${NODE_RADIUS + 14})`}
                      >
                        <rect
                          className="bst-tree-node-membership-pill"
                          width={membershipWidth}
                          height={28}
                          rx={14}
                          ry={14}
                        />
                        <text
                          className="bst-tree-node-membership-text"
                          x={membershipWidth / 2}
                          y={19}
                          textAnchor="middle"
                        >
                          {membership}
                        </text>
                      </g>
                    ) : null}
                  </g>
                );
              })}
            </g>

            {showRootLabels ? (
              <g className="bst-tree-root-labels" pointerEvents="none">
                {(() => {
                  const rootLabelOffsetByNodeId = new Map<number, number>();

                  return rootLabels.map((entry) => {
                    const root = layout.nodeById.get(entry.nodeId);
                    if (!root || !entry.label) {
                      return null;
                    }

                    const offsetIndex = rootLabelOffsetByNodeId.get(entry.nodeId) ?? 0;
                    rootLabelOffsetByNodeId.set(entry.nodeId, offsetIndex + 1);
                    const column = Math.floor(offsetIndex / ROOT_LABELS_PER_COLUMN);
                    const row = offsetIndex % ROOT_LABELS_PER_COLUMN;
                    const labelX = root.x + NODE_RADIUS + 10 + column * ROOT_LABEL_COL_STEP;
                    const labelY = CANVAS_PADDING.top - 18 + row * ROOT_LABEL_ROW_STEP;

                    return (
                      <text
                        key={`root-${entry.nodeId}`}
                        className="bst-tree-root-label"
                        x={labelX}
                        y={labelY}
                      >
                        {entry.label}
                      </text>
                    );
                  });
                })()}
              </g>
            ) : null}
          </svg>
        )}
      </Stack>
    </Paper>
  );
}
