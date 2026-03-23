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
  readonly onCanvasClick: (x: number, y: number) => void;
}

const WIDTH = 920;
const HEIGHT = 640;
const VERTEX_RADIUS = 14;
const GRAPH_STROKE = "#444";
const SLAB_STROKE = "#f97316";
const SLAB_DASH_ARRAY = "4 4";
const SLAB_BOTTOM_EXTENSION = VERTEX_RADIUS + 6;
const SLAB_LABEL_OFFSET_Y = 12;

export function GraphCanvas({ model, queryPoints, slabs = [], onCanvasClick }: GraphCanvasProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const scales = useMemo(() => {
    const x = d3
      .scaleLinear()
      .domain([model.bounds.minX, model.bounds.maxX])
      .range([60, WIDTH - 60]);
    const y = d3
      .scaleLinear()
      .domain([model.bounds.minY, model.bounds.maxY])
      .range([HEIGHT - 60, 40]);
    return { x, y };
  }, [model.bounds.maxX, model.bounds.maxY, model.bounds.minX, model.bounds.minY]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const root = svg.append("g");

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
      .attr("stroke", "none");

    const slabMarkers = slabs
      .filter((slab) => Number.isFinite(slab.end) && slab.end >= model.bounds.minX && slab.end <= model.bounds.maxX)
      .map((slab) => ({
        name: slab.name,
        x: scales.x(slab.end)
      }));
    const slabBaseY = scales.y(model.bounds.minY);
    const slabBottomY = Math.min(HEIGHT - 24, slabBaseY + SLAB_BOTTOM_EXTENSION);

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
      .attr("stroke", GRAPH_STROKE)
      .attr("stroke-width", 2);

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

    svg.on("click", (event) => {
      const [sx, sy] = d3.pointer(event);
      const x = scales.x.invert(sx);
      const y = scales.y.invert(sy);
      onCanvasClick(x, y);
    });
  }, [model, onCanvasClick, queryPoints, scales, slabs]);

  return (
    <Paper className="graph-panel" withBorder radius="md" p="md">
      <Stack gap="xs">
        <Text fw={600} size="sm">
          Graph Canvas
        </Text>
        <Text c="dimmed" size="xs">
          Click inside the graph to place query points. A point belongs to the slab marked by the first dotted line to its right.
        </Text>
        <svg className="graph-canvas" ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} />
      </Stack>
    </Paper>
  );
}
