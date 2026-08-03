import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ADMIN_NAV } from "./index";
import { fillContentBank, variationCoverage } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { SUBJECTS } from "@/lib/pep";

export const Route = createFileRoute("/_authenticated/admin/variations")({
  component: AdminVariations,
  head: () => ({
    meta: [
      { title: "Concept Variations · PEP Ready Admin" },
      { name: "description", content: "Turn every official MOEY practice item into ten fresh variations so students master the concept, not the question." },
      { property: "og:title", content: "Concept Variations · PEP Ready Admin" },
      { property: "og:description", content: "Bulk-generate MOEY-aligned question variations across every grade and subject." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ALL = "all";

function AdminVariations() {
  const qc = useQueryClient();
  const fillFn = useServerFn(fillContentBank);
  const covFn = useServerFn(variationCoverage);
  const { data: cov } = useQuery({ queryKey: ["admin", "coverage"], queryFn: () => covFn() });

  const [grade, setGrade] = useState<string>(ALL);
  const [subject, setSubject] = useState<string>(ALL);
  const [component, setComponent] = useState<string>(ALL);
  const [perParent, setPerParent] = useState(10);
  const [officialOnly, setOfficialOnly] = useState(true);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [stats, setStats] = useState({ processed: 0, inserted: 0, remaining: 0 });
  const stop = useRef(false);

  function payload() {
    return {
      per_parent: perParent,
      batch: 2 as const,
      official_only: officialOnly,
      ...(grade !== ALL ? { grade: Number(grade) } : {}),
      ...(subject !== ALL ? { subject: subject as any } : {}),
      ...(component !== ALL ? { component: component as any } : {}),
    };
  }

  async function runContinuous() {
    stop.current = false;
    setRunning(true);
    setLog([]);
    setStats({ processed: 0, inserted: 0, remaining: 0 });
    let totalProcessed = 0;
    let totalInserted = 0;
    try {
      for (let i = 0; i < 200; i++) {
        if (stop.current) { setLog((l) => [...l, "Stopped by you."]); break; }
        const res = await fillFn({ data: payload() });
        totalProcessed += res.processed;
        totalInserted += res.inserted;
        setStats({ processed: totalProcessed, inserted: totalInserted, remaining: res.remaining });
        setLog((l) => [`Batch ${i + 1}: +${res.inserted} variations from ${res.processed} source items · ${res.remaining} items still to expand`, ...res.failures.map((f) => `  ⚠︎ ${f}`), ...l].slice(0, 60));
        if (res.failures.some((f) => f.includes("rate limit") || f.includes("credits"))) {
          toast.error(res.failures[0]);
          break;
        }
        if (res.processed === 0 || res.remaining === 0) { setLog((l) => ["All source items in this selection now have their full set of variations.", ...l]); break; }
      }
      qc.invalidateQueries({ queryKey: ["admin", "coverage"] });
      toast.success(`Added ${totalInserted} variations to the bank`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <AppShell nav={ADMIN_NAV} title="Concept variations">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Each official MOEY item becomes up to 10 fresh variations — same concept and grade level, new numbers, names and Jamaican contexts — so students learn the skill instead of memorising one question.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="font-bold">Fill the bank</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Grade</Label>
              <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value={ALL}>All grades</option>
                {[4, 5, 6].map((g) => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </div>
            <div>
              <Label>Component</Label>
              <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={component} onChange={(e) => setComponent(e.target.value)}>
                <option value={ALL}>All components</option>
                <option value="CBT">CBT (Curriculum)</option>
                <option value="AT">AT (Ability)</option>
                <option value="PT">PT (Performance Task)</option>
              </select>
            </div>
            <div>
              <Label>Subject</Label>
              <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value={ALL}>All subjects</option>
                {SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Variations per source item</Label>
              <Input type="number" min={1} max={10} value={perParent} onChange={(e) => setPerParent(Math.max(1, Math.min(10, Number(e.target.value))))} />
            </div>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={officialOnly} onChange={(e) => setOfficialOnly(e.target.checked)} />
            Only expand official MOEY items (uncheck to also expand AI items)
          </label>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button onClick={runContinuous} disabled={running}>{running ? "Generating…" : "Run until complete"}</Button>
            {running && <Button variant="secondary" onClick={() => { stop.current = true; }}>Stop</Button>}
            <span className="text-sm text-muted-foreground">
              {stats.inserted} added · {stats.processed} source items expanded · {stats.remaining} to go
            </span>
          </div>

          {log.length > 0 && (
            <ul className="mt-4 max-h-64 space-y-1 overflow-auto rounded-xl bg-muted/50 p-3 font-mono text-xs">
              {log.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          )}
        </section>

        <aside className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="font-bold">Coverage</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-muted/50 p-3"><div className="text-lg font-bold">{cov?.parents ?? "—"}</div><div className="text-[11px] text-muted-foreground">Source items</div></div>
            <div className="rounded-xl bg-muted/50 p-3"><div className="text-lg font-bold">{cov?.variations ?? "—"}</div><div className="text-[11px] text-muted-foreground">Variations</div></div>
            <div className="rounded-xl bg-muted/50 p-3"><div className="text-lg font-bold">{cov?.total ?? "—"}</div><div className="text-[11px] text-muted-foreground">Total bank</div></div>
          </div>
          <ul className="mt-4 space-y-2 text-xs">
            {(cov?.buckets ?? []).map((b) => (
              <li key={`${b.grade}-${b.subject}-${b.component}`} className="rounded-lg border p-2">
                <div className="font-semibold">Grade {b.grade} · {String(b.subject ?? "").replace("_", " ")} · {b.component}</div>
                <div className="text-muted-foreground">{b.complete}/{b.parents} items fully expanded · {b.variations} variations</div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </AppShell>
  );
}
