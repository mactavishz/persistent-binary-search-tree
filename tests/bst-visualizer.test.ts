import { describe, expect, it } from "vitest";
import { PartialPersistentBinarySearchTree } from "../src/persistent/partial-persistent-bst.js";
import {
  buildBstVisualizerRun,
  collectSnapshotSeries
} from "../src/app/routes/bst/BstVisualizer.js";

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
    expect(lastFrame.memoryGraph.versions.length).toBe(snapshots.length);
    expect(lastFrame.memoryGraph.nodes.length).toBeGreaterThan(0);
    expect(Array.isArray(lastFrame.highlight.activeNodeIds)).toBe(true);
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

  it("captures copy edges when path-copy cloning occurs", () => {
    const tree = new PartialPersistentBinarySearchTree<number>();
    tree.insert(8);
    tree.insert(4);
    tree.delete(4);

    const trace = tree.traceInsert(12);
    const snapshots = collectSnapshotSeries(tree);

    const run = buildBstVisualizerRun({
      trace,
      snapshots,
      queryVersion: null
    });

    expect(trace.events.some((event) => event.phase === "clone")).toBe(true);
    expect(run.frames.some((frame) => frame.memoryGraph.copyEdges.length > 0)).toBe(true);
  });

  it("keeps compare-step links consistent for historical queries after later root copies", () => {
    const tree = new PartialPersistentBinarySearchTree<number>();
    tree.insert([20, 10, 30]);
    tree.traceInsert(25);
    tree.traceDelete(30);

    const trace = tree.traceSearchExact(30, 3);
    const snapshots = collectSnapshotSeries(tree);
    const run = buildBstVisualizerRun({
      trace,
      snapshots,
      queryVersion: 3
    });

    const compareFrames = run.frames.filter(
      (frame) =>
        frame.highlight.phase === "compare" &&
        frame.highlight.focusNodeId !== null &&
        frame.highlight.relatedNodeId !== null
    );

    expect(compareFrames.length).toBeGreaterThan(0);
    for (const frame of compareFrames) {
      const focusNodeId = frame.highlight.focusNodeId;
      const relatedNodeId = frame.highlight.relatedNodeId;
      const isLinked = frame.memoryGraph.edges.some(
        (edge) => edge.fromNodeId === focusNodeId && edge.toNodeId === relatedNodeId
      );

      expect(isLinked).toBe(true);
    }
  });
});
