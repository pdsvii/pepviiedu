import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BandBadge } from "@/components/BandBadge";
import { Button } from "@/components/ui/button";
import { listExamBlueprints, startExamSession, listMyExamSessions } from "@/lib/exam.functions";
import { getMyRole } from "@/lib/roles.functions";
import { SUBJECTS, COMPONENTS } from "@/lib/pep";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/student/exams/")({ component: ExamsHome });

const NAV = [
  { to: "/student", label: "Home" },
  { to: "/student/practice", label: "Practice" },
  { to: "/student/exams", label: "Mock Exams" },
  { to: "/student/rewards", label: "My Rewards" },
];

function ExamsHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const meFn = useServerFn(getMyRole);
  const bpFn = useServerFn(listExamBlueprints);
  const histFn = useServerFn(listMyExamSessions);
  const startFn = useServerFn(startExamSession);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const { data: blueprints = [] } = useQuery({ queryKey: ["exams","blueprints"], queryFn: () => bpFn() });
  const { data: history = [] } = useQuery({ queryKey: ["exams","history"], queryFn: () => histFn() });

  const grade = me?.profile?.grade ?? 5;
  const [component, setComponent] = useState<"AT"|"CBT"|"PT">("CBT");
  const [subject, setSubject] = useState<string>("mathematics");
  const [busy, setBusy] = useState(false);

  const needsSubject = component === "CBT";
  const bp = (blueprints as any[]).find((b) => b.grade === grade && b.component === component && (needsSubject ? b.subject === subject : b.subject === null));

  async function start() {
    setBusy(true);
    try {
      const res = await startFn({ data: { grade, component, subject: needsSubject ? subject as any : undefined } });
      qc.invalidateQueries({ queryKey: ["exams","history"] });
      navigate({ to: "/student/exams/session/$sessionId", params: { sessionId: res.session_id } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not start"); }
    finally { setBusy(false); }
  }

  const resumable = (history as any[]).filter((s) => s.status === "in_progress");
  const completed = (history as any[]).filter((s) => s.status !== "in_progress");

  return (
    <AppShell variant="student" nav={NAV} title="Mock Exams 🎯">
      <p className="text-sm text-muted-foreground">Full timed PEP-style paper. Once the timer starts you can't see correct answers until you submit.</p>

      {resumable.length > 0 && (
        <section className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="display text-lg font-bold">Resume an exam</h2>
          <ul className="mt-2 divide-y">
            {resumable.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-bold">Grade {s.grade} — {s.component}{s.subject ? ` · ${s.subject.replace("_"," ")}` : ""}</div>
                  <div className="text-xs text-muted-foreground">Started {new Date(s.started_at).toLocaleString()} · {Math.round(s.remaining_seconds/60)}m left</div>
                </div>
                <Link to="/student/exams/session/$sessionId" params={{ sessionId: s.id }}><Button size="sm" className="rounded-full">Resume</Button></Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-3xl bg-secondary p-6">
        <h2 className="display text-lg font-bold">Start a new mock exam</h2>
        <p className="text-xs text-muted-foreground">Grade {grade} · structured to MOEY PEP examination standards</p>

        <div className="mt-4">
          <div className="text-sm font-semibold">Component</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {COMPONENTS.map((c) => (
              <button key={c.key} type="button" onClick={() => setComponent(c.key)}
                className={`rounded-2xl border-2 p-4 text-left transition-colors ${component === c.key ? "border-primary bg-card" : "border-transparent bg-card/60 hover:bg-card"}`}>
                <div className="font-bold">{c.label}</div>
                <div className="text-xs text-muted-foreground">{c.blurb}</div>
              </button>
            ))}
          </div>
        </div>

        {needsSubject && (
          <div className="mt-4">
            <div className="text-sm font-semibold">Subject</div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SUBJECTS.map((s) => (
                <button key={s.key} type="button" onClick={() => setSubject(s.key)}
                  className={`rounded-2xl border-2 p-3 text-center transition-colors ${subject === s.key ? "border-primary bg-card" : "border-transparent bg-card/60 hover:bg-card"}`}>
                  <div className="text-2xl">{s.emoji}</div>
                  <div className="mt-1 text-sm font-bold">{s.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {bp && (
          <div className="mt-5 rounded-2xl bg-card/70 p-4">
            <div className="text-sm font-semibold">Paper structure (MOEY standard)</div>
            <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
              <div className="rounded-xl bg-secondary/60 p-3"><b>{bp.item_count}</b> questions</div>
              <div className="rounded-xl bg-secondary/60 p-3"><b>{bp.duration_minutes}</b> minutes, timed</div>
              <div className="rounded-xl bg-secondary/60 p-3">
                {Object.entries((bp.item_mix ?? {}) as Record<string, number>).map(([t, w]) => `${t.replace("_", " ")} ${Math.round(Number(w) * 100)}%`).join(" · ") || "Mixed item types"}
              </div>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>Questions are balanced across every strand for your grade and ramp up from easier to harder.</li>
              <li>The countdown keeps running — the paper submits itself when time is up.</li>
              <li>Bands: Beginning · Developing ({bp.band_cuts?.developing ?? 50}%) · Proficient ({bp.band_cuts?.proficient ?? 70}%) · Highly Proficient ({bp.band_cuts?.highly_proficient ?? 85}%).</li>
              <li>You can flag questions and come back to them before you submit.</li>
            </ul>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between rounded-2xl bg-card/70 p-4">
          <div className="text-sm">
            {bp
              ? <>Ready when you are — <b>{bp.item_count}</b> questions in <b>{bp.duration_minutes}</b> minutes.</>
              : <span className="text-muted-foreground">No blueprint configured for this option.</span>}
          </div>
          <Button onClick={start} disabled={!bp || busy} size="lg" className="rounded-full">
            {busy ? "Starting…" : "Start exam"}
          </Button>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="display text-lg font-bold">Past exams</h2>
        {completed.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Your finished mock exams will show up here.</p>
        ) : (
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {completed.map((s) => (
              <li key={s.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold">Grade {s.grade} — {s.component}{s.subject ? ` · ${s.subject.replace("_"," ")}` : ""}</div>
                    <div className="text-xs text-muted-foreground">{new Date(s.submitted_at ?? s.started_at).toLocaleString()}</div>
                  </div>
                  {s.overall_band && <BandBadge band={s.overall_band} />}
                </div>
                <Link to="/student/exams/result/$sessionId" params={{ sessionId: s.id }}>
                  <Button size="sm" variant="secondary" className="mt-3 rounded-full">See report</Button>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
