import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { RootLayout } from "./routes/RootLayout.js";
import { LandingPage } from "./routes/LandingPage.js";
import { PlanarDemoPage } from "./routes/planar/PlanarDemoPage.js";
import { BstDemoPage } from "./routes/bst/BstDemoPage.js";

const rootRoute = createRootRoute({
  component: RootLayout
});

const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LandingPage
});

const planarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/planar",
  component: PlanarDemoPage
});

const bstRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bst",
  component: BstDemoPage
});

const routeTree = rootRoute.addChildren([landingRoute, planarRoute, bstRoute]);

export function createAppRouter() {
  return createRouter({
    routeTree,
    defaultPreload: "intent"
  });
}

export const router = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
