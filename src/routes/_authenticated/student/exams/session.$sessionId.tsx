import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { getExamSession, saveExamAnswer, submitExamSession } from "@/lib/exam.functions";
import { QuestionRenderer } from "@/components/QuestionRenderer";
import { StemText } from "@/components/StemText";
import { Button } from "@/components/ui/button";
import { Flag, ChevronLeft, ChevronRight, Timer } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/student/exams/session/$sessionId")({ component: ExamSession });

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ExamSession() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getExamSession);
  const saveFn = useServerFn(saveExamAnswer);
  const submitFn = useServerFn(submitExamSession);

  const { data, isLoading } = useQuery({
    queryKey: ["exam", sessionId],
    queryFn: () => getFn({ data: { session_id: sessionId } }),
    refetchOnWindowFocus: false,
  });

  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!data) return;
    setRemaining(data.session.remaining_seconds);
    const a: Record<string, any> = {}; const f: Record<string, boolean> = {};
    for (const it of data.items as any[]) { if (it.student_answer !== null) a[it.id] = it.student_answer; if (it.flagged) f[it.id] = true; }
    setAnswers(a); setFlags(f);
  }, [data]);

  const items = (data?.items ?? []) as any[];
  const readOnly = data?.session?.status && data.session.status !== "in_progress";
  const current = items[idx];

  // Countdown
  useEffect(() => {
    if (readOnly || !data) return;
    const iv = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(iv);
  }, [readOnly, data]);

  // Auto-submit at 0
  useEffect(() => {
    if (readOnly || !data || submittedRef.current) return;
    if (remaining <= 0) {
      submittedRef.current = true;
      submitFn({ data: { session_id: sessionId, auto: true } }).then(() => {
        toast.info("Time's up — exam auto-submitted");
        navigate({ to: "/student/exams/result/$sessionId", params: { sessionId } });
      }).catch(() => {});
    }
  }, [remaining, readOnly, data, sessionId, submitFn, navigate]);

  async function saveAnswer(v: any) {
    if (!current || readOnly) return;
    setAnswers((prev) => ({ ...prev, [current.id]: v }));
    try { await saveFn({ data: { session_id: sessionId, item_id: current.id, answer: v } }); } catch { /* ignore */ }
  }
  async function toggleFlag() {
    if (!current || readOnly) return;
    const next = !flags[current.id];
    setFlags((p) => ({ ...p, [current.id]: next }));
    try { await saveFn({ data: { session_id: sessionId, item_id: current.id, flagged: next } }); } catch { /* ignore */ }
  }
  async function doSubmit() {
    const answered = Object.keys(answers).length;
    if (answered < items.length) {
      if (!confirm(`You have ${items.length - answered} unanswered. Submit anyway?`)) return;
    }
    setSubmitting(true);
    try {
      submittedRef.current = true;
      await submitFn({ data: { session_id: sessionId } });
      qc.invalidateQueries({ queryKey: ["exams","history"] });
      navigate({ to: "/student/exams/result/$sessionId", params: { sessionId } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Submit failed"); setSubmitting(false); }
  }

  const answeredCount = useMemo(() => Object.values(answers).filter((v) => v !== null && v !== undefined && v !== "").length, [answers]);

  if (isLoading || !data) return <div className="grid min-h-screen place-items-center">Loading exam…</div>;

  const totalSecs = data.session.time_limit_seconds;
  const urgent = remaining < 60;

  return (
    <div className="min-h-screen bg-background">
      <header className={`sticky top-0 z-10 border-b ${urgent ? "bg-destructive/10" : "bg-background/95"} backdrop-blur`}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="text-sm">
            <div className="display font-bold">Mock Exam · Grade {data.session.grade} · {data.session.component}{data.session.subject ? ` · ${data.session.subject.replace("_"," ")}` : ""}</div>
            <div className="text-xs text-muted-foreground">Question {idx + 1} of {items.length} · {answeredCount} answered</div>
          </div>
          <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-lg font-bold tabular-nums ${urgent ? "bg-destructive text-destructive-foreground" : "bg-secondary"}`} aria-live="polite">
            <Timer className="h-5 w-5" /> {fmt(Math.max(0, remaining))}
          </div>
          {!readOnly && <Button onClick={doSubmit} disabled={submitting} size="sm" className="rounded-full">Submit</Button>}
          {readOnly && <Button size="sm" variant="secondary" onClick={() => navigate({ to: "/student/exams/result/$sessionId", params: { sessionId } })} className="rounded-full">See report</Button>}
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-2">
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${((totalSecs - remaining) / Math.max(1,totalSecs)) * 100}%` }} />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-4 px-4 py-6 md:grid-cols-[1fr_240px]">
        <section className="rounded-3xl border bg-card p-5 shadow-sm">
          {current ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{current.subject ?? "—"} · {current.strand ?? "general"}</div>
                  <StemText stem={current.question?.stem ?? ""} className="mt-2 display text-lg font-bold" />
                </div>
                {!readOnly && (
                  <Button variant={flags[current.id] ? "default" : "outline"} size="sm" onClick={toggleFlag} className="rounded-full" aria-pressed={flags[current.id] ?? false}>
                    <Flag className="mr-1 h-4 w-4" /> {flags[current.id] ? "Flagged" : "Flag"}
                  </Button>
                )}
              </div>
              <div className="mt-5">
                {current.question ? (
                  <QuestionRenderer q={current.question} value={answers[current.id]} onChange={saveAnswer} disabled={!!readOnly} />
                ) : <div className="text-sm text-muted-foreground">Question unavailable.</div>}
              </div>
              <div className="mt-6 flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} className="rounded-full">
                  <ChevronLeft className="mr-1 h-4 w-4" /> Prev
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIdx(Math.min(items.length - 1, idx + 1))} disabled={idx >= items.length - 1} className="rounded-full">
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </>
          ) : <p className="text-sm text-muted-foreground">No questions.</p>}
        </section>

        <aside className="rounded-3xl border bg-card p-4 shadow-sm">
          <div className="display text-sm font-bold">Review grid</div>
          <div className="mt-3 grid grid-cols-6 gap-1.5 md:grid-cols-5">
            {items.map((it, i) => {
              const answered = answers[it.id] !== undefined && answers[it.id] !== null && answers[it.id] !== "";
              const flagged = flags[it.id];
              const isCurr = i === idx;
              return (
                <button key={it.id} onClick={() => setIdx(i)} aria-label={`Go to question ${i + 1}`}
                  className={`relative aspect-square rounded-lg border text-xs font-bold ${
                    isCurr ? "border-primary ring-2 ring-primary" : "border-transparent"
                  } ${answered ? "bg-secondary" : "bg-muted"} hover:bg-secondary`}>
                  {i + 1}
                  {flagged && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-500" />}
                </button>
              );
            })}
          </div>
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <div><span className="mr-1 inline-block h-2 w-2 rounded-full bg-secondary align-middle" /> answered</div>
            <div><span className="mr-1 inline-block h-2 w-2 rounded-full bg-muted align-middle" /> unanswered</div>
            <div><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" /> flagged</div>
          </div>
        </aside>
      </main>
    </div>
  );
}
