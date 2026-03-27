import { Button, Group, Paper, Select } from "@mantine/core";
import type { JSX } from "react";

const DEMO_OPTIONS = [
  { value: "planar_1.obj", label: "plane graph I" },
  { value: "planar_2.obj", label: "plane graph II" },
  { value: "planar_3.obj", label: "plane graph III" },
  { value: "custom", label: "custom" }
] as const;

export type DemoModel = (typeof DEMO_OPTIONS)[number]["value"];

interface ControlsProps {
  readonly demo: DemoModel;
  readonly canStart: boolean;
  readonly canClear: boolean;
  readonly onDemoChange: (demo: DemoModel) => void;
  readonly onStart: () => void;
  readonly onClearPoints: () => void;
}

export function Controls({
  demo,
  canStart,
  canClear,
  onDemoChange,
  onStart,
  onClearPoints
}: ControlsProps): JSX.Element {
  return (
    <Paper className="controls-panel" withBorder radius="md" p="md">
      <Group align="flex-end" gap="sm" wrap="wrap">
        <Select
          label="Presets"
          data={DEMO_OPTIONS}
          description="Select a preset graph to load."
          value={demo}
          allowDeselect={false}
          w={220}
          onChange={(value) => {
            if (value !== null) {
              onDemoChange(value as DemoModel);
            }
          }}
        />

      </Group>
      <Group mt="md" align="flex-end" gap="sm" wrap="wrap">
        <Button type="button" onClick={onStart} disabled={!canStart}>
          Start
        </Button>

        <Button type="button" variant="default" onClick={onClearPoints} disabled={!canClear}>
          Reset
        </Button>
        </Group>
    </Paper>
  );
}
