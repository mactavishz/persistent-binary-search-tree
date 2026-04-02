// @vitest-environment jsdom

import { MantineProvider } from "@mantine/core";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BstOperationHistory,
  type BstOperationHistoryEntry,
} from "../src/app/routes/bst/BstOperationHistory.js";

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
        dispatchEvent: () => false,
      })),
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
      value: ResizeObserverMock,
    });
  }
});

const ENTRIES: BstOperationHistoryEntry[] = [
  { version: 0, kind: "insert", key: 25, label: "V0: Insert 25" },
  { version: 1, kind: "delete", key: 30, label: "V1: Delete 30" },
  { version: 2, kind: "insert", key: 40, label: "V2: Insert 40" },
];

function renderHistory(props: {
  readonly entries: readonly BstOperationHistoryEntry[];
  readonly selectedVersion?: number | null;
  readonly onSelectVersion?: (version: number) => void;
}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onSelectVersionProp =
    props.onSelectVersion === undefined
      ? {}
      : { onSelectVersion: props.onSelectVersion };

  flushSync(() => {
    root.render(
      <MantineProvider env="test" forceColorScheme="light">
        <BstOperationHistory
          entries={props.entries}
          selectedVersion={props.selectedVersion ?? null}
          {...onSelectVersionProp}
        />
      </MantineProvider>,
    );
  });

  return {
    container,
    unmount: () => root.unmount(),
  };
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("BstOperationHistory", () => {
  it("shows empty state when there are no operations", () => {
    const { container } = renderHistory({ entries: [] });

    expect(container.textContent ?? "").toContain("No insert/delete operations yet.");
  });

  it("renders entries in oldest-to-newest timeline order", () => {
    const { container } = renderHistory({ entries: ENTRIES });

    const text = container.textContent ?? "";
    const first = text.indexOf("V0: Insert 25");
    const second = text.indexOf("V1: Delete 30");
    const third = text.indexOf("V2: Insert 40");

    expect(first).toBeGreaterThanOrEqual(0);
    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
  });

  it("renders a fixed-height scroll area", () => {
    const { container } = renderHistory({ entries: ENTRIES });

    const scrollArea = container.querySelector('[data-testid="bst-history-scroll"]');
    expect(scrollArea).not.toBeNull();
    expect(scrollArea?.getAttribute("style") ?? "").toContain("height: 540px");
  });

  it("supports selecting a version from timeline entries", () => {
    const onSelectVersion = vi.fn();
    const { container } = renderHistory({
      entries: ENTRIES,
      selectedVersion: 1,
      onSelectVersion,
    });

    const entries = container.querySelectorAll(".bst-history-entry");
    entries[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onSelectVersion).toHaveBeenCalledTimes(1);
    expect(onSelectVersion).toHaveBeenCalledWith(0);
    expect(container.querySelectorAll(".bst-history-entry-selected")).toHaveLength(1);
  });
});
