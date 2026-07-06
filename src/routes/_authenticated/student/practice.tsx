import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { startPracticeSession, submitAnswer, finishPracticeSession } from "@/lib/practice.functions";
import { AppShell } from "@/components/AppShell";
import { QuestionRenderer, type Question } from "@/components/QuestionRenderer";
import { BandBadge } from "@/components/BandBadge";
import { BAND_MESSAGE, SUBJECTS, COMPONENTS, type Band, type Subject, type PepComponent } from "@/lib/pep";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

const search = z.object({
  subject: z.enum(["mathematics","language_arts","science","social_studies"]).optional(),
  grade: z.number().int().min(4).max(6).optional(),
  component: z.enum(["AT","CBT","PT"]).optional(),
  assignment_id: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/student/practice")({
  validateSearch: search,
  component: PracticePage,
});

const NAV = [
  { to: "/student", label: "Home" },
  { to: "/student/practice", label: "Practice" },
  { to: "/student/rewards", label: "My Rewards" },
];

type Stage = "pick" | "playing" | "done";

function PracticePage() {
  const params = Route.useSearch();
  const navigate = useNavigate();
  const start = useServerFn(startPracticeSession);
  const submit = useServerFn(submitAnswer);
  const finish = useServerFn(finishPracticeSession);

  const [subject, setSubject] = useState<Subject>(params.subject ?? "mathematics");
  const [grade, setGrade] = useState<number>(params.grade ?? 5);
  const [component, setComponent] = useState<PepComponent>(params.component ?? "CBT");
  const [stage, setStage] = useState<Stage>(params.assignment_id ? "playing" : "pick");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [passages, setPassages] = useState<any[]>([]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState<any>(null);
  const [feedback, setFeedback] = useState<null | { correct: boolean | null; explanation?: string | null }>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ band: Band; pct: number } | null>(null);

  useEffect(() => {
    if (params.assignment_id) begin({ assignment_id: params.assignment_id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function begin(extra?: { assignment_id?: string }) {
    setLoading(true);
    try {
      const res = await start({ data: { subject, grade, component, count: 6, ...extra } });
      if (!res.attempt_id || res.questions.length === 0) {
        toast.error("No questions for that combination yet.");
        setStage("pick");
        return;
      }
      setAttemptId(res.attempt_id);
      setQuestions(res.questions as Question[]);
      setPassages(res.passages || []);
      setIdx(0); setAnswer(null); setFeedback(null);
      setStage("playing");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start session");
    } finally { setLoading(false); }
  }

  async function submitCurrent() {
    if (!attemptId) return;
    const q = questions[idx];
    setLoading(true);
    try {
      const res = await submit({ data: { attempt_id: attemptId, question_id: q.id, response: answer } });
      setFeedback({ correct: res.correct, explanation: res.explanation });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit answer");
    } finally { setLoading(false); }
  }

  async function next() {
    if (idx + 1 >= questions.length) {
      setLoading(true);
      try {
        const r = await finish({ data: { attempt_id: attemptId! } });
        setResult(r as any);
        setStage("done");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not finish");
      } finally { setLoading(false); }
      return;
    }
    setIdx(idx + 1); setAnswer(null); setFeedback(null);
  }

  const currentPassage = useMemo(() => {
    const q = questions[idx];
    return q?.passage_id ? passages.find((p) => p.id === q.passage_id) : null;
  }, [idx, questions, passages]);

  return (
    <AppShell variant="student" nav={NAV} title="Practice">
      {stage === "pick" && (
        <div className="rounded-3xl bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Pick a subject, grade, and part of PEP to practise.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <PickerGroup label="Subject">
              {SUBJECTS.map((s) => (
                <PickerBtn key={s.key} on={subject === s.key} onClick={() => setSubject(s.key)}>{s.emoji} {s.label}</PickerBtn>
              ))}
            </PickerGroup>
            <PickerGroup label="Grade">
              {[4,5,6].map((g) => (
                <PickerBtn key={g} on={grade === g} onClick={() => setGrade(g)}>Grade {g}</PickerBtn>
              ))}
            </PickerGroup>
            <PickerGroup label="Component">
              {COMPONENTS.map((c) => (
                <PickerBtn key={c.key} on={component === c.key} onClick={() => setComponent(c.key)}>
                  <div className="font-bold">{c.label}</div>
                  <div className="text-xs text-muted-foreground">{c.blurb}</div>
                </PickerBtn>
              ))}
            </PickerGroup>
          </div>
          <Button className="mt-6 rounded-full" size="lg" onClick={() => begin()} disabled={loading}>Start practice</Button>
        </div>
      )}

      {stage === "playing" && questions[idx] && (
        <div className="rounded-3xl bg-card p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-muted-foreground">Question {idx + 1} of {questions.length}</div>
            <div className="w-40"><Progress value={((idx + (feedback ? 1 : 0)) / questions.length) * 100} /></div>
          </div>

          {currentPassage && (
            <div className="mb-4 rounded-2xl bg-secondary p-4">
              {currentPassage.title && <div className="mb-1 font-bold">{currentPassage.title}</div>}
              <p className="whitespace-pre-line text-sm leading-relaxed">{currentPassage.body}</p>
            </div>
          )}

          <div className="mb-4 text-lg font-semibold">{questions[idx].stem}</div>
          <QuestionRenderer q={questions[idx]} value={answer} onChange={setAnswer} disabled={!!feedback} />

          {feedback && (
            <div className={`mt-4 rounded-2xl p-4 ${feedback.correct ? "bg-secondary" : feedback.correct === false ? "bg-accent" : "bg-muted"}`}>
              <div className="font-bold">
                {feedback.correct === true ? "Nice work! 🌟" : feedback.correct === false ? "Not quite — let's learn together." : "Answer saved. Your teacher will review it."}
              </div>
              {feedback.explanation && <p className="mt-1 text-sm">{feedback.explanation}</p>}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            {!feedback ? (
              <Button size="lg" className="rounded-full" onClick={submitCurrent} disabled={loading || answer === null || answer === ""}>
                Check answer
              </Button>
            ) : (
              <Button size="lg" className="rounded-full" onClick={next} disabled={loading}>
                {idx + 1 >= questions.length ? "Finish" : "Next"}
              </Button>
            )}
          </div>
        </div>
      )}

      {stage === "done" && result && (
        <div className="rounded-3xl bg-secondary p-8 text-center shadow-sm">
          <div className="text-6xl">🎉</div>
          <h2 className="display mt-3 text-2xl font-extrabold">Session complete!</h2>
          <div className="mt-4 flex justify-center"><BandBadge band={result.band} size="lg" /></div>
          <p className="mx-auto mt-3 max-w-md text-sm">{BAND_MESSAGE[result.band]}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button className="rounded-full" onClick={() => { setStage("pick"); setResult(null); }}>Practise again</Button>
            <Button variant="secondary" className="rounded-full" onClick={() => navigate({ to: "/student" })}>Back to home</Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function PickerGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}
function PickerBtn({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-2xl border-2 px-4 py-3 text-left ${on ? "border-primary bg-secondary" : "border-transparent bg-muted hover:bg-secondary"}`}>
      {children}
    </button>
  );
}
