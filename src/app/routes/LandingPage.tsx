import { Button, Group, Paper, Stack, Text } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import type { JSX } from "react";

export function LandingPage(): JSX.Element {
  const navigate = useNavigate();

  return (
    <section className="landing-shell">
      <Paper className="landing-panel" withBorder radius="md" p="lg">
        <Stack gap="sm">
          <Text fw={700} size="xl">
            Choose a demo
          </Text>
          <Text c="dimmed" size="sm">
            Point Location demo focuses on planar point location using a persistent segment tree, while the the persistent BST demo focuses on step-by-step insert, remove, and query exploration.
          </Text>
          <Group mt="md" gap="sm">
            <Button type="button" onClick={() => void navigate({ to: "/planar-point-loc" })}>
              Open point-location demo
            </Button>
            <Button type="button" variant="default" onClick={() => void navigate({ to: "/persistent-bst" })}>
              Open persistent BST demo
            </Button>
          </Group>
        </Stack>
      </Paper>
    </section>
  );
}
