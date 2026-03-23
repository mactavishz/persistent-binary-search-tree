import { Paper, Table, Text, Title } from "@mantine/core";
import type { JSX } from "react";
import { splitLabelParts } from "./label-parts.js";

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

function LabelText({ value }: { readonly value: string }): JSX.Element {
  const { letters, number } = splitLabelParts(value);
  return (
    <>
      {letters}
      {number !== null ? <span className="label-number">{number}</span> : null}
    </>
  );
}

export function ResultsTable({ rows }: ResultsTableProps): JSX.Element {
  const tableRows = rows.map((row) => (
    <Table.Tr key={row.name}>
      <Table.Td>
        <LabelText value={row.name} />
      </Table.Td>
      <Table.Td>{row.x.toFixed(3)}</Table.Td>
      <Table.Td>{row.y.toFixed(3)}</Table.Td>
      <Table.Td>
        <LabelText value={row.slab} />
      </Table.Td>
      <Table.Td>
        <LabelText value={row.face} />
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Paper className="results-panel" withBorder radius="md" p="md">
      <Title order={3} mb="sm">
        Point Location Results
      </Title>

      <Table.ScrollContainer minWidth={580}>
        <Table withTableBorder withColumnBorders striped="odd" highlightOnHover={rows.length > 0}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>X</Table.Th>
              <Table.Th>Y</Table.Th>
              <Table.Th>Slab</Table.Th>
              <Table.Th>Face</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center">
                    No results yet. Click to place points, then press Start.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              tableRows
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}
