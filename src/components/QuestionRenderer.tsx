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
