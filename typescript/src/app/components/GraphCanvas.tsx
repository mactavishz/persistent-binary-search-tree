import * as d3 from "d3";
import { useEffect, useMemo, useRef } from "react";
import type { JSX } from "react";
import type { GraphRenderModel } from "../../planar/render-model.js";

export interface QueryPointRender {
  readonly x: number;
  readonly y: number;
  readonly label: string;
}

interface GraphCanvasProps {
  readonly model: GraphRenderModel;
  readonly queryPoints: QueryPointRender[];
  readonly onCanvasClick: (x: number, y: number) => void;
}

const WIDTH = 920;
const HEIGHT = 640;
const VERTEX_RADIUS = 14;
const GRAPH_STROKE = "#444";

export function GraphCanvas({ model, queryPoints, onCanvasClick }: GraphCanvasProps): JSX.Element {
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
      .text((vertex) => vertex.label);

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
      .attr("font-size", 19)
      .attr("font-style", "italic")
      .attr("fill", "#18ab88")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .text((face) => face.label);

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
          .attr("font-size", 12)
          .attr("font-weight", 600)
          .attr("fill", "#111827")
          .text(point.label);
      });

    svg.on("click", (event) => {
      const [sx, sy] = d3.pointer(event);
      const x = scales.x.invert(sx);
      const y = scales.y.invert(sy);
      onCanvasClick(x, y);
    });
  }, [model, onCanvasClick, queryPoints, scales]);

  return <svg className="graph-canvas" ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} />;
}
