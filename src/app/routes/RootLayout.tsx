import { MantineProvider, Paper, SegmentedControl, Stack, Text } from "@mantine/core";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import type { JSX } from "react";
import { theme } from "../../theme.js";
import "@mantine/core/styles.css";
import "../styles.css";

const NAV_ITEMS = [
  { label: "Persistent BST", value: "/bst" },
  { label: "Point Location", value: "/planar" }
] as const;

type RoutePath = (typeof NAV_ITEMS)[number]["value"];

function activePath(pathname: string): RoutePath {
  if (pathname.startsWith("/bst")) {
    return "/bst";
  }
  if (pathname.startsWith("/planar")) {
    return "/planar";
  }
  return "/";
}

export function RootLayout(): JSX.Element {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <MantineProvider theme={theme}>
      <main className="app-root-shell">
        <Paper className="route-switcher" withBorder radius="md" p="md">
          <Stack gap={8}>
            <Text fw={700} size="lg">
              Persistent Binary Search Tree and Planar Point Location
            </Text>
            <Text c="dimmed" size="sm">
              Explore two algorithm demos side by side through dedicated pages with step playback.
            </Text>
            <SegmentedControl
              data={[...NAV_ITEMS]}
              value={activePath(pathname)}
              onChange={(value) => {
                void navigate({ to: value as RoutePath });
              }}
            />
          </Stack>
        </Paper>
        <Outlet />
      </main>
    </MantineProvider>
  );
}
