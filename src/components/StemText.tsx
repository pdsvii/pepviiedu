/**
 * Renders a question stem. Prose paragraphs render normally; blocks of
 * column-aligned text coming from the official PDFs are detected and rendered
 * as a real table (or monospace block) so they line up on every screen size.
 */

type Block =
  | { kind: "prose"; lines: string[] }
  | { kind: "table"; rows: string[][] };

const isTableLine = (line: string) => /\t/.test(line) || /\S\s{2,}\S/.test(line);

const splitCells = (line: string) =>
  line.trim().split(/\t+|\s{2,}/).map((c) => c.trim()).filter((c) => c.length > 0);

function parseBlocks(stem: string): Block[] {
  const lines = stem.replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  let buffer: string[] = [];
  let mode: "prose" | "table" | null = null;

  const flush = () => {
    if (buffer.length === 0) return;
    if (mode === "table") {
      const rows = buffer.map(splitCells);
      const width = Math.max(...rows.map((r) => r.length));
      blocks.push({ kind: "table", rows: rows.map((r) => [...r, ...Array(width - r.length).fill("")]) });
    } else {
      blocks.push({ kind: "prose", lines: buffer.slice() });
    }
    buffer = [];
  };

  for (const line of lines) {
    const next: "prose" | "table" = isTableLine(line) ? "table" : "prose";
    if (line.trim() === "") {
      // blank line keeps the current block going for tables, breaks prose
      if (mode === "table") continue;
      buffer.push("");
      continue;
    }
    if (mode !== null && next !== mode) flush();
    mode = next;
    buffer.push(line);
  }
  flush();
  return blocks;
}

export function StemText({ stem, className = "" }: { stem: string; className?: string }) {
  const blocks = parseBlocks(stem ?? "");

  return (
    <div className={`grid gap-3 ${className}`}>
      {blocks.map((b, i) =>
        b.kind === "prose" ? (
          <p key={i} className="whitespace-pre-wrap leading-relaxed">
            {b.lines.join("\n").trim()}
          </p>
        ) : (
          <div key={i} className="overflow-x-auto rounded-2xl border bg-background">
            <table className="w-full border-collapse text-left tabular-nums">
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r} className={r === 0 ? "bg-muted/70" : "border-t"}>
                    {row.map((cell, c) => (
                      <td
                        key={c}
                        className={`px-3 py-2 align-middle ${r === 0 ? "font-bold" : ""} ${
                          c === 0 ? "" : "border-l"
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      )}
    </div>
  );
}
