import type { GraphRenderModel } from "../../planar/render-model.js";
import type {
  PointLocationBuildResult,
  PointLocationResult,
  PointLocationTraceResult,
  QueryPoint
} from "../../planar/point-location.js";

export interface FrameResultRow {
  readonly name: string;
  readonly slab: string;
  readonly face: string;
  readonly status: "pending" | "active" | "done";
}

export interface VisualizerFrame {
  readonly id: string;
  readonly phase: "build" | "query";
  readonly stepperPhase: "Build slabs" | "Update tree" | "Locate slab" | "Search edges" | "Resolve face";
  readonly title: string;
  readonly detail: string;
  readonly detailLines: string[];
  readonly slabLines: Array<{ name: string; start: number; end: number }>;
  readonly edgeHighlights: Array<{ edgeId: number; kind: "active" | "added" | "removed" | "search" }>;
  readonly highlightedEdgeIds: number[];
  readonly highlightedFaceId: number | null;
  readonly activeSlabName: string | null;
  readonly activePointName: string | null;
  readonly activePointCoords: { x: number; y: number } | null;
  readonly treeSnapshotVersion: number | null;
  readonly treeSnapshotNodes:
    | Array<{
        nodeId: number;
        copiedFromNodeId: number | null;
        leftNodeId: number | null;
        rightNodeId: number | null;
        label: string;
      }>
    | null;
  readonly treeSnapshotSummary:
    | {
        slabName: string;
        activeEdgeLabels: string[];
        enteredEdgeLabels: string[];
        removedEdgeLabels: string[];
      }
    | null;
  readonly rows: FrameResultRow[];
}

export interface VisualizerRun {
  readonly frames: VisualizerFrame[];
}

interface QueryBundle {
  readonly point: QueryPoint;
  readonly trace: PointLocationTraceResult;
  readonly result: PointLocationResult;
}

function pointName(point: QueryPoint, index: number): string {
  return point.name ?? `p${index}`;
}

function toRows(points: QueryPoint[], traces: QueryBundle[], activePointName: string | null): FrameResultRow[] {
  const resolved = new Map<string, PointLocationResult>();
  for (let i = 0; i < traces.length; i += 1) {
    const trace = traces[i]!;
    resolved.set(pointName(trace.point, i), trace.result);
  }

  return points.map((point, index) => {
    const name = pointName(point, index);
    const result = resolved.get(name);
    if (!result) {
      return {
        name,
        slab: "-",
        face: "-",
        status: activePointName === name ? "active" : "pending"
      };
    }
    return {
      name,
      slab: result.slabName,
      face: result.faceName,
      status: activePointName === name ? "active" : "done"
    };
  });
}

function snapshotLabel(value: unknown): string {
  if (typeof value === "object" && value !== null && "edgeId" in value) {
    const edgeId = (value as { edgeId?: unknown }).edgeId;
    if (typeof edgeId === "number") {
      return `e${edgeId}`;
    }
  }
  return "node";
}

function edgeLabel(edgeId: number): string {
  return `e${edgeId}`;
}

function formatCoord(value: number): string {
  if (value === Infinity) {
    return "+inf";
  }
  if (value === -Infinity) {
    return "-inf";
  }
  return value.toFixed(3);
}

function formatEdgeList(edgeIds: readonly number[]): string[] {
  return edgeIds.map((edgeId) => edgeLabel(edgeId));
}

function formatEdgeListText(edgeIds: readonly number[]): string {
  const labels = formatEdgeList(edgeIds);
  return labels.length > 0 ? labels.join(", ") : "none";
}

function formatSlabRange(start: number, end: number): string {
  return `x in [${formatCoord(start)}, ${formatCoord(end)}]`;
}

function formatResolvedFaceName(classification: "inside" | "outer" | "boundary", faceId: number | null): string {
  if (classification === "boundary") {
    return "boundary";
  }
  if (classification === "outer") {
    return "outerFace";
  }
  return faceId === null ? "inside" : `F${faceId}`;
}

function buildEdgeHighlights(params: {
  readonly activeEdgeIds?: readonly number[];
  readonly addedEdgeIds?: readonly number[];
  readonly removedEdgeIds?: readonly number[];
  readonly searchEdgeIds?: readonly number[];
}): Array<{ edgeId: number; kind: "active" | "added" | "removed" | "search" }> {
  const highlights = new Map<number, "active" | "added" | "removed" | "search">();

  for (const edgeId of params.activeEdgeIds ?? []) {
    highlights.set(edgeId, "active");
  }
  for (const edgeId of params.addedEdgeIds ?? []) {
    highlights.set(edgeId, "added");
  }
  for (const edgeId of params.removedEdgeIds ?? []) {
    highlights.set(edgeId, "removed");
  }
  for (const edgeId of params.searchEdgeIds ?? []) {
    highlights.set(edgeId, "search");
  }

  return Array.from(highlights, ([edgeId, kind]) => ({ edgeId, kind }));
}

