// @vitest-environment jsdom

import { MantineProvider } from "@mantine/core";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PersistentTreeView } from "../src/app/components/PersistentTreeView.js";

beforeAll(() => {
  if (typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false
      }))
    });
  }
});

interface TreeNodeFixture {
  readonly nodeId: number;
  readonly copiedFromNodeId: number | null;
  readonly leftNodeId: number | null;
  readonly rightNodeId: number | null;
  readonly label: string;
}

interface TreeVersionFixture {
  readonly version: number;
  readonly slabName: string;
  readonly nodes: TreeNodeFixture[];
  readonly summary: {
    activeEdgeLabels: string[];
    enteredEdgeLabels: string[];
    removedEdgeLabels: string[];
  };
}

interface RenderProps {
  readonly versions: TreeVersionFixture[];
  readonly visibleVersions?: number[];
  readonly activeVersion: number | null;
  readonly latestVersion: number | null;
}

function renderTree(props: RenderProps) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const doRender = (nextProps: RenderProps) => {
    flushSync(() => {
      root.render(
        <MantineProvider env="test" forceColorScheme="light">
          <PersistentTreeView
            versions={nextProps.versions}
            visibleVersions={nextProps.visibleVersions}
            activeVersion={nextProps.activeVersion}
            latestVersion={nextProps.latestVersion}
          />
        </MantineProvider>
      );
    });
  };

  doRender(props);

  return {
    container,
    rerender: doRender,
    unmount: () => root.unmount()
  };
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("PersistentTreeView", () => {
  it("renders an empty-state placeholder when no snapshot is available", () => {
    const { container } = renderTree({
      versions: [],
      activeVersion: null,
      latestVersion: null
    });

    expect(container.querySelector(".tree-empty-state")).not.toBeNull();
    expect(container.textContent ?? "").toContain("Step through the build to reveal persistent tree versions.");
  });

  it("renders one unified tree with overlays for all versions", () => {
    const { container } = renderTree({
      versions: [
        {
          version: 1,
          slabName: "s1",
          summary: {
            activeEdgeLabels: ["e0"],
            enteredEdgeLabels: ["e0"],
            removedEdgeLabels: []
          },
          nodes: [
            { nodeId: 1, copiedFromNodeId: null, leftNodeId: null, rightNodeId: null, label: "e0" }
          ]
        },
        {
          version: 2,
          slabName: "s2",
          summary: {
            activeEdgeLabels: ["e1"],
            enteredEdgeLabels: ["e1"],
            removedEdgeLabels: []
          },
          nodes: [
            { nodeId: 1, copiedFromNodeId: null, leftNodeId: null, rightNodeId: null, label: "e0" },
            { nodeId: 2, copiedFromNodeId: 1, leftNodeId: 1, rightNodeId: null, label: "e1" }
          ]
        }
      ],
      activeVersion: 1,
      latestVersion: 2
    });

    const unifiedCanvas = container.querySelector(".tree-unified-canvas");
    const allCanvases = container.querySelectorAll(".tree-unified-canvas");
    const allVersionEdges = container.querySelectorAll("line.tree-version-path");
    const versionTwoEdges = container.querySelectorAll('line.tree-version-path[data-version="2"]');

    expect(unifiedCanvas).not.toBeNull();
    expect(allCanvases).toHaveLength(1);
    expect(allVersionEdges.length).toBeGreaterThan(0);
    expect(versionTwoEdges.length).toBeGreaterThan(0);
    expect(container.textContent ?? "").toContain("latest");
    expect(container.textContent ?? "").toContain("current");
  });

  it("reuses a single node instance when the same edge label appears with a different node id", () => {
    const { container } = renderTree({
      versions: [
        {
          version: 1,
          slabName: "s1",
          summary: {
            activeEdgeLabels: ["e0"],
            enteredEdgeLabels: ["e0"],
            removedEdgeLabels: []
          },
          nodes: [
            { nodeId: 1, copiedFromNodeId: null, leftNodeId: null, rightNodeId: null, label: "e0" }
          ]
        },
        {
          version: 2,
          slabName: "s2",
          summary: {
            activeEdgeLabels: ["e1"],
            enteredEdgeLabels: ["e1"],
            removedEdgeLabels: []
          },
          nodes: [
            { nodeId: 9, copiedFromNodeId: 1, leftNodeId: 2, rightNodeId: null, label: "e0" },
            { nodeId: 2, copiedFromNodeId: null, leftNodeId: null, rightNodeId: null, label: "e1" }
          ]
        }
      ],
      activeVersion: 2,
      latestVersion: 2
    });

    const sharedNode = container.querySelectorAll('g.tree-node[data-node-id="1"]');
    const reuseBadges = Array.from(container.querySelectorAll('g.tree-node-reused text.tree-node-reuse')).map((entry) => entry.textContent ?? "");
    const e0Labels = Array.from(container.querySelectorAll("text.tree-node-label")).filter((entry) => (entry.textContent ?? "") === "e0");
    const membershipChips = Array.from(container.querySelectorAll("text.tree-node-membership-text")).map((entry) => entry.textContent ?? "");

    expect(sharedNode).toHaveLength(1);
    expect(e0Labels).toHaveLength(1);
    expect(reuseBadges).toContain("x2");
    expect(membershipChips).toContain("v1,v2");
  });

  it("adds a single dummy root when version roots differ", () => {
    const { container } = renderTree({
      versions: [
        {
          version: 1,
          slabName: "s1",
          summary: {
            activeEdgeLabels: ["e0"],
            enteredEdgeLabels: ["e0"],
            removedEdgeLabels: []
          },
          nodes: [{ nodeId: 1, copiedFromNodeId: null, leftNodeId: null, rightNodeId: null, label: "e0" }]
        },
        {
          version: 2,
          slabName: "s2",
          summary: {
            activeEdgeLabels: ["e1"],
            enteredEdgeLabels: ["e1"],
            removedEdgeLabels: []
          },
          nodes: [
            { nodeId: 2, copiedFromNodeId: 1, leftNodeId: null, rightNodeId: 1, label: "e1" },
            { nodeId: 1, copiedFromNodeId: null, leftNodeId: null, rightNodeId: null, label: "e0" }
          ]
        }
      ],
      activeVersion: 2,
      latestVersion: 2
    });

    const dummyRoot = container.querySelector('g.tree-node-dummy[data-node-id="-1"]');
    const dummyRootLabels = Array.from(container.querySelectorAll("g.tree-node-dummy text.tree-node-label")).map((entry) => (entry.textContent ?? "").toLowerCase());

    expect(dummyRoot).not.toBeNull();
    expect(dummyRootLabels).toContain("root");
  });

  it("reveals versions progressively while preserving node placement", () => {
    const versions: TreeVersionFixture[] = [
      {
        version: 1,
        slabName: "s1",
        summary: {
          activeEdgeLabels: ["e0"],
          enteredEdgeLabels: ["e0"],
          removedEdgeLabels: []
        },
        nodes: [{ nodeId: 1, copiedFromNodeId: null, leftNodeId: null, rightNodeId: null, label: "e0" }]
      },
      {
        version: 2,
        slabName: "s2",
        summary: {
          activeEdgeLabels: ["e1"],
          enteredEdgeLabels: ["e1"],
          removedEdgeLabels: []
        },
        nodes: [
          { nodeId: 1, copiedFromNodeId: null, leftNodeId: null, rightNodeId: null, label: "e0" },
          { nodeId: 2, copiedFromNodeId: 1, leftNodeId: 1, rightNodeId: null, label: "e1" }
        ]
      }
    ];

    const { container, rerender } = renderTree({
      versions,
      visibleVersions: [1],
      activeVersion: 1,
      latestVersion: 1
    });

    const labelsBefore = Array.from(container.querySelectorAll("text.tree-node-label")).map((entry) => entry.textContent ?? "");
    const membershipBefore = Array.from(container.querySelectorAll("text.tree-node-membership-text")).map((entry) => entry.textContent ?? "");
    const e0NodeBefore = container.querySelector('g.tree-node[data-node-id="1"]');
    const e0BeforeTransform = e0NodeBefore?.getAttribute("transform") ?? null;

    expect(container.querySelectorAll(".tree-unified-canvas")).toHaveLength(1);
    expect(container.textContent ?? "").toContain("v1");
    expect(container.textContent ?? "").not.toContain("v2");
    expect(container.querySelector('line.tree-version-path[data-version="2"]')).toBeNull();
    expect(labelsBefore).toContain("e0");
    expect(labelsBefore).not.toContain("e1");
    expect(membershipBefore).toContain("v1");
    expect(membershipBefore).not.toContain("v1,v2");

    rerender({
      versions,
      visibleVersions: [1, 2],
      activeVersion: 2,
      latestVersion: 2
    });

    const labelsAfter = Array.from(container.querySelectorAll("text.tree-node-label")).map((entry) => entry.textContent ?? "");
    const membershipAfter = Array.from(container.querySelectorAll("text.tree-node-membership-text")).map((entry) => entry.textContent ?? "");
    const e0NodeAfter = container.querySelector('g.tree-node[data-node-id="1"]');
    const e0AfterTransform = e0NodeAfter?.getAttribute("transform") ?? null;

    expect(container.querySelectorAll(".tree-unified-canvas")).toHaveLength(1);
    expect(container.textContent ?? "").toContain("v2");
    expect(container.querySelector('line.tree-version-path[data-version="2"]')).not.toBeNull();
    expect(labelsAfter).toContain("e0");
    expect(labelsAfter).toContain("e1");
    expect(membershipAfter).toContain("v1,v2");
    expect(e0AfterTransform).toBe(e0BeforeTransform);
  });

  it("highlights active-version updates and copy pointers on the unified tree", () => {
    const { container } = renderTree({
      versions: [
        {
          version: 4,
          slabName: "s4",
          summary: {
            activeEdgeLabels: ["e4"],
            enteredEdgeLabels: ["e2"],
            removedEdgeLabels: ["e9"]
          },
          nodes: [
            { nodeId: 0, copiedFromNodeId: null, leftNodeId: null, rightNodeId: null, label: "e0" },
            { nodeId: 1, copiedFromNodeId: 0, leftNodeId: 2, rightNodeId: 3, label: "e4" },
            { nodeId: 2, copiedFromNodeId: 7, leftNodeId: null, rightNodeId: null, label: "e2" },
            { nodeId: 3, copiedFromNodeId: null, leftNodeId: null, rightNodeId: null, label: "e9" }
          ]
        }
      ],
      activeVersion: 4,
      latestVersion: 4
    });

    const addedNode = container.querySelector('g.tree-node-added[data-node-id="2"]');
    const removedNode = container.querySelector('g.tree-node-removed[data-node-id="3"]');
    const activeNode = container.querySelector('g.tree-node-active-version[data-node-id="2"]');
    const copyEdge = container.querySelector("line.tree-copy-edge");
    const nodeLabels = Array.from(container.querySelectorAll("text.tree-node-label")).map((entry) => entry.textContent ?? "");

    expect(addedNode).not.toBeNull();
    expect(removedNode).not.toBeNull();
    expect(activeNode).not.toBeNull();
    expect(copyEdge).not.toBeNull();
    expect(nodeLabels).toContain("e4");
    expect(nodeLabels).toContain("e2");
    expect(nodeLabels.some((label) => /^n\d+$/i.test(label))).toBe(false);
    expect(container.textContent ?? "").toContain("added e2");
    expect(container.textContent ?? "").toContain("removed e9");
  });
});
