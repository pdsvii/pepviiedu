import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type Question = {
  id: string;
  type: "mc" | "multi" | "tf" | "numeric" | "short_text" | "pt_scenario" | "matching" | "ordering";
  stem: string;
  options?: string[] | null;
  passage_id?: string | null;
};

/**
 * Many official items ask two things in one question ("A. … B. …").
 * Detect those part labels so each part gets its own answer box.
 */
function findParts(stem: string): string[] {
  const found: string[] = [];
  for (const raw of String(stem ?? "").split("\n")) {
    const m = raw.match(/^\s*\(?([A-Ha-h])[.)]\s+\S/);
    if (m) {
      const label = m[1].toUpperCase();
      if (!found.includes(label)) found.push(label);
    }
  }
  // Only treat as multi-part when labels run in order from A.
  const expected = found.map((_, i) => String.fromCharCode(65 + i));
  return found.length > 1 && found.every((l, i) => l === expected[i]) ? found : [];
}

function parseParts(value: unknown, parts: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const text = typeof value === "string" ? value : "";
  const re = new RegExp(`(?:^|\\n)\\s*([${parts.join("")}])\\)\\s?`, "g");
  const hits = [...text.matchAll(re)];
  if (hits.length === 0) {
    if (text.trim()) out[parts[0]] = text;
    return out;
  }
  hits.forEach((h, i) => {
    const start = h.index! + h[0].length;
    const end = i + 1 < hits.length ? hits[i + 1].index! : text.length;
    out[h[1]] = text.slice(start, end).trim();
  });
  return out;
}

function serializeParts(parts: string[], values: Record<string, string>): string {
  const filled = parts.filter((p) => (values[p] ?? "").trim() !== "");
  if (filled.length === 0) return "";
  return parts.map((p) => `${p}) ${(values[p] ?? "").trim()}`).join("\n");
}

export function QuestionRenderer({
  q,
  value,
  onChange,
  disabled,
}: {
  q: Question;
  value: any;
  onChange: (v: any) => void;
  disabled?: boolean;
}) {
  if (q.type === "mc" || q.type === "tf") {
    const opts = q.options ?? (q.type === "tf" ? ["True", "False"] : []);
    return (
      <div className="grid gap-2">
        {opts.map((opt, i) => {
          const selected = value === i;
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onChange(i)}
              className={`w-full rounded-2xl border-2 px-4 py-3 text-left transition-colors ${
                selected ? "border-primary bg-secondary" : "border-transparent bg-muted hover:bg-secondary"
              } ${disabled ? "opacity-70" : ""}`}
            >
              <span className="mr-3 font-bold">{String.fromCharCode(65 + i)}.</span>
              {opt}
            </button>
          );
        })}
      </div>
    );
  }
  if (q.type === "multi") {
    const opts = q.options ?? [];
    const chosen: number[] = Array.isArray(value) ? value : [];
    function toggle(i: number) {
      if (disabled) return;
      const next = chosen.includes(i) ? chosen.filter((x) => x !== i) : [...chosen, i];
      onChange(next);
    }
    return (
      <div className="grid gap-2">
        {opts.map((opt, i) => {
          const on = chosen.includes(i);
          return (
            <button key={i} type="button" disabled={disabled} onClick={() => toggle(i)}
              className={`w-full rounded-2xl border-2 px-4 py-3 text-left transition-colors ${
                on ? "border-primary bg-secondary" : "border-transparent bg-muted hover:bg-secondary"
              } ${disabled ? "opacity-70" : ""}`}>
              <span className="mr-3 inline-grid h-5 w-5 place-items-center rounded border">
                {on ? "✓" : ""}
              </span>
              {opt}
            </button>
          );
        })}
        <p className="text-xs text-muted-foreground">Select all that apply.</p>
      </div>
    );
  }
  if (q.type === "numeric") {
    return (
      <Input type="number" inputMode="decimal" value={value ?? ""} disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className="max-w-xs text-lg" placeholder="Type your answer" />
    );
  }
  if (q.type === "short_text" || q.type === "pt_scenario") {
    const long = q.type === "pt_scenario";
    const parts = findParts(q.stem);

    if (parts.length > 1) {
      const current = parseParts(value, parts);
      return (
        <div className="-mt-2 grid gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-muted/40 p-3">
          {parts.map((label) => (
            <div key={label}>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Your answer — part {label}
              </label>
              <Textarea
                value={current[label] ?? ""}
                disabled={disabled}
                rows={long ? 5 : 2}
                onChange={(e) => onChange(serializeParts(parts, { ...current, [label]: e.target.value }))}
                className="resize-y rounded-xl border-2 bg-background text-base leading-relaxed"
                placeholder={`Answer for ${label}`}
              />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="-mt-2 rounded-2xl border-2 border-dashed border-primary/40 bg-muted/40 p-3">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Your answer
        </label>
        <Textarea
          value={value ?? ""}
          disabled={disabled}
          rows={long ? 8 : 3}
          onChange={(e) => onChange(e.target.value)}
          className="resize-y rounded-xl border-2 bg-background text-base leading-relaxed"
          placeholder={long ? "Explain your thinking with steps and reasons…" : "Type your answer here"}
        />
      </div>
    );
  }

  return <div className="rounded-2xl bg-muted p-4 text-sm">This question type isn't playable yet.</div>;
}
