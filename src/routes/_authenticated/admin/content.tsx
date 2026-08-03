import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ADMIN_NAV } from "./index";
import {
  listTopics, upsertTopic, deleteTopic,
  listQuestions, upsertQuestion, deleteQuestion,
} from "@/lib/admin.functions";
import { QuestionRenderer, type Question } from "@/components/QuestionRenderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Pencil, ChevronDown, ChevronRight, Check, X, RotateCcw, Star, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/content")({
  component: AdminContent,
  head: () => ({
    meta: [
      { title: "Content Studio — viiedu | PEP Ready" },
      { name: "description", content: "Manage PEP topics and interactive practice questions: preview, answer and edit every item." },
      { property: "og:title", content: "Content Studio — viiedu | PEP Ready" },
      { property: "og:description", content: "Manage PEP topics and interactive practice questions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SUBJECTS = ["mathematics", "language_arts", "science", "social_studies"] as const;
const COMPONENTS = ["AT", "CBT", "PT"] as const;
const QTYPES = ["mc", "multi", "tf", "numeric", "short_text", "pt_scenario", "matching", "ordering"] as const;

const SUBJECT_LABEL: Record<string, string> = {
  mathematics: "Mathematics",
  language_arts: "Language Arts",
  science: "Science",
  social_studies: "Social Studies",
};
const COMPONENT_LABEL: Record<string, string> = { AT: "Ability Test", CBT: "Curriculum-Based", PT: "Performance Task" };
const TYPE_LABEL: Record<string, string> = {
  mc: "Multiple choice", multi: "Select all", tf: "True / False", numeric: "Numeric",
  short_text: "Short answer", pt_scenario: "Performance task", matching: "Matching", ordering: "Ordering",
};

function normalizeOptions(options: any): string[] | null {
  if (!options) return null;
  if (Array.isArray(options)) return options.map((o) => (typeof o === "string" ? o : (o?.text ?? o?.label ?? JSON.stringify(o))));
  if (typeof options === "object") return Object.values(options).map((o: any) => String(o));
  return null;
}

/** Loose comparison so mixed answer_key shapes (index, letter, text, array) all work. */
function isCorrect(q: any, value: any): boolean | null {
  const key = q.answer_key;
  if (key === null || key === undefined || key === "") return null;
  const opts = normalizeOptions(q.options) ?? (q.type === "tf" ? ["True", "False"] : []);
  const norm = (v: any) => String(v).trim().toLowerCase();
  const toIndex = (k: any): number | null => {
    if (typeof k === "number") return k;
    const s = norm(k);
    if (/^[a-h]$/.test(s)) return s.charCodeAt(0) - 97;
    if (/^\d+$/.test(s)) return Number(s);
    const i = opts.findIndex((o) => norm(o) === s);
    return i >= 0 ? i : null;
  };

  if (q.type === "mc" || q.type === "tf") {
    const k = Array.isArray(key) ? key[0] : typeof key === "object" ? (key as any).value ?? (key as any).answer : key;
    const idx = toIndex(k);
    return idx === null ? null : value === idx;
  }
  if (q.type === "multi") {
    const keys = (Array.isArray(key) ? key : [key]).map(toIndex).filter((x): x is number => x !== null).sort();
    const got = (Array.isArray(value) ? value : []).slice().sort();
    return keys.length > 0 && keys.length === got.length && keys.every((k, i) => k === got[i]);
  }
  if (q.type === "numeric") {
    const k = Array.isArray(key) ? key[0] : typeof key === "object" ? (key as any).value : key;
    return Number(value) === Number(k);
  }
  if (q.type === "short_text") {
    const accepted = (Array.isArray(key) ? key : [key]).map(norm);
    return accepted.includes(norm(value));
  }
  return null;
}

function InteractiveQuestion({ q }: { q: any }) {
  const [value, setValue] = useState<any>(q.type === "multi" ? [] : undefined);
  const [checked, setChecked] = useState(false);
  const result = checked ? isCorrect(q, value) : null;
  const rq: Question = { id: q.id, type: q.type, stem: q.stem, options: normalizeOptions(q.options), passage_id: q.passage_id };
  const answerable = ["mc", "multi", "tf", "numeric", "short_text"].includes(q.type);

  return (
    <div className="student-surface grid gap-4 rounded-3xl border bg-card p-4 shadow-sm md:p-5">
      <StemText stem={q.stem} className="text-base font-semibold md:text-lg" />
      <QuestionRenderer q={rq} value={value} onChange={(v) => { setValue(v); setChecked(false); }} disabled={checked && result === true} />
      {answerable && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setChecked(true)} disabled={value === undefined || value === "" || (Array.isArray(value) && value.length === 0)}>
            Check answer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setValue(q.type === "multi" ? [] : undefined); setChecked(false); }}>
            <RotateCcw className="mr-1 h-4 w-4" /> Reset
          </Button>
          {checked && result === true && (
            <span className="inline-flex items-center gap-1 rounded-full bg-leaf px-3 py-1 text-sm font-bold"><Check className="h-4 w-4" /> Correct!</span>
          )}
          {checked && result === false && (
            <span className="inline-flex items-center gap-1 rounded-full bg-apricot px-3 py-1 text-sm font-bold"><X className="h-4 w-4" /> Try again</span>
          )}
          {checked && result === null && (
            <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">No answer key saved yet</span>
          )}
        </div>
      )}
      {!answerable && (
        <p className="rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
          {TYPE_LABEL[q.type]} items are marked with a rubric — preview only.
        </p>
      )}
      {checked && q.explanation && (
        <div className="rounded-2xl bg-secondary/60 p-3 text-sm"><span className="font-bold">Why: </span>{q.explanation}</div>
      )}
    </div>
  );
}

function AdminContent() {
  const qc = useQueryClient();
  const listT = useServerFn(listTopics);
  const listQ = useServerFn(listQuestions);
  const delT = useServerFn(deleteTopic);
  const delQ = useServerFn(deleteQuestion);
  const { data: topics = [] } = useQuery({ queryKey: ["admin", "topics"], queryFn: () => listT() });
  const [topicId, setTopicId] = useState<string | undefined>();
  const [sourceFilter, setSourceFilter] = useState<"all" | "moey_official_2018" | "ai_generated">("all");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: questions = [] } = useQuery({
    queryKey: ["admin", "questions", topicId, sourceFilter, reviewOnly],
    queryFn: () => listQ({ data: { topic_id: topicId, source: sourceFilter, needs_review: reviewOnly ? true : undefined } }),
  });

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return s ? (questions as any[]).filter((q) => q.stem?.toLowerCase().includes(s)) : (questions as any[]);
  }, [questions, search]);

  return (
    <AppShell nav={ADMIN_NAV} title="Content studio">
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <aside className="h-fit rounded-3xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="display font-bold">Topics</h2>
            <TopicDialog onSaved={() => qc.invalidateQueries({ queryKey: ["admin", "topics"] })} />
          </div>
          <ul className="max-h-[65vh] space-y-1 overflow-y-auto text-sm">
            <li>
              <button className={`w-full rounded-xl px-3 py-2 text-left font-semibold ${!topicId ? "bg-secondary" : "hover:bg-muted"}`} onClick={() => setTopicId(undefined)}>
                All questions
              </button>
            </li>
            {(topics as any[]).map((t) => (
              <li key={t.id} className="flex items-center gap-1">
                <button className={`flex-1 rounded-xl px-3 py-2 text-left ${topicId === t.id ? "bg-secondary" : "hover:bg-muted"}`} onClick={() => setTopicId(t.id)}>
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">G{t.grade} · {SUBJECT_LABEL[t.subject] ?? t.subject} · {COMPONENT_LABEL[t.component] ?? t.component}</div>
                </button>
                <TopicDialog topic={t} onSaved={() => qc.invalidateQueries({ queryKey: ["admin", "topics"] })} />
                <Button size="sm" variant="ghost" aria-label="Delete topic" onClick={async () => {
                  if (!confirm(`Delete topic "${t.name}"?`)) return;
                  await delT({ data: { id: t.id } });
                  qc.invalidateQueries({ queryKey: ["admin", "topics"] });
                }}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="rounded-3xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="display mr-auto font-bold">Questions</h2>
            <QuestionDialog topics={topics as any[]} defaultTopicId={topicId} onSaved={() => qc.invalidateQueries({ queryKey: ["admin", "questions"] })} />
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-full bg-muted p-1 text-xs">
              {(["all", "moey_official_2018", "ai_generated"] as const).map((s) => (
                <button key={s} onClick={() => setSourceFilter(s)}
                  className={`rounded-full px-3 py-1.5 font-semibold ${sourceFilter === s ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
                  {s === "all" ? "All sources" : s === "moey_official_2018" ? "Official MOEY" : "AI-generated"}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold">
              <input type="checkbox" checked={reviewOnly} onChange={(e) => setReviewOnly(e.target.checked)} />
              Needs review
            </label>
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search question text" className="rounded-full pl-9" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground">{rows.length} shown</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="w-8" />
                  <TableHead className="min-w-[280px]">Question</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Component</TableHead>
                  <TableHead className="text-center">Diff.</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((q: any) => {
                  const open = openId === q.id;
                  return (
                    <Fragment key={q.id}>
                      <TableRow className="cursor-pointer align-top" onClick={() => setOpenId(open ? null : q.id)}>
                        <TableCell>{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                        <TableCell className="max-w-[420px]">
                          <span className="line-clamp-2 font-medium">{q.stem}</span>
                          {q.needs_review && <span className="mt-1 inline-block rounded-full bg-apricot px-2 py-0.5 text-xs font-bold">Needs review</span>}
                        </TableCell>
                        <TableCell><span className="whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{TYPE_LABEL[q.type] ?? q.type}</span></TableCell>
                        <TableCell>{q.topics ? `G${q.topics.grade}` : "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{q.topics ? SUBJECT_LABEL[q.topics.subject] ?? q.topics.subject : "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{q.topics ? COMPONENT_LABEL[q.topics.component] ?? q.topics.component : "—"}</TableCell>
                        <TableCell className="text-center text-sm">{q.difficulty}</TableCell>
                        <TableCell className="text-xs">
                          {q.source === "moey_official_2018" ? (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary" title={q.source_ref ?? undefined}>
                              <Star className="h-3 w-3" /> Official
                            </span>
                          ) : <span className="text-muted-foreground">AI</span>}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end">
                            <QuestionDialog topics={topics as any[]} question={q} onSaved={() => qc.invalidateQueries({ queryKey: ["admin", "questions"] })} />
                            <Button size="sm" variant="ghost" aria-label="Delete question" onClick={async () => {
                              if (!confirm("Delete this question?")) return;
                              await delQ({ data: { id: q.id } });
                              qc.invalidateQueries({ queryKey: ["admin", "questions"] });
                            }}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {open && (
                        <TableRow>
                          <TableCell colSpan={9} className="bg-muted/40 p-4">
                            <InteractiveQuestion q={q} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">No questions match these filters.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function TopicDialog({ topic, onSaved }: { topic?: any; onSaved: () => void }) {
  const fn = useServerFn(upsertTopic);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(topic?.name ?? "");
  const [subject, setSubject] = useState<typeof SUBJECTS[number]>(topic?.subject ?? "mathematics");
  const [grade, setGrade] = useState<number>(topic?.grade ?? 5);
  const [component, setComponent] = useState<typeof COMPONENTS[number]>(topic?.component ?? "CBT");
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
        {topic ? <Button size="sm" variant="ghost" aria-label="Edit topic"><Pencil className="h-4 w-4" /></Button> : <Button size="sm">New topic</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{topic ? "Edit topic" : "New topic"}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Subject</Label>
              <Select value={subject} onValueChange={(v) => setSubject(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{SUBJECT_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Grade</Label>
              <Select value={String(grade)} onValueChange={(v) => setGrade(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[4, 5, 6].map((g) => <SelectItem key={g} value={String(g)}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Component</Label>
              <Select value={component} onValueChange={(v) => setComponent(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COMPONENTS.map((c) => <SelectItem key={c} value={c}>{COMPONENT_LABEL[c]}</SelectItem>)}</SelectContent>
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
  const [type, setType] = useState<typeof QTYPES[number]>(question?.type ?? "mc");
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
        {question ? <Button size="sm" variant="ghost" aria-label="Edit question"><Pencil className="h-4 w-4" /></Button> : <Button size="sm">New question</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{question ? "Edit question" : "New question"}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><Label>Topic</Label>
              <Select value={topicId} onValueChange={setTopicId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{topics.map((t) => <SelectItem key={t.id} value={t.id}>G{t.grade} · {SUBJECT_LABEL[t.subject] ?? t.subject} · {t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{QTYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Stem</Label><Textarea required rows={2} value={stem} onChange={(e) => setStem(e.target.value)} /></div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><Label>Options (JSON array or null)</Label><Textarea rows={5} className="font-mono text-xs" value={options} onChange={(e) => setOptions(e.target.value)} /></div>
            <div><Label>Answer key (JSON)</Label><Textarea rows={5} className="font-mono text-xs" value={answer} onChange={(e) => setAnswer(e.target.value)} /></div>
          </div>
          {type === "pt_scenario" && (
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
