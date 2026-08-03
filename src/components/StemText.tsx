/**
 * Renders a question stem. Prose paragraphs render normally; blocks of
 * column-aligned text coming from the official PDFs (whose rows are often split
 * across several lines) are reconstructed into a real table so every value
 * lines up under its heading on any screen size.
 */

type Block =
  | { kind: "prose"; lines: string[] }
  | { kind: "table"; header: string[]; rows: string[][] };

const isTableLine = (line: string) => /\t/.test(line) || /\S\s{2,}\S/.test(line);
/** short leftovers like "5", "8", ".075", "4. 0.6%" belong to the table above */
const isFragment = (line: string) => line.trim().length <= 14 && !/[a-z]{4,}/i.test(line.trim());
const startsRow = (line: string) => /^\s*\d+[.)]/.test(line);

const splitCells = (line: string) =>
  line.trim().split(/\t+|\s{2,}/).map((c) => c.trim()).filter((c) => c.length > 0);

const colFor = (header: string[], ...names: string[]) =>
  header.findIndex((h) => names.some((n) => h.toLowerCase().includes(n)));

/** Rebuild rows whose cells got scattered over multiple PDF lines. */
function buildTable(lines: string[]): Block {
  const header = splitCells(lines[0]);
  const width = Math.max(header.length, 1);
  const groups: string[][] = [];
  for (const line of lines.slice(1)) {
    if (groups.length === 0) {
      groups.push([line]);
    } else if (startsRow(line)) {
      // A fraction's numerator often sits on the line ABOVE its row number, so an
      // odd count of bare-number lines means the last one belongs to the next row.
      const prev = groups[groups.length - 1];
      const bare = (l: string) => /^\s*\d+\s*$/.test(l);
      const pulled: string[] = [];
      if (prev.length > 1 && prev.filter(bare).length % 2 === 1 && bare(prev[prev.length - 1])) {
        pulled.push(prev.pop()!);
      }
      groups.push([...pulled, line]);
    } else {
      groups[groups.length - 1].push(line);
    }
  }

  const pctCol = colFor(header, "percent", "%");
  const fracCol = colFor(header, "fraction");
  const decCol = colFor(header, "decimal");
  const smart = pctCol >= 0 || fracCol >= 0 || decCol >= 0;

  const rows = groups.map((group) => {
    const tokens = group.flatMap(splitCells).flatMap((c) => c.split(/\s+/)).filter(Boolean);
    const labelAt = tokens.findIndex((t) => /^\d+[.)]$/.test(t));
    const label = labelAt >= 0 ? tokens.splice(labelAt, 1)[0].replace(/[.)]$/, "") : "";
    const cells = Array<string>(width).fill("");

    if (smart) {
      const nums: string[] = [];
      for (const t of tokens) {
        if (/%/.test(t) && pctCol >= 0) cells[pctCol] = t;
        else if (/^\.?\d*\.\d+$|^\.\d+$/.test(t) && decCol >= 0) cells[decCol] = t;
        else if (/^\d+$/.test(t)) nums.push(t);
        else {
          const empty = cells.findIndex((c) => c === "");
          if (empty >= 0) cells[empty] = t;
        }
      }
      if (nums.length && fracCol >= 0) cells[fracCol] = nums.slice(0, 2).join("/");
      else if (nums.length) {
        const empty = cells.findIndex((c) => c === "");
        if (empty >= 0) cells[empty] = nums.join(" ");
      }
    } else {
      tokens.forEach((t, i) => {
        if (i < width) cells[i] = cells[i] ? `${cells[i]} ${t}` : t;
      });
    }
    return [label, ...cells];
  });

  return { kind: "table", header: ["", ...header], rows };
}

/** Blank ruled answer lines from the PDFs ("_____" / "-----") are dropped: the app
 *  supplies a real input box under the question instead. */
const isAnswerRule = (line: string) => /^[\s._\-–—]{6,}$/.test(line);

function parseBlocks(stem: string): Block[] {
  const lines = stem.replace(/\r/g, "").split("\n").filter((l) => !isAnswerRule(l));
  const blocks: Block[] = [];
  let buffer: string[] = [];
  let mode: "prose" | "table" | null = null;

  const flush = () => {
    if (buffer.length === 0) return;
    blocks.push(mode === "table" ? buildTable(buffer) : { kind: "prose", lines: buffer.slice() });
    buffer = [];
  };

  for (const raw of lines) {
    const line = raw;
    if (line.trim() === "") {
      if (mode === "table") continue;
      buffer.push("");
      continue;
    }
    const continuesTable: boolean =
      mode === "table" && (isTableLine(line) || isFragment(line) || startsRow(line));
    const next: "prose" | "table" = continuesTable ? "table" : isTableLine(line) ? "table" : "prose";
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
              <thead>
                <tr className="bg-muted/70">
                  {b.header.map((h, c) => (
                    <th key={c} className={`px-3 py-2 font-bold ${c ? "border-l" : "w-10"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r} className="border-t">
                    {row.map((cell, c) => (
                      <td key={c} className={`px-3 py-2 align-middle ${c ? "border-l" : "font-semibold text-muted-foreground"}`}>
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
