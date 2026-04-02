import { Paper, ScrollArea, Text, Timeline } from "@mantine/core";
import type { JSX, KeyboardEvent } from "react";
import {
    EyeOpenIcon,
} from "@radix-ui/react-icons";

export interface BstOperationHistoryEntry {
  readonly version: number;
  readonly kind: "insert" | "delete";
  readonly key: number;
  readonly label: string;
}

interface BstOperationHistoryProps {
  readonly entries: readonly BstOperationHistoryEntry[];
  readonly selectedVersion: number | null;
  readonly onSelectVersion?: (version: number) => void;
}

function handleEntryKeyDown(
  event: KeyboardEvent<HTMLParagraphElement>,
  onActivate: () => void,
): void {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  onActivate();
}

export function BstOperationHistory({
  entries,
  selectedVersion,
  onSelectVersion,
}: BstOperationHistoryProps): JSX.Element {
  return (
    <Paper
      className="history-panel history-panel-bst"
      withBorder
      radius="md"
      p="md"
    >
      <Text fw={600} size="sm" mb={6}>
        Operation History
      </Text>
      <Text size="xs" c="dimmed" mb="sm">
        Timeline of version-changing operations.
      </Text>

      <ScrollArea
        className="bst-history-scroll"
        type="auto"
        scrollbarSize={5}
        style={{ height: 540 }}
        data-testid="bst-history-scroll"
      >
        {entries.length === 0 ? (
          <Text size="xs" c="dimmed">
            No insert/delete operations yet.
          </Text>
        ) : (
          <Timeline bulletSize={25} lineWidth={2}>
            {entries.map((entry) => {
              const isSelected =
                selectedVersion !== null && entry.version === selectedVersion;

              return (
                <Timeline.Item
                  lineVariant="dashed"
                  key={entry.version}
                  c={entry.kind === "insert" ? "blue" : "red"}
                  title={`V${entry.version}: ${entry.kind}`}
                  onClick={
                    onSelectVersion
                      ? () => onSelectVersion(entry.version)
                      : undefined
                  }
                  onKeyDown={
                    onSelectVersion
                      ? (event) =>
                          handleEntryKeyDown(event, () =>
                            onSelectVersion(entry.version),
                          )
                      : undefined
                  }
                  role={onSelectVersion ? "button" : undefined}
                  tabIndex={onSelectVersion ? 0 : undefined}
                  bullet={
                    selectedVersion == entry.version ? (
                      <EyeOpenIcon width={16} height={16} />
                    ) : undefined
                  }
                >
                  <Text
                    className={`bst-history-entry${isSelected ? " bst-history-entry-selected" : ""}`}
                    size="sm"
                    fw={isSelected ? 700 : 500}
                    c="dimmed"
                  >
                    key: {entry.key}
                  </Text>
                </Timeline.Item>
              );
            })}
          </Timeline>
        )}
      </ScrollArea>
    </Paper>
  );
}
