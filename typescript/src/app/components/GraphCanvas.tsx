import * as d3 from "d3";
import { Paper, Stack, Text } from "@mantine/core";
import { useEffect, useMemo, useRef } from "react";
import type { JSX } from "react";
import type { GraphRenderModel } from "../../planar/render-model.js";
import { splitLabelParts } from "./label-parts.js";

export interface QueryPointRender {
  readonly x: number;
  readonly y: number;
  readonly label: string;
}

export interface SlabRender {
  readonly name: string;
  readonly start: number;
  readonly end: number;
}

interface GraphCanvasProps {
  readonly model: GraphRenderModel;
  readonly queryPoints: QueryPointRender[];
  readonly slabs?: readonly SlabRender[];
  readonly edgeHighlights?: readonly { edgeId: number; kind: "active" | "added" | "removed" | "search" }[];
  readonly highlightedEdgeIds?: readonly number[];
  readonly highlightedFaceId?: number | null;
  readonly activePoint?: QueryPointRender | null;
  readonly activeSlabName?: string | null;
  readonly onCanvasClick: (x: number, y: number) => void;
}

const WIDTH = 720;
const HEIGHT = 720;
const VERTEX_RADIUS = 14;
const GRAPH_STROKE = "#444";
const SLAB_STROKE = "#f97316";
const SLAB_FILL = "#fb923c";
const SLAB_DASH_ARRAY = "4 4";
const PLOT_PADDING = {
  left: 60,
  right: 60,
  top: 40,
  bottom: 60
} as const;
const MIN_DOMAIN_SPAN = 1e-6;
const SLAB_BOTTOM_EXTENSION = VERTEX_RADIUS + 6;
const SLAB_LABEL_OFFSET_Y = 12;
const EDGE_LABEL_OFFSET = 12;

