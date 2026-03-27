import { Paper, Stack, Text } from "@mantine/core";
import type { JSX } from "react";

interface PersistentTreeNodeView {
  readonly nodeId: number;
  readonly copiedFromNodeId: number | null;
  readonly leftNodeId: number | null;
  readonly rightNodeId: number | null;
  readonly label: string;
}

interface PersistentTreeViewProps {
  readonly version: number;
  readonly nodes: PersistentTreeNodeView[];
  readonly summary: {
    slabName: string;
    activeEdgeLabels: string[];
    enteredEdgeLabels: string[];
    removedEdgeLabels: string[];
  };
}

function formatLabels(labels: string[]): string {
  return labels.length > 0 ? labels.join(", ") : "none";
}

export function PersistentTreeView({ version, nodes, summary }: PersistentTreeViewProps): JSX.Element {
  return (
    <Paper className="tree-panel" withBorder radius="md" p="md">
      <Stack gap={6}>
        <Text fw={500} size="sm">
          Persistent Tree Snapshot
        </Text>
        <Text size="xs" c="dimmed">
          Version {version} for {summary.slabName}. Copied nodes include their source id.
        </Text>
        <Text size="xs">
          Active edges: {formatLabels(summary.activeEdgeLabels)}
        </Text>
        <Text size="xs">
          Added edges: {formatLabels(summary.enteredEdgeLabels)}
        </Text>
        <Text size="xs">
          Removed edges: {formatLabels(summary.removedEdgeLabels)}
        </Text>
        <div className="tree-node-list">
          {nodes.map((node) => (
            <Text key={node.nodeId} size="xs" className="tree-node-item">
              n{node.nodeId}: {node.label} | L:{node.leftNodeId === null ? "-" : `n${node.leftNodeId}`} | R:
              {node.rightNodeId === null ? "-" : `n${node.rightNodeId}`}
              {node.copiedFromNodeId !== null ? ` | copy of n${node.copiedFromNodeId}` : ""}
            </Text>
          ))}
        </div>
      </Stack>
    </Paper>
  );
}
