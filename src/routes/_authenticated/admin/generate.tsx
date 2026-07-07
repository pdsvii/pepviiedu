import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ADMIN_NAV } from "./index";
import { generateExamItems } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SUBJECTS } from "@/lib/pep";

export const Route = createFileRoute("/_authenticated/admin/generate")({ component: AdminGenerate });

function AdminGenerate() {
  const genFn = useServerFn(generateExamItems);
  const [grade, setGrade] = useState(6);
  const [component, setComponent] = useState<"AT"|"CBT"|"PT">("CBT");
  const [subject, setSubject] = useState<any>("mathematics");
  const [strand, setStrand] = useState("");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [lastCount, setLastCount] = useState<number | null>(null);

  async function generate() {
    setBusy(true); setLastCount(null);
    try {
      const res = await genFn({ data: { grade, component, subject, strand: strand || undefined, count } });
      setLastCount(res.inserted);
      toast.success(`Generated ${res.inserted} items`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <AppShell nav={ADMIN_NAV} title="Generate exam items">
      <div className="max-w-2xl rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">AI-generated PEP-aligned items get tagged and added to the question bank so full mock papers can always be assembled.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><Label>Grade</Label><Input type="number" min={4} max={6} value={grade} onChange={(e) => setGrade(Number(e.target.value))} /></div>
          <div>
            <Label>Component</Label>
            <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={component} onChange={(e) => setComponent(e.target.value as any)}>
              <option value="CBT">CBT (Curriculum)</option>
              <option value="AT">AT (Ability)</option>
              <option value="PT">PT (Performance Task)</option>
            </select>
          </div>
          <div>
            <Label>Subject</Label>
            <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={subject} onChange={(e) => setSubject(e.target.value)}>
              {SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div><Label>Strand (optional)</Label><Input value={strand} onChange={(e) => setStrand(e.target.value)} placeholder="e.g. fractions" /></div>
          <div><Label>Count</Label><Input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} /></div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Button onClick={generate} disabled={busy}>{busy ? "Generating…" : "Generate"}</Button>
          {lastCount !== null && <span className="text-sm text-muted-foreground">Last run: {lastCount} items saved to the bank.</span>}
        </div>
      </div>
    </AppShell>
  );
}
