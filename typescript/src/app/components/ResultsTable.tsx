import type { JSX } from "react";

interface Row {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly slab: string;
  readonly face: string;
}

interface ResultsTableProps {
  readonly rows: Row[];
}

export function ResultsTable({ rows }: ResultsTableProps): JSX.Element {
  return (
    <section className="results-panel">
      <h2>Point Location Results</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>X</th>
            <th>Y</th>
            <th>Slab</th>
            <th>Face</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5}>No results yet. Click to place points, then press Start.</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.x.toFixed(3)}</td>
                <td>{row.y.toFixed(3)}</td>
                <td>{row.slab}</td>
                <td>{row.face}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
