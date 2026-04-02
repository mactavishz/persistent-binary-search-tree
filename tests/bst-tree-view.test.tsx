// @vitest-environment jsdom

import { MantineProvider } from "@mantine/core";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { BstTreeView } from "../src/app/routes/bst/BstTreeView.js";
import type { BstMemoryGraph, BstStepHighlight } from "../src/app/routes/bst/BstVisualizer.js";

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

const EMPTY_HIGHLIGHT: BstStepHighlight = {
  focusNodeId: null,
  relatedNodeId: null,
  activeNodeIds: [],
  enteredNodeIds: [],
  removedNodeIds: []
};

interface RenderProps {
  readonly memoryGraph: BstMemoryGraph;
  readonly highlight?: BstStepHighlight;
  readonly activeVersion?: number | null;
  readonly latestVersion?: number | null;
  readonly selectedVersion?: number | null;
  readonly onSelectVersion?: (version: number) => void;
}

function renderTree(props: RenderProps) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onSelectVersionProp =
    props.onSelectVersion === undefined ? {} : { onSelectVersion: props.onSelectVersion };

  flushSync(() => {
    root.render(
      <MantineProvider env="test" forceColorScheme="light">
        <BstTreeView
          memoryGraph={props.memoryGraph}
          highlight={props.highlight ?? EMPTY_HIGHLIGHT}
          activeVersion={props.activeVersion ?? null}
          latestVersion={props.latestVersion ?? null}
          selectedVersion={props.selectedVersion ?? null}
          {...onSelectVersionProp}
        />
      </MantineProvider>
    );
  });

  return {
    container,
    unmount: () => root.unmount()
  };
}

function fixtureGraph(): BstMemoryGraph {
  return {
    versions: [1, 2, 3],
    nodes: [
      { nodeId: 1, key: 20, label: "20", copiedFromNodeId: null, versions: [1, 2] },
      { nodeId: 2, key: 10, label: "10", copiedFromNodeId: null, versions: [1, 2, 3] },
      { nodeId: 3, key: 20, label: "20", copiedFromNodeId: 1, versions: [3] }
    ],
    edges: [
      { key: "1->2", fromNodeId: 1, toNodeId: 2, versions: [1, 2] },
      { key: "3->2", fromNodeId: 3, toNodeId: 2, versions: [3] }
    ],
    copyEdges: [{ key: "1=>3", fromNodeId: 1, toNodeId: 3, versions: [3] }],
    rootByVersion: new Map([
      [1, 1],
      [2, 1],
      [3, 3]
    ])
  };
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("BstTreeView", () => {
  it("renders an empty-state placeholder when memory graph has no nodes", () => {
    const { container } = renderTree({
      memoryGraph: {
        versions: [],
        nodes: [],
        edges: [],
        copyEdges: [],
        rootByVersion: new Map()
      }
    });

    expect(container.querySelector(".tree-empty-state")).not.toBeNull();
    expect(container.textContent ?? "").toContain("Run an operation to build the persistent tree memory graph.");
  });

  it("renders only the selected version tree", () => {
    const { container } = renderTree({
      memoryGraph: fixtureGraph(),
      selectedVersion: 2,
      activeVersion: 2,
      latestVersion: 3
    });

    expect(container.querySelector('g[data-node-id="-1"]')).not.toBeNull();
    expect(container.querySelector('g[data-node-id="1"]')).not.toBeNull();
    expect(container.querySelector('g[data-node-id="3"]')).toBeNull();

    const labels20 = Array.from(container.querySelectorAll("text.bst-tree-node-label")).filter(
      (element) => (element.textContent ?? "") === "20"
    );
    expect(labels20).toHaveLength(1);

    expect(container.querySelectorAll("line.bst-tree-copy-edge")).toHaveLength(0);

    const membershipTexts = Array.from(
      container.querySelectorAll("text.bst-tree-node-membership-text")
    ).map((element) => element.textContent ?? "");

    expect(membershipTexts).toContain("v1,v2");
    expect(membershipTexts).toContain("v1-v3");
  });

  it("switches structure by selected version", () => {
    const { container } = renderTree({
      memoryGraph: fixtureGraph(),
      selectedVersion: 1,
      latestVersion: 3
    });

    expect(container.querySelector('g[data-node-id="1"]')).not.toBeNull();
    expect(container.querySelector('g[data-node-id="2"]')).not.toBeNull();
    expect(container.querySelector('g[data-node-id="3"]')).toBeNull();

    const selectedOneEdges = container.querySelectorAll("line.bst-tree-edge-base");
    expect(selectedOneEdges.length).toBeGreaterThan(0);
  });

  it("applies node highlights by nodeId", () => {
    const highlight: BstStepHighlight = {
      focusNodeId: 3,
      relatedNodeId: 2,
      activeNodeIds: [3, 2],
      enteredNodeIds: [3],
      removedNodeIds: [],
      phase: "compare",
      direction: "left",
      stepToken: "compare-3-2"
    };

    const { container } = renderTree({
      memoryGraph: fixtureGraph(),
      highlight,
      activeVersion: 3,
      latestVersion: 3
    });

    const focusNodeClass =
      container.querySelector('g[data-node-id="3"]')?.getAttribute("class") ?? "";
    const relatedNodeClass =
      container.querySelector('g[data-node-id="2"]')?.getAttribute("class") ?? "";

    expect(focusNodeClass).toContain("tree-node-focus-step");
    expect(focusNodeClass).toContain("tree-node-added");
    expect(relatedNodeClass).toContain("tree-node-related-step");
    expect(container.querySelector("line.tree-step-edge-left")).not.toBeNull();
  });

  it("supports clickable version badges and marks current-version-only edges", () => {
    const onSelectVersion = vi.fn();
    const { container } = renderTree({
      memoryGraph: fixtureGraph(),
      selectedVersion: 3,
      latestVersion: 3,
      onSelectVersion
    });

    const badges = Array.from(container.querySelectorAll(".bst-tree-version-badge"));
    expect(badges.length).toBeGreaterThan(0);

    badges[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onSelectVersion).toHaveBeenCalledTimes(1);

    expect(container.querySelector('g[data-node-id="1"]')).not.toBeNull();
    expect(container.querySelector('g[data-node-id="2"]')).not.toBeNull();
    expect(container.querySelector('g[data-node-id="3"]')).not.toBeNull();

    const node1Class = container.querySelector('g[data-node-id="1"]')?.getAttribute("class") ?? "";
    const node2Class = container.querySelector('g[data-node-id="2"]')?.getAttribute("class") ?? "";
    const node3Class = container.querySelector('g[data-node-id="3"]')?.getAttribute("class") ?? "";

    expect(node1Class).not.toContain("bst-tree-node-current-version");
    expect(node2Class).toContain("bst-tree-node-current-version");
    expect(node3Class).toContain("bst-tree-node-current-version");

    expect(container.querySelectorAll("line.bst-tree-edge-current-version").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("line.bst-tree-edge-current-only").length).toBeGreaterThan(0);
  });
});
