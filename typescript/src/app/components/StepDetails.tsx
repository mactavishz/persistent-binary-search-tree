import { Paper, Text } from "@mantine/core";
import type { JSX } from "react";
import type { VisualizerFrame } from "../visualizer/trace-to-frames.js";

interface StepDetailsProps {
  readonly frame: VisualizerFrame;
}

function detailLineClassName(line: string): string {
  if (line.startsWith("Added edges:")) {
    return "step-detail-added";
  }
  if (line.startsWith("Removed edges:")) {
    return "step-detail-removed";
  }
  return "";
}

export function StepDetails({ frame }: StepDetailsProps): JSX.Element {
  return (
    <Paper className="step-details-panel" withBorder radius="md" p="md">
      <Text fw={500} size="sm">
        {frame.title}
      </Text>
      <Text size="xs" c="dimmed" mt={2}>
        {frame.detail}
      </Text>
      {frame.detailLines.map((line) => (
        <Text key={line} size="xs" mt={2} className={detailLineClassName(line)}>
          {line}
        </Text>
      ))}
      <Text size="xs" mt="xs">
        Phase: {frame.stepperPhase}
      </Text>
      {frame.activeSlabName ? (
        <Text size="xs" mt={2}>
          Active slab: {frame.activeSlabName}
        </Text>
      ) : null}
      {frame.activePointName ? (
        <Text size="xs" mt={2}>
          Active point: {frame.activePointName}
        </Text>
      ) : null}
    </Paper>
  );
}
