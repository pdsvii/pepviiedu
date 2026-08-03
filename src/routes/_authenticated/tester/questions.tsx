import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TESTER_NAV } from "./route";
import { StemText } from "@/components/StemText";
import { ReviewNoteDialog } from "@/components/ReviewNoteDialog";
import { listReviewQuestions, listReviewNotes } from "@/lib/tester.functions";
import { severityClass, statusClass, statusLabel, categoryLabel } from "@/lib/review-areas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tester/questions")({
  component: TesterQuestions,
  head: () => ({
    meta: [
      { title: "Question-by-question review | PEP Ready" },
      { name: "description", content: "Review each PEP Ready question, check the answer key and log corrections for the product team." },
      { property: "og:title", content: "Question-by-question review | PEP Ready" },
      { property: "og:description", content: "Review each PEP Ready question and log corrections." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const SUBJECTS = [
  { value: "all", label: "All subjects" },
  { value: "mathematics", label: "Mathematics" },
  { value: "language_arts", label: "Language Arts" },
  { value: "science", label: "Science" },
  { value: "social_studies", label: "Social Studies" },
];
const SOURCES = [
  { value: "all", label: "All sources" },
  { value: "moey_official_2018", label: "MOEY official" },
  { value: "ai_generated", label: "AI generated" },
  { value: "ai_variation", label: "AI variations" },
];

function TesterQuestions() {
  const listFn = useServerFn(listReviewQuestions);
  const [grade, setGrade] = useState("all");
  const [subject, setSubject] = useState("all");
  const [source, setSource] = useState("all");
  const [search, setSearch] = useState("");
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(false);

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["review", "questions", grade, subject, source, search, onlyUnreviewed],
    queryFn: () =>
      listFn({
        data: {
          ...(grade !== "all" ? { grade: Number(grade) } : {}),
          ...(subject !== "all" ? { subject: subject as never } : {}),
          source,
          ...(search ? { search } : {}),
          only_unreviewed: onlyUnreviewed,
          limit: 60,
        },
      }),
  });

  return (
    <AppShell nav={TESTER_NAV} title="Review every question">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={grade} onValueChange={setGrade}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All grades</SelectItem>
            {[4, 5, 6].map((g) => <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>{SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
        <Input className="max-w-xs" placeholder="Search question text…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button variant={onlyUnreviewed ? "default" : "outline"} size="sm" onClick={() => setOnlyUnreviewed((v) => !v)}>
          Not yet reviewed
        </Button>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading questions…</div>}

      <div className="grid gap-3">
        {questions.map((q: any) => <QuestionCard key={q.id} q={q} />)}
        {!isLoading && questions.length === 0 && (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            No questions match these filters.
          </div>
        )}
      </div>
    </AppShell>
  );
}

/** Collapsed preview: skip generic instruction lines like "Read the passage…". */
function previewLine(stem: string) {
  const lines = String(stem).split("\n").map((l) => l.trim()).filter(Boolean);
  const meaty = lines.find((l) => l.length > 25 && !/^read the (passage|following)/i.test(l));
  return meaty ?? lines[0] ?? "";
}

function QuestionCard({ q }: { q: any }) {
  const [open, setOpen] = useState(false);
  const notesFn = useServerFn(listReviewNotes);
  const { data: notes = [] } = useQuery({
    queryKey: ["review", "notes", "q", q.id],
    queryFn: () => notesFn({ data: { question_id: q.id } }),
    enabled: open,
  });
  const t = q.topics;
  const options: string[] = Array.isArray(q.options) ? q.options : [];
  const key = q.answer_key;

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-start gap-3 p-4 text-left hover:bg-muted/40">
        {open ? <ChevronDown className="mt-1 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-1 h-4 w-4 shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {t && <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">G{t.grade} · {String(t.subject).replace("_", " ")} · {t.component}</span>}
            <span className="rounded-full bg-muted px-2 py-0.5 font-semibold uppercase">{q.type}</span>
            {q.source && <span className="rounded-full bg-muted px-2 py-0.5">{q.source}</span>}
            {q.needs_review && <span className="rounded-full bg-destructive/15 px-2 py-0.5 font-semibold text-destructive">needs review</span>}
            {q.note_count > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary">
                <CheckCircle2 className="h-3 w-3" /> {q.note_count} note{q.note_count === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div className="mt-2 line-clamp-2 text-sm font-semibold">{previewLine(q.stem)}</div>
        </div>
      </button>

      {open && (
        <div className="border-t bg-muted/20 p-4">
          <div className="rounded-2xl bg-card p-4 text-sm shadow-sm">
            <StemText stem={q.stem} />
            {options.length > 0 && (
              <div className="mt-3 grid gap-2">
                {options.map((opt, i) => {
                  const correct =
                    key === i || key?.index === i || (Array.isArray(key?.indices) && key.indices.includes(i));
                  return (
                    <div key={i} className={`rounded-xl border-2 px-3 py-2 ${correct ? "border-primary bg-secondary" : "border-transparent bg-muted"}`}>
                      <span className="mr-2 font-bold">{String.fromCharCode(65 + i)}.</span>{opt}
                      {correct && <span className="ml-2 text-xs font-semibold text-primary">correct key</span>}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
              <div><span className="font-semibold text-foreground">Answer key: </span>{key ? JSON.stringify(key) : "— none set —"}</div>
              {q.explanation && <div><span className="font-semibold text-foreground">Explanation: </span>{q.explanation}</div>}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Review notes on this question</h3>
            <ReviewNoteDialog questionId={q.id} defaultArea="content" triggerLabel="Add comment" />
          </div>
          <div className="mt-2 grid gap-2">
            {notes.map((n: any) => (
              <div key={n.id} className="rounded-xl border bg-card p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{n.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${severityClass(n.severity)}`}>{n.severity}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(n.status)}`}>{statusLabel(n.status)}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{categoryLabel(n.category)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{n.body}</p>
                {n.suggested_fix && <p className="mt-1 text-xs"><span className="font-semibold">Suggested: </span>{n.suggested_fix}</p>}
                {n.admin_response && <p className="mt-1 rounded-lg bg-muted p-2 text-xs"><span className="font-semibold">Team reply: </span>{n.admin_response}</p>}
              </div>
            ))}
            {notes.length === 0 && <p className="text-xs text-muted-foreground">No notes on this question yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
