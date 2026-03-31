import { Paper, Text } from "@mantine/core";
import type { JSX } from "react";
import type { BstVisualizerFrame } from "./bst-visualizer.js";

interface BstStepDetailsProps {
  readonly frame: BstVisualizerFrame;
}

export function BstStepDetails({ frame }: BstStepDetailsProps): JSX.Element {
  return (
    <Paper className="step-details-panel" withBorder radius="md" p="md">
      <Text fw={500} size="sm">
        {frame.title}
      </Text>
      <Text size="xs" c="dimmed" mt={2}>
        {frame.detail}
      </Text>
      {frame.detailLines.map((line) => (
        <Text key={line} size="xs" mt={2}>
          {line}
        </Text>
      ))}
      <Text size="xs" mt="xs">
        Phase: {frame.stepperPhase}
      </Text>
      {frame.activeVersion !== null ? (
        <Text size="xs" mt={2}>
          Active version: v{frame.activeVersion}
        </Text>
      ) : null}
    </Paper>
  );
}
