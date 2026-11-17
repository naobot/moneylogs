/**
 * Minimal RFC 4180 CSV parser: quoted fields, doubled quotes, embedded newlines, CRLF/LF
 * line endings and a leading BOM. Blank lines are dropped. Enough for app exports; not a
 * general-purpose dialect sniffer.
 */
export const parseCsv = (text: string): string[][] => {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const endRow = () => {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
    field = "";
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      endRow();
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
};

/** Column lookup by trimmed header name. */
export const headerIndex = (header: ReadonlyArray<string>): Map<string, number> =>
  new Map(header.map((name, i) => [name.trim(), i]));