function clampSlabBoundary(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function GraphCanvas({
  model,
  queryPoints,
  slabs = [],
  edgeHighlights = [],
  highlightedEdgeIds = [],
  highlightedFaceId = null,
  activePoint = null,
  activeSlabName = null,
  onCanvasClick
}: GraphCanvasProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const scales = useMemo(() => {
    const domainWidth = Math.max(model.bounds.maxX - model.bounds.minX, MIN_DOMAIN_SPAN);
    const domainHeight = Math.max(model.bounds.maxY - model.bounds.minY, MIN_DOMAIN_SPAN);
    const availableWidth = WIDTH - PLOT_PADDING.left - PLOT_PADDING.right;
    const availableHeight = HEIGHT - PLOT_PADDING.top - PLOT_PADDING.bottom;
    const pixelsPerUnit = Math.min(availableWidth / domainWidth, availableHeight / domainHeight);
    const drawWidth = domainWidth * pixelsPerUnit;
    const drawHeight = domainHeight * pixelsPerUnit;
    const xInset = (availableWidth - drawWidth) / 2;
    const yInset = (availableHeight - drawHeight) / 2;

    const xMin = PLOT_PADDING.left + xInset;
    const xMax = xMin + drawWidth;
    const yMax = HEIGHT - PLOT_PADDING.bottom - yInset;
    const yMin = yMax - drawHeight;

    const x = d3
      .scaleLinear()
      .domain([model.bounds.minX, model.bounds.maxX])
      .range([xMin, xMax]);
    const y = d3
      .scaleLinear()
      .domain([model.bounds.minY, model.bounds.maxY])
      .range([yMax, yMin]);
    return { x, y };
  }, [model.bounds.maxX, model.bounds.maxY, model.bounds.minX, model.bounds.minY]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const root = svg.append("g");
    const edgeHighlightMap = new Map(edgeHighlights.map((highlight) => [highlight.edgeId, highlight.kind]));

    function edgeStrokeColor(edgeId: number): string {
      const kind = edgeHighlightMap.get(edgeId);
      if (kind === "added") {
        return "#2563eb";
      }
      if (kind === "removed") {
        return "#dc2626";
      }
      if (kind === "search") {
        return "#1d4ed8";
      }
      if (kind === "active") {
        return "#0f766e";
      }
      return GRAPH_STROKE;
    }

    function edgeStrokeWidth(edgeId: number): number {
      return edgeHighlightMap.has(edgeId) || highlightedEdgeIds.includes(edgeId) ? 4 : 2;
    }

    root
      .append("g")
      .attr("class", "faces")
      .attr("pointer-events", "none")
      .selectAll("path")
      .data(model.faces.filter((face) => !face.isOuter))
      .enter()
      .append("path")
      .attr("d", (face) =>
        d3
          .line<{ x: number; y: number }>()
          .x((point) => scales.x(point.x))
          .y((point) => scales.y(point.y))
          .curve(d3.curveLinearClosed)(face.vertices) ?? ""
      )
      .attr("fill", "#ffffff")
      .attr("class", (face) => (face.id === highlightedFaceId ? "face-active" : ""))
      .attr("stroke", "none");

    const slabMarkers = slabs
      .filter((slab) => Number.isFinite(slab.end) && slab.end >= model.bounds.minX && slab.end <= model.bounds.maxX)
      .map((slab) => ({
        name: slab.name,
        x: scales.x(slab.end)
      }));
    const slabOverlays = slabs
      .filter((slab) => slab.name === activeSlabName)
      .map((slab) => {
        const start = clampSlabBoundary(slab.start, model.bounds.minX);
        const end = clampSlabBoundary(slab.end, model.bounds.maxX);
        return {
          name: slab.name,
          x1: scales.x(Math.max(model.bounds.minX, start)),
          x2: scales.x(Math.min(model.bounds.maxX, end))
        };
      })
      .filter((slab) => slab.x2 > slab.x1);
    const slabBaseY = scales.y(model.bounds.minY);
    const slabBottomY = Math.min(HEIGHT - 24, slabBaseY + SLAB_BOTTOM_EXTENSION);

    root
      .append("g")
      .attr("class", "slab-overlays")
      .attr("pointer-events", "none")
      .selectAll("rect")
      .data(slabOverlays)
      .enter()
      .append("rect")
      .attr("class", "slab-highlight")
      .attr("x", (slab) => slab.x1)
      .attr("y", scales.y(model.bounds.maxY))
      .attr("width", (slab) => slab.x2 - slab.x1)
      .attr("height", scales.y(model.bounds.minY) - scales.y(model.bounds.maxY))
      .attr("fill", SLAB_FILL)
      .attr("opacity", 0.12);

    root
      .append("g")
      .attr("class", "slab-lines")
      .attr("pointer-events", "none")
      .selectAll("line")
      .data(slabMarkers)
      .enter()
      .append("line")
      .attr("x1", (slab) => slab.x)
      .attr("y1", scales.y(model.bounds.maxY))
      .attr("x2", (slab) => slab.x)
      .attr("y2", slabBottomY)
      .attr("stroke", SLAB_STROKE)
      .attr("class", (slab) => (slab.name === activeSlabName ? "slab-active" : ""))
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", SLAB_DASH_ARRAY)
      .attr("opacity", 0.9);

    root
      .append("g")
      .attr("class", "slab-labels")
      .attr("pointer-events", "none")
      .selectAll("text")
      .data(slabMarkers)
      .enter()
      .append("text")
      .attr("x", (slab) => slab.x)
      .attr("y", Math.min(HEIGHT - 10, slabBottomY + SLAB_LABEL_OFFSET_Y))
      .attr("font-size", 14)
      .attr("font-style", "italic")
      .attr("font-weight", 600)
      .attr("fill", SLAB_STROKE)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .each(function renderSlabLabel(slab) {
        const { letters, number } = splitLabelParts(slab.name);
        const text = d3.select(this as SVGTextElement).text(letters);
        if (number !== null) {
          text.append("tspan")
            .attr("class", "label-number")
            .attr("dy", "3px")
            .text(number);
        }
      });

    const uniqueEdgeMap = new Map<string, GraphRenderModel["halfEdges"][number]>();
    for (const edge of model.halfEdges) {
      const a = Math.min(edge.source, edge.target);
      const b = Math.max(edge.source, edge.target);
      const key = `${a},${b}`;
      if (!uniqueEdgeMap.has(key)) {
        uniqueEdgeMap.set(key, edge);
      }
    }
    const uniqueEdges = Array.from(uniqueEdgeMap.values());

    root
      .append("g")
      .attr("class", "edges")
      .attr("pointer-events", "none")
      .selectAll("line")
      .data(uniqueEdges)
      .enter()
      .append("line")
      .attr("x1", (edge) => scales.x(model.vertices[edge.source]!.x))
      .attr("y1", (edge) => scales.y(model.vertices[edge.source]!.y))
      .attr("x2", (edge) => scales.x(model.vertices[edge.target]!.x))
      .attr("y2", (edge) => scales.y(model.vertices[edge.target]!.y))
      .attr("stroke", (edge) => edgeStrokeColor(edge.id))
      .attr("stroke-width", (edge) => edgeStrokeWidth(edge.id))
      .attr("class", (edge) => (edgeHighlightMap.has(edge.id) || highlightedEdgeIds.includes(edge.id) ? "edge-active" : ""));

    root
      .append("g")
      .attr("class", "edge-labels")
      .attr("pointer-events", "none")
      .selectAll("text")
      .data(uniqueEdges)
      .enter()
      .append("text")
      .attr("x", (edge) => {
        const x1 = scales.x(model.vertices[edge.source]!.x);
        const x2 = scales.x(model.vertices[edge.target]!.x);
        const y1 = scales.y(model.vertices[edge.source]!.y);
        const y2 = scales.y(model.vertices[edge.target]!.y);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.hypot(dx, dy) || 1;
        return (x1 + x2) / 2 + (-dy / length) * EDGE_LABEL_OFFSET;
      })
      .attr("y", (edge) => {
        const x1 = scales.x(model.vertices[edge.source]!.x);
        const x2 = scales.x(model.vertices[edge.target]!.x);
        const y1 = scales.y(model.vertices[edge.source]!.y);
        const y2 = scales.y(model.vertices[edge.target]!.y);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.hypot(dx, dy) || 1;
        return (y1 + y2) / 2 + (dx / length) * EDGE_LABEL_OFFSET;
      })
      .attr("font-size", 14)
      .attr("font-style", "italic")
      .attr("font-weight", 600)
      .attr("fill", (edge) => (edgeHighlightMap.has(edge.id) || highlightedEdgeIds.includes(edge.id) ? edgeStrokeColor(edge.id) : "#374151"))
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .each(function renderEdgeLabel(edge) {
        const { letters, number } = splitLabelParts(`e${edge.id}`);
        const text = d3.select(this as SVGTextElement).text(letters);
        if (number !== null) {
          text.append("tspan")
            .attr("class", "label-number")
            .attr("dy", "3px")
            .text(number);
        }
      });

    root
      .append("g")
      .attr("class", "vertices")
      .attr("pointer-events", "none")
      .selectAll("circle")
      .data(model.vertices)
      .enter()
      .append("circle")
      .attr("cx", (vertex) => scales.x(vertex.x))
      .attr("cy", (vertex) => scales.y(vertex.y))
      .attr("r", VERTEX_RADIUS)
      .attr("fill", GRAPH_STROKE);

    root
      .append("g")
      .attr("class", "vertex-labels")
      .attr("pointer-events", "none")
      .selectAll("text")
      .data(model.vertices)
      .enter()
      .append("text")
      .attr("x", (vertex) => scales.x(vertex.x))
      .attr("y", (vertex) => scales.y(vertex.y))
      .attr("font-size", 16)
      .attr("font-style", "italic")
      .attr("fill", "#ffffff")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .each(function renderVertexLabel(vertex) {
        const { letters, number } = splitLabelParts(vertex.label);
        const text = d3.select(this as SVGTextElement).text(letters);
        if (number !== null) {
          text.append("tspan")
            .attr("class", "label-number")
            .attr("dy", "3px")
            .text(number);
        }
      });

    root
      .append("g")
      .attr("class", "face-labels")
      .attr("pointer-events", "none")
      .selectAll("text")
      .data(model.faces.filter((face) => !face.isOuter))
      .enter()
      .append("text")
      .attr("x", (face) => scales.x(face.centroid.x))
      .attr("y", (face) => scales.y(face.centroid.y))
      .attr("font-size", 18)
      .attr("font-style", "italic")
      .attr("fill", "#18ab88")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .each(function renderFaceLabel(face) {
        const { letters, number } = splitLabelParts(face.label.toLowerCase());
        const text = d3.select(this as SVGTextElement).text(letters);
        if (number !== null) {
          text.append("tspan")
            .attr("class", "label-number")
            .attr("dy", "3px")
            .text(number);
        }
      });

    root
      .append("g")
      .attr("class", "query-points")
      .attr("pointer-events", "none")
      .selectAll("g")
      .data(queryPoints)
      .enter()
      .append("g")
      .each(function renderPoint(point) {
        const g = d3.select(this);
        g.append("circle")
          .attr("cx", scales.x(point.x))
          .attr("cy", scales.y(point.y))
          .attr("r", 4)
          .attr("fill", "#dc2626");

        g.append("text")
          .attr("x", scales.x(point.x) + 8)
          .attr("y", scales.y(point.y) - 8)
          .attr("font-size", 14)
          .attr("font-weight", 600)
          .attr("fill", "#111827")
          .each(function renderPointLabel() {
            const { letters, number } = splitLabelParts(point.label);
            const text = d3.select(this as SVGTextElement).text(letters);
            if (number !== null) {
              text.append("tspan")
                .attr("class", "label-number")
                .attr("dy", "3px")
                .text(number);
            }
          });
      });

    if (activePoint) {
      const active = root.append("g").attr("class", "active-query-point").attr("pointer-events", "none");
      active
        .append("circle")
        .attr("cx", scales.x(activePoint.x))
        .attr("cy", scales.y(activePoint.y))
        .attr("r", 8)
        .attr("fill", "none")
        .attr("stroke", "#2563eb")
        .attr("stroke-width", 2)
        .attr("opacity", 0)
        .transition()
        .duration(220)
        .attr("opacity", 1);
    }

    svg.on("click", (event) => {
      const [sx, sy] = d3.pointer(event);
      const x = scales.x.invert(sx);
      const y = scales.y.invert(sy);
      onCanvasClick(x, y);
    });
  }, [activePoint, activeSlabName, edgeHighlights, highlightedEdgeIds, highlightedFaceId, model, onCanvasClick, queryPoints, scales, slabs]);

  return (
    <Paper className="graph-panel" withBorder radius="md" p="md">
      <Stack gap="xs">
        <Text fw={600} size="sm">
          Graph Canvas
        </Text>
        <Text c="dimmed" size="xs">
          Click inside the graph to place query points. Dotted lines mark slab boundaries, and the active slab is shown as a thin tinted region.
        </Text>
        <svg className="graph-canvas" ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} />
      </Stack>
    </Paper>
  );
}
