export function formatJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function formatTable(rows: readonly Record<string, unknown>[]): string {
  const first = rows[0];
  if (first === undefined) {
    return "No rows.\n";
  }

  const columns = Object.keys(first);
  const widths = columns.map((column) =>
    Math.max(column.length, ...rows.map((row) => String(row[column] ?? "").length)),
  );

  const renderRow = (cells: (column: string, index: number) => string): string =>
    columns.map(cells).join("  ");

  const lines = [
    renderRow((column, index) => column.padEnd(widths[index] ?? 0)),
    renderRow((_, index) => "-".repeat(widths[index] ?? 0)),
    ...rows.map((row) =>
      renderRow((column, index) => String(row[column] ?? "").padEnd(widths[index] ?? 0)),
    ),
  ];

  return `${lines.join("\n")}\n`;
}
