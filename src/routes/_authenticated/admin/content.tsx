import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ADMIN_NAV } from "./index";
import {
  listTopics, upsertTopic, deleteTopic,
  listQuestions, upsertQuestion, deleteQuestion,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/content")({ component: AdminContent });

const SUBJECTS = ["math", "language_arts", "science", "social_studies"] as const;
const COMPONENTS = ["ability", "curriculum", "performance_task"] as const;
const QTYPES = ["mcq", "multi", "short", "numeric", "perf_task"] as const;

function AdminContent() {
  const qc = useQueryClient();
  const listT = useServerFn(listTopics);
  const listQ = useServerFn(listQuestions);
  const delT = useServerFn(deleteTopic);
  const delQ = useServerFn(deleteQuestion);
  const { data: topics = [] } = useQuery({ queryKey: ["admin","topics"], queryFn: () => listT() });
  const [topicId, setTopicId] = useState<string | undefined>();
  const [sourceFilter, setSourceFilter] = useState<"all"|"moey_official_2018"|"ai_generated">("all");
  const [reviewOnly, setReviewOnly] = useState(false);
  const { data: questions = [] } = useQuery({
    queryKey: ["admin","questions", topicId, sourceFilter, reviewOnly],
    queryFn: () => listQ({ data: { topic_id: topicId, source: sourceFilter, needs_review: reviewOnly ? true : undefined } }),
  });

  return (
    <AppShell nav={ADMIN_NAV} title="Content management">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-2xl border bg-card p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Topics & strands</h2>
            <TopicDialog onSaved={() => qc.invalidateQueries({ queryKey: ["admin","topics"] })} />
          </div>
          <ul className="max-h-[65vh] overflow-y-auto text-sm">
            <li>
              <button className={`w-full rounded-lg px-2 py-1 text-left ${!topicId?"bg-secondary":""}`} onClick={() => setTopicId(undefined)}>All questions</button>
            </li>
            {topics.map((t: any) => (
              <li key={t.id} className="flex items-center gap-1">
                <button className={`flex-1 rounded-lg px-2 py-1 text-left ${topicId===t.id?"bg-secondary":""}`} onClick={() => setTopicId(t.id)}>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">G{t.grade} · {t.subject} · {t.component}</div>
                </button>
                <TopicDialog topic={t} onSaved={() => qc.invalidateQueries({ queryKey: ["admin","topics"] })} />
                <Button size="sm" variant="ghost" onClick={async () => {
                  if (!confirm(`Delete topic "${t.name}"?`)) return;
                  await delT({ data: { id: t.id } });
                  qc.invalidateQueries({ queryKey: ["admin","topics"] });
                }}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border bg-card p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Questions {topicId ? "" : "(all topics)"}</h2>
            <QuestionDialog topics={topics} defaultTopicId={topicId} onSaved={() => qc.invalidateQueries({ queryKey: ["admin","questions"] })} />
          </div>
          <ul className="divide-y">
            {questions.map((q: any) => (
              <li key={q.id} className="flex items-start gap-2 py-2">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{q.type}</span>
                    {q.topics && <span>G{q.topics.grade} · {q.topics.subject} · {q.topics.component} · {q.topics.name}</span>}
                    <span>· diff {q.difficulty}</span>
                  </div>
                  <div className="mt-1 text-sm">{q.stem}</div>
                </div>
                <QuestionDialog topics={topics} question={q} onSaved={() => qc.invalidateQueries({ queryKey: ["admin","questions"] })} />
                <Button size="sm" variant="ghost" onClick={async () => {
                  if (!confirm("Delete this question?")) return;
                  await delQ({ data: { id: q.id } });
                  qc.invalidateQueries({ queryKey: ["admin","questions"] });
                }}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
            {questions.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No questions.</li>}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}

function TopicDialog({ topic, onSaved }: { topic?: any; onSaved: () => void }) {
  const fn = useServerFn(upsertTopic);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(topic?.name ?? "");
  const [subject, setSubject] = useState<typeof SUBJECTS[number]>(topic?.subject ?? "math");
  const [grade, setGrade] = useState<number>(topic?.grade ?? 5);
  const [component, setComponent] = useState<typeof COMPONENTS[number]>(topic?.component ?? "curriculum");
  const [strand, setStrand] = useState(topic?.strand ?? "");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      await fn({ data: { id: topic?.id, name, subject, grade, component, strand: strand || null } });
      toast.success("Saved"); setOpen(false); onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {topic ? <Button size="sm" variant="ghost"><Pencil className="h-4 w-4" /></Button> : <Button size="sm">New topic</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{topic ? "Edit topic" : "New topic"}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Subject</Label>
              <Select value={subject} onValueChange={(v) => setSubject(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Grade</Label>
              <Select value={String(grade)} onValueChange={(v) => setGrade(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[4,5,6].map((g) => <SelectItem key={g} value={String(g)}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Component</Label>
              <Select value={component} onValueChange={(v) => setComponent(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COMPONENTS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Strand (optional)</Label><Input value={strand} onChange={(e) => setStrand(e.target.value)} /></div>
          <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QuestionDialog({ topics, question, defaultTopicId, onSaved }: { topics: any[]; question?: any; defaultTopicId?: string; onSaved: () => void }) {
  const fn = useServerFn(upsertQuestion);
  const [open, setOpen] = useState(false);
  const [topicId, setTopicId] = useState<string>(question?.topic_id ?? defaultTopicId ?? topics[0]?.id ?? "");
  const [type, setType] = useState<typeof QTYPES[number]>(question?.type ?? "mcq");
  const [stem, setStem] = useState(question?.stem ?? "");
  const [options, setOptions] = useState<string>(JSON.stringify(question?.options ?? ["", "", "", ""], null, 2));
  const [answer, setAnswer] = useState<string>(JSON.stringify(question?.answer_key ?? "", null, 2));
  const [rubric, setRubric] = useState<string>(question?.rubric ? JSON.stringify(question.rubric, null, 2) : "");
  const [difficulty, setDifficulty] = useState<number>(question?.difficulty ?? 2);
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const payload: any = { id: question?.id, topic_id: topicId, type, stem, difficulty, explanation: explanation || null };
      try { payload.options = options ? JSON.parse(options) : null; } catch { throw new Error("Options must be valid JSON"); }
      try { payload.answer_key = answer ? JSON.parse(answer) : null; } catch { throw new Error("Answer key must be valid JSON"); }
      try { payload.rubric = rubric ? JSON.parse(rubric) : null; } catch { throw new Error("Rubric must be valid JSON"); }
      await fn({ data: payload });
      toast.success("Saved"); setOpen(false); onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {question ? <Button size="sm" variant="ghost"><Pencil className="h-4 w-4" /></Button> : <Button size="sm">New question</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{question ? "Edit question" : "New question"}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><Label>Topic</Label>
              <Select value={topicId} onValueChange={setTopicId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{topics.map((t) => <SelectItem key={t.id} value={t.id}>G{t.grade} · {t.subject} · {t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{QTYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Stem</Label><Textarea required rows={2} value={stem} onChange={(e) => setStem(e.target.value)} /></div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><Label>Options (JSON array or null)</Label><Textarea rows={5} className="font-mono text-xs" value={options} onChange={(e) => setOptions(e.target.value)} /></div>
            <div><Label>Answer key (JSON)</Label><Textarea rows={5} className="font-mono text-xs" value={answer} onChange={(e) => setAnswer(e.target.value)} /></div>
          </div>
          {type === "perf_task" && (
            <div><Label>Rubric (JSON)</Label><Textarea rows={4} className="font-mono text-xs" value={rubric} onChange={(e) => setRubric(e.target.value)} /></div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <div><Label>Difficulty (1-5)</Label><Input type="number" min={1} max={5} value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} /></div>
            <div><Label>Explanation</Label><Input value={explanation} onChange={(e) => setExplanation(e.target.value)} /></div>
          </div>
          <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
