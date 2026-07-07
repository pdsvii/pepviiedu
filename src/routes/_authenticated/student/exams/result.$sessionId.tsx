import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { BandBadge } from "@/components/BandBadge";
import { getExamResult, getExamSession } from "@/lib/exam.functions";
import { BAND_MESSAGE } from "@/lib/pep";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/student/exams/result/$sessionId")({ component: ExamResult });

const NAV = [
  { to: "/student", label: "Home" },
  { to: "/student/practice", label: "Practice" },
  { to: "/student/exams", label: "Mock Exams" },
  { to: "/student/rewards", label: "My Rewards" },
];

function ExamResult() {
  const { sessionId } = Route.useParams();
  const resFn = useServerFn(getExamResult);
  const sessFn = useServerFn(getExamSession);
  const { data: r } = useQuery({ queryKey: ["exam-result", sessionId], queryFn: () => resFn({ data: { session_id: sessionId } }) });
  const { data: s } = useQuery({ queryKey: ["exam-full", sessionId], queryFn: () => sessFn({ data: { session_id: sessionId } }) });

  const session = r?.session;
  const result = r?.result;
  if (!session) return <AppShell variant="student" nav={NAV} title="Loading…"><p>Loading…</p></AppShell>;

  const perSubject = (result?.per_subject ?? {}) as Record<string, { pct: number; band: any }>;
  const perStrand = (result?.per_strand ?? {}) as Record<string, { pct: number; subject: string | null }>;
  const strands = Object.entries(perStrand).sort((a, b) => a[1].pct - b[1].pct);
  const weakest = strands.slice(0, 3);
  const strongest = [...strands].reverse().slice(0, 3);

  return (
    <AppShell variant="student" nav={NAV} title="Your exam report 🎓">
      <section className="rounded-3xl bg-secondary p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Grade {session.grade} · {session.component}{session.subject ? ` · ${session.subject.replace("_"," ")}` : ""}</div>
            <div className="display mt-1 text-4xl font-extrabold">{result?.overall_pct ?? 0}%</div>
            <div className="mt-1 text-sm">Time used: {Math.round((result?.time_used_seconds ?? 0) / 60)} min</div>
          </div>
          {result?.overall_band && <BandBadge band={result.overall_band} />}
        </div>
        {result?.overall_band && <p className="mt-3 text-sm">{BAND_MESSAGE[result.overall_band as keyof typeof BAND_MESSAGE]}</p>}
      </section>

      {Object.keys(perSubject).length > 0 && (
        <section className="mt-6">
          <h2 className="display text-lg font-bold">By subject</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {Object.entries(perSubject).map(([k, v]) => (
              <div key={k} className="rounded-2xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="font-bold capitalize">{k.replace("_", " ")}</div>
                  <BandBadge band={v.band} />
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${v.pct}%` }} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{v.pct}%</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4">
          <h3 className="display text-sm font-bold">Strengths</h3>
          {strongest.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">—</p> : (
            <ul className="mt-2 space-y-1 text-sm">
              {strongest.map(([k, v]) => (
                <li key={k} className="flex justify-between"><span className="capitalize">{k.split("::").join(" · ").replace(/_/g," ")}</span><span className="font-bold">{v.pct}%</span></li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <h3 className="display text-sm font-bold">Practice next</h3>
          {weakest.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">—</p> : (
            <ul className="mt-2 space-y-1 text-sm">
              {weakest.map(([k, v]) => (
                <li key={k} className="flex justify-between"><span className="capitalize">{k.split("::").join(" · ").replace(/_/g," ")}</span><span className="font-bold">{v.pct}%</span></li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="display text-lg font-bold">Answer review</h2>
        <ul className="mt-3 space-y-3">
          {(s?.items ?? []).map((it: any, i: number) => (
            <li key={it.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Q{i+1} · {it.subject ?? "—"} · {it.strand ?? "general"}</div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${it.is_correct ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                  {it.is_correct ? "Correct" : "Review"}
                </span>
              </div>
              <p className="mt-1 font-medium">{it.question?.stem}</p>
              <div className="mt-2 text-sm">
                <div><b>Your answer:</b> {JSON.stringify(it.student_answer) ?? "—"}</div>
                {it.question?.answer_key && <div><b>Correct:</b> {JSON.stringify(it.question.answer_key)}</div>}
                {it.question?.explanation && <div className="mt-1 text-muted-foreground">{it.question.explanation}</div>}
                {it.ai_feedback?.ai && <div className="mt-1 rounded-lg bg-muted p-2 text-xs">💬 {it.ai_feedback.ai}</div>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6">
        <Link to="/student/exams"><Button variant="outline" className="rounded-full">Back to Mock Exams</Button></Link>
      </div>
    </AppShell>
  );
}