export function buildVisualizerRun(params: {
  readonly model: GraphRenderModel;
  readonly build: PointLocationBuildResult;
  readonly points: QueryPoint[];
  readonly queryTraces: QueryBundle[];
}): VisualizerRun {
  const { build, points, queryTraces } = params;
  const frames: VisualizerFrame[] = [];

  // These arrays/maps are intentionally accumulated once and reused for all later frames,
  // so playback can scrub without recomputing historical slab context.
  const slabLines: Array<{ name: string; start: number; end: number }> = [];
  const resolvedSoFar: QueryBundle[] = [];
  const slabByStart = new Map<number, { name: string; start: number; end: number; version: number }>();
  const slabByVersion = new Map<number, { name: string; start: number; end: number; version: number }>();

  const slabNameFromStart = (start: number): string => slabByStart.get(start)?.name ?? `start ${formatCoord(start)}`;
  const slabNameFromVersion = (version: number | null): string | null => {
    if (version === null) {
      return null;
    }
    return slabByVersion.get(version)?.name ?? `s${version}`;
  };

  for (const step of build.trace.slabSteps) {
    slabByStart.set(step.slab.start, {
      name: step.slab.name,
      start: step.slab.start,
      end: step.slab.end,
      version: step.slab.version
    });
    slabByVersion.set(step.slab.version, {
      name: step.slab.name,
      start: step.slab.start,
      end: step.slab.end,
      version: step.slab.version
    });

    slabLines.push({
      name: step.slab.name,
      start: step.slab.start,
      end: step.slab.end
    });
    frames.push({
      id: `build-${step.slab.name}`,
      phase: "build",
      stepperPhase: step.enteredEdgeIds.length > 0 || step.leftEdgeIds.length > 0 ? "Update tree" : "Build slabs",
      title: `Construct ${step.slab.name}`,
      detail: `${step.slab.name} covers ${formatSlabRange(step.slab.start, step.slab.end)}.`,
      detailLines: [
        `Active edges: ${formatEdgeListText(step.activeEdgeIds)}`,
        `Added edges: ${formatEdgeListText(step.enteredEdgeIds)}`,
        `Removed edges: ${formatEdgeListText(step.leftEdgeIds)}`
      ],
      slabLines: [...slabLines],
      edgeHighlights: buildEdgeHighlights({
        activeEdgeIds: step.enteredEdgeIds.length === 0 && step.leftEdgeIds.length === 0 ? step.activeEdgeIds : [],
        addedEdgeIds: step.enteredEdgeIds,
        removedEdgeIds: step.leftEdgeIds
      }),
      highlightedEdgeIds:
        step.enteredEdgeIds.length > 0 || step.leftEdgeIds.length > 0
          ? Array.from(new Set([...step.enteredEdgeIds, ...step.leftEdgeIds]))
          : step.activeEdgeIds,
      highlightedFaceId: null,
      activeSlabName: step.slab.name,
      activePointName: null,
      activePointCoords: null,
      treeSnapshotVersion: step.slab.version,
      treeSnapshotNodes:
        step.snapshot?.nodes.map((node) => ({
          nodeId: node.nodeId,
          copiedFromNodeId: node.copiedFromNodeId,
          leftNodeId: node.left?.nodeId ?? null,
          rightNodeId: node.right?.nodeId ?? null,
          label: snapshotLabel(node.value)
        })) ?? null,
      treeSnapshotSummary: {
        slabName: step.slab.name,
        activeEdgeLabels: formatEdgeList(step.activeEdgeIds),
        enteredEdgeLabels: formatEdgeList(step.enteredEdgeIds),
        removedEdgeLabels: formatEdgeList(step.leftEdgeIds)
      },
      rows: toRows(points, resolvedSoFar, null)
    });
  }

  for (let i = 0; i < queryTraces.length; i += 1) {
    const query = queryTraces[i]!;
    const name = pointName(query.point, i);

    for (const event of query.trace.events) {
      let stepperPhase: VisualizerFrame["stepperPhase"] = "Locate slab";
      let title = `Query ${name}`;
      let detail = "";
      let detailLines: string[] = [];
      let highlightedEdgeIds: number[] = [];
      let edgeHighlights: VisualizerFrame["edgeHighlights"] = [];
      let highlightedFaceId: number | null = null;
      let activeSlabName: string | null = null;
      let treeSnapshotVersion: number | null = null;

      if (event.kind === "boundary-check") {
        stepperPhase = "Locate slab";
        title = `Boundary check for ${name}`;
        detail = event.isBoundary ? "Point lies on a boundary edge." : "Point is not on a boundary edge; continue with slab search.";
      } else if (event.kind === "slab-search-step") {
        // Trace events only carry slab boundaries; the adapter resolves user-facing names.
        const comparedName = slabNameFromStart(event.comparedSlabStart);
        const comparedSlab = slabByStart.get(event.comparedSlabStart);
        const candidateName = event.candidateSlabStart === null ? null : slabNameFromStart(event.candidateSlabStart);
        stepperPhase = "Locate slab";
        title = `Binary search slabs for ${name}`;
        detail = `Compare x=${formatCoord(event.queryX)} with ${comparedName} ${formatSlabRange(event.comparedSlabStart, event.comparedSlabEnd)}; move ${event.direction}.`;
        detailLines = [
          candidateName === null
            ? "Current candidate slab: none"
            : `Current candidate slab: ${candidateName} (start ${formatCoord(event.candidateSlabStart ?? 0)})`
        ];
        activeSlabName = comparedSlab?.name ?? null;
      } else if (event.kind === "slab-selected") {
        const slabName = slabNameFromVersion(event.slabVersion) ?? `s${event.slabVersion}`;
        stepperPhase = "Locate slab";
        title = `Slab selected for ${name}`;
        detail = `${slabName} selected after binary search.`;
        detailLines = [`Persistent tree version: ${event.slabVersion}`];
        activeSlabName = slabName;
        treeSnapshotVersion = event.slabVersion;
      } else if (event.kind === "band-search-step") {
        const slabName = slabNameFromVersion(event.slabVersion) ?? `s${event.slabVersion}`;
        stepperPhase = "Search edges";
        title = `Search edge in ${slabName} for ${name}`;
        detail = `Compare point y=${formatCoord(event.queryY)} with y(${edgeLabel(event.segmentEdgeId)}, x=${formatCoord(event.queryX)})=${formatCoord(event.segmentY)}; move to the ${event.direction === "lower" ? "lower" : "upper"} half.`;
        detailLines = [
          event.candidateEdgeId === null
            ? `Current upper-edge candidate: none`
            : `Current upper-edge candidate: ${edgeLabel(event.candidateEdgeId)}`
        ];
        highlightedEdgeIds = [event.segmentEdgeId];
        edgeHighlights = buildEdgeHighlights({ searchEdgeIds: [event.segmentEdgeId] });
        activeSlabName = slabName;
      } else if (event.kind === "band-selected") {
        const slabName = slabNameFromVersion(event.slabVersion) ?? `s${event.slabVersion}`;
        stepperPhase = "Search edges";
        title = `Edge search resolved for ${name}`;
        detail = `Selected upper edge in ${slabName}; resolve the face next.`;
        detailLines = [
          event.segmentEdgeId === null ? "No edge directly above the point in this slab." : `Nearest upper edge: ${edgeLabel(event.segmentEdgeId)}`
        ];
        highlightedEdgeIds = event.segmentEdgeId === null ? [] : [event.segmentEdgeId];
        edgeHighlights = buildEdgeHighlights({ searchEdgeIds: event.segmentEdgeId === null ? [] : [event.segmentEdgeId] });
        activeSlabName = slabName;
      } else if (event.kind === "face-resolved") {
        stepperPhase = "Resolve face";
        title = `Resolved ${name}`;
        detail = `${formatResolvedFaceName(event.classification, event.faceId)} (${event.classification}).`;
        highlightedFaceId = event.faceId;
        activeSlabName = slabNameFromVersion(event.slabVersion);
      }

      frames.push({
        id: `query-${name}-${frames.length}`,
        phase: "query",
        stepperPhase,
        title,
        detail,
        detailLines,
        slabLines: [...slabLines],
        edgeHighlights,
        highlightedEdgeIds,
        highlightedFaceId,
        activeSlabName,
        activePointName: name,
        activePointCoords: {
          x: query.point.x,
          y: query.point.y
        },
        treeSnapshotVersion,
        treeSnapshotNodes: null,
        treeSnapshotSummary: null,
        rows: toRows(points, resolvedSoFar, name)
      });
    }

    resolvedSoFar.push(query);
    frames.push({
      id: `query-${name}-done`,
      phase: "query",
      stepperPhase: "Resolve face",
      title: `Committed result for ${name}`,
      detail: `${query.result.faceName} in ${query.result.slabName}.`,
      detailLines: [],
      slabLines: [...slabLines],
      edgeHighlights: [],
      highlightedEdgeIds: [],
      highlightedFaceId: query.result.faceId,
      activeSlabName: query.result.slabName,
      activePointName: name,
      activePointCoords: {
        x: query.point.x,
        y: query.point.y
      },
      treeSnapshotVersion: null,
      treeSnapshotNodes: null,
      treeSnapshotSummary: null,
      rows: toRows(points, resolvedSoFar, name)
    });
  }

  if (frames.length === 0) {
    frames.push({
      id: "idle",
      phase: "build",
      stepperPhase: "Build slabs",
      title: "Ready",
      detail: "Click points and press Start to build a timeline.",
      detailLines: [],
      slabLines: [],
      edgeHighlights: [],
      highlightedEdgeIds: [],
      highlightedFaceId: null,
      activeSlabName: null,
      activePointName: null,
      activePointCoords: null,
      treeSnapshotVersion: null,
      treeSnapshotNodes: null,
      treeSnapshotSummary: null,
      rows: toRows(points, [], null)
    });
  }

  return { frames };
}
