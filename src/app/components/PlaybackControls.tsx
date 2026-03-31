import { ActionIcon, Group, Paper, Slider, Stepper, Text } from "@mantine/core";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
  ReloadIcon
} from "@radix-ui/react-icons";
import type { JSX } from "react";

interface PlaybackControlsProps {
  readonly currentStep: number;
  readonly totalSteps: number;
  readonly isPlaying: boolean;
  readonly speed: number;
  readonly phases: readonly string[];
  readonly activePhase: string;
  readonly onPlayPause: () => void;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  readonly onRestart: () => void;
  readonly onStepChange: (step: number) => void;
  readonly onSpeedChange: (speed: number) => void;
}

function activeIndex(phases: readonly string[], phase: string): number {
  const index = phases.findIndex((value) => value === phase);
  return index < 0 ? 0 : index;
}

export function PlaybackControls(props: PlaybackControlsProps): JSX.Element {
  return (
    <Paper className="playback-panel" withBorder radius="md" p="md">
      <Text fw={500} size="sm" mb="xs">
        Step Playback
      </Text>

      <Stepper
        active={activeIndex(props.phases, props.activePhase)}
        size="xs"
        allowNextStepsSelect={false}
        className="playback-stepper"
      >
        {props.phases.map((phase) => (
          <Stepper.Step key={phase} label={phase} />
        ))}
      </Stepper>

      <Group mt="sm" gap="xs" wrap="wrap">
        <ActionIcon type="button" variant="default" aria-label="restart" onClick={props.onRestart}>
          <ReloadIcon width={16} height={16} />
        </ActionIcon>
        <ActionIcon type="button" variant="default" aria-label="previous" onClick={props.onPrevious}>
          <ChevronLeftIcon width={16} height={16} />
        </ActionIcon>
        <ActionIcon type="button" aria-label="play-pause" onClick={props.onPlayPause}>
          {props.isPlaying ? <PauseIcon width={16} height={16} /> : <PlayIcon width={16} height={16} />}
        </ActionIcon>
        <ActionIcon type="button" variant="default" aria-label="next" onClick={props.onNext}>
          <ChevronRightIcon width={16} height={16} />
        </ActionIcon>
        <Text c="dimmed" size="xs">
          Step {Math.min(props.currentStep + 1, props.totalSteps)} / {props.totalSteps}
        </Text>
      </Group>

      <Text size="xs" mt="sm" mb={4}>
        Timeline
      </Text>
      <Slider
        min={0}
        max={Math.max(0, props.totalSteps - 1)}
        value={Math.min(props.currentStep, Math.max(0, props.totalSteps - 1))}
        onChange={props.onStepChange}
        label={(value) => `${value + 1}`}
      />

      <Text size="xs" mt="sm" mb={4}>
        Speed ({props.speed.toFixed(1)}x)
      </Text>
      <Slider
        min={0.5}
        max={4}
        step={0.1}
        value={props.speed}
        onChange={props.onSpeedChange}
        label={(value) => `${value.toFixed(1)}x`}
      />
    </Paper>
  );
}
