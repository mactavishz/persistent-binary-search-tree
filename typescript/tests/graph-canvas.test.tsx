// @vitest-environment jsdom

import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GraphCanvas } from "../src/app/components/GraphCanvas.js";
import type { GraphRenderModel } from "../src/planar/render-model.js";

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
    root.render(<GraphCanvas model={MODEL} queryPoints={[]} onCanvasClick={onCanvasClick} />);
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
});
