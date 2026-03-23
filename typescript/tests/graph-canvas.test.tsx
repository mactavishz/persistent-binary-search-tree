// @vitest-environment jsdom

import { MantineProvider } from "@mantine/core";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GraphCanvas } from "../src/app/components/GraphCanvas.js";
import type { GraphRenderModel } from "../src/planar/render-model.js";

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

const MODEL: GraphRenderModel = {
  vertices: [
    { id: 0, x: 0, y: 0, label: "v0" },
    { id: 1, x: 2, y: 0, label: "v1" },
    { id: 2, x: 1, y: 2, label: "v2" }
  ],
  halfEdges: [
    { id: 0, source: 0, target: 1, twinId: 3 },
    { id: 1, source: 1, target: 2, twinId: 4 },
    { id: 2, source: 2, target: 0, twinId: 5 },
    { id: 3, source: 1, target: 0, twinId: 0 },
    { id: 4, source: 2, target: 1, twinId: 1 },
    { id: 5, source: 0, target: 2, twinId: 2 }
  ],
  faces: [
    {
      id: 0,
      isOuter: false,
      label: "F0",
      vertices: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 2 }
      ],
      centroid: { x: 1, y: 2 / 3 }
    }
  ],
  bounds: {
    minX: 0,
    maxX: 2,
    minY: 0,
    maxY: 2
  }
};

function renderCanvas() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onCanvasClick = vi.fn();

  flushSync(() => {
    root.render(
      <MantineProvider env="test" forceColorScheme="light">
        <GraphCanvas model={MODEL} queryPoints={[]} onCanvasClick={onCanvasClick} />
      </MantineProvider>
    );
  });

  return { container, root, onCanvasClick };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("GraphCanvas", () => {
  it("lets face clicks add points", () => {
    const { container, onCanvasClick } = renderCanvas();
    const face = container.querySelector(".faces path");

    expect(face).not.toBeNull();
    face?.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 200, clientY: 200 }));

    expect(onCanvasClick).toHaveBeenCalledTimes(1);
  });

  it("renders single edges without arrow markers", () => {
    const { container } = renderCanvas();
    const edges = container.querySelectorAll(".edges line");
    const markers = container.querySelectorAll("marker");

    expect(edges).toHaveLength(3);
    expect(markers).toHaveLength(0);
    expect(Array.from(edges).every((line) => line.getAttribute("marker-end") === null)).toBe(true);
  });

  it("renders label numbers in separate tspans", () => {
    const { container } = renderCanvas();
    const vertexLabel = container.querySelector(".vertex-labels text");
    const faceLabel = container.querySelector(".face-labels text");

    expect(vertexLabel?.textContent).toBe("v0");
    expect(faceLabel?.textContent).toBe("f0");

    const vertexNumber = vertexLabel?.querySelector("tspan.label-number");
    const faceNumber = faceLabel?.querySelector("tspan.label-number");

    expect(vertexNumber?.textContent).toBe("0");
    expect(faceNumber?.textContent).toBe("0");
  });
});
