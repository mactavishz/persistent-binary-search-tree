// @vitest-environment jsdom

import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { RouterProvider } from "@tanstack/react-router";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createAppRouter } from "../src/app/router.js";

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

  if (typeof ResizeObserver === "undefined") {
    class ResizeObserverMock {
      observe(): void {
        // no-op for jsdom tests
      }

      unobserve(): void {
        // no-op for jsdom tests
      }

      disconnect(): void {
        // no-op for jsdom tests
      }
    }

    Object.defineProperty(globalThis, "ResizeObserver", {
      writable: true,
      value: ResizeObserverMock
    });
  }
});

async function renderPath(path: string) {
  window.history.pushState({}, "", path);
  const router = createAppRouter();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  flushSync(() => {
    root.render(<RouterProvider router={router} />);
  });

  await router.load();

  return { container, root };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("router shell", () => {
  it("renders landing page at root", async () => {
    const { container } = await renderPath("/");

    expect(container.textContent ?? "").toContain("Choose a demo");
    expect(container.textContent ?? "").toContain("Point Location");
  });

  it("renders persistent BST page at /persistent-bst", async () => {
    const { container } = await renderPath("/persistent-bst");

    expect(container.textContent ?? "").toContain("Start");
    expect(container.textContent ?? "").toContain("Persistent BST");
    expect(container.textContent ?? "").not.toContain("Step Playback");
  });
});
