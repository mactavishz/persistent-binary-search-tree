import { describe, expect, it } from "vitest";
import { PartialPersistentBinarySearchTree } from "../src/persistent/partial-persistent-bst.js";
import {
  buildBstVisualizerRun,
  collectSnapshotSeries
} from "../src/app/routes/bst/bst-visualizer.js";

describe("buildBstVisualizerRun", () => {
  it("builds playback frames for insert traces", () => {
    const tree = new PartialPersistentBinarySearchTree<number>();
    tree.insert([8, 4, 12]);

    const trace = tree.traceInsert(6);
    const snapshots = collectSnapshotSeries(tree);

    const run = buildBstVisualizerRun({
      trace,
      snapshots,
      queryVersion: null
    });

    expect(run.frames.length).toBeGreaterThan(0);
    expect(run.frames.some((frame) => frame.stepperPhase === "Modify")).toBe(true);
    const lastFrame = run.frames[run.frames.length - 1]!;
    expect(lastFrame.latestVersion).toBe(tree.getLatestVersion());
    expect(lastFrame.treeVersions.length).toBe(snapshots.length);
  });

  it("keeps all versions visible for historical queries", () => {
    const tree = new PartialPersistentBinarySearchTree<number>();
    tree.insert(8);
    tree.insert(4);
    tree.insert(12);

    const trace = tree.traceSearchExact(4, 1);
    const snapshots = collectSnapshotSeries(tree);

    const run = buildBstVisualizerRun({
      trace,
      snapshots,
      queryVersion: 1
    });

    expect(run.frames.length).toBeGreaterThan(0);
    expect(run.frames.every((frame) => frame.visibleVersions.length === snapshots.length)).toBe(true);
  });
});
