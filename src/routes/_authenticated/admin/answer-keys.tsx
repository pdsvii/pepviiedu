import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StemText } from "@/components/StemText";
import { ADMIN_NAV } from "./index";
import { listAnswerKeyQueue, setAnswerKey } from "@/lib/admin.functions";
import { gradeAnswer, keyIsUsable, type AnswerKey, type QType } from "@/lib/grading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Check, X, KeyRound, Search, CircleAlert, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/answer-keys")({
  component: AnswerKeysPage,
  head: () => ({
    meta: [
      { title: "Answer Key Review — viiedu | PEP Ready" },
      { name: "description", content: "Build and verify the answer key for every PEP item, then test how a student's typed answer is marked right or wrong." },
      { property: "og:title", content: "Answer Key Review — viiedu | PEP Ready" },
      { property: "og:description", content: "Build and verify answer keys, and test typed student answers instantly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const TYPE_LABEL: Record<string, string> = {
  mc: "Multiple choice", multi: "Select all", tf: "True / False", numeric: "Numeric",
  short_text: "Short answer", pt_scenario: "Performance task", matching: "Matching", ordering: "Ordering",
};
const SUBJECT_LABEL: Record<string, string> = {
  mathematics: "Mathematics", language_arts: "Language Arts", science: "Science", social_studies: "Social Studies",
};

function optionList(options: any): string[] {
  if (!options) return [];
  if (Array.isArray(options)) return options.map((o) => (typeof o === "string" ? o : (o?.text ?? o?.label ?? JSON.stringify(o))));
  if (typeof options === "object") return Object.values(options).map((o: any) => String(o));
  return [];
}

type Draft = {
  correct: number[];
  value: string;
  tolerance: string;
  accepted: string;
  keywords: string;
  min_keywords: string;
  explanation: string;
};

function draftFromKey(q: any): Draft {
  const k = (q.answer_key ?? {}) as any;
  const rawCorrect = k.correct ?? k.values ?? k.value;
  const correct = Array.isArray(rawCorrect)
    ? rawCorrect.map((v: any) => Number(v)).filter((n: number) => Number.isFinite(n))
    : Number.isFinite(Number(rawCorrect)) && ["mc", "tf", "multi", "ordering", "matching"].includes(q.type)
      ? [Number(rawCorrect)]
      : [];
  const accepted = [...(k.accepted ?? []), ...(k.accepts ?? [])];
  if (typeof k.value === "string" && k.value.trim() && !accepted.includes(k.value)) accepted.push(k.value);
  return {
    correct,
    value: q.type === "numeric" ? String(k.value ?? "") : "",
    tolerance: String(k.tolerance ?? ""),
    accepted: accepted.join("\n"),
    keywords: (k.keywords ?? []).join(", "),
    min_keywords: k.min_keywords != null ? String(k.min_keywords) : "",
    explanation: q.explanation ?? "",
  };
}

function keyFromDraft(type: QType, d: Draft): AnswerKey {
  if (type === "mc" || type === "tf") return d.correct.length ? { correct: d.correct[0]! } : null;
  if (type === "multi" || type === "matching" || type === "ordering") return d.correct.length ? { correct: d.correct } : null;
  if (type === "numeric") {
    if (d.value.trim() === "") return null;
    const k: any = { value: Number(d.value) };
    if (d.tolerance.trim() !== "") k.tolerance = Number(d.tolerance);
    return k;
  }
  const accepted = d.accepted.split("\n").map((s) => s.trim()).filter(Boolean);
  const keywords = d.keywords.split(",").map((s) => s.trim()).filter(Boolean);
  if (!accepted.length && !keywords.length) return null;
  const k: any = {};
  if (accepted.length) k.accepted = accepted;
  if (keywords.length) k.keywords = keywords;
  if (d.min_keywords.trim() !== "") k.min_keywords = Number(d.min_keywords);
  return k;
}

function StatusPill({ ready }: { ready: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${ready ? "bg-secondary text-secondary-foreground" : "bg-destructive/10 text-destructive"}`}>
      {ready ? <Check className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}
      {ready ? "Key ready" : "Key missing"}
    </span>
  );
}

/** Editor + live "type an answer" checker for one item. */
function KeyCard({ q, onSaved }: { q: any; onSaved: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => draftFromKey(q));
  const [test, setTest] = useState<any>("");
  const save = useServerFn(setAnswerKey);
  const [saving, setSaving] = useState(false);

  const type = q.type as QType;
  const opts = optionList(q.options);
  const liveKey = useMemo(() => keyFromDraft(type, draft), [type, draft]);
  const ready = keyIsUsable(type, liveKey);
  const result = useMemo(() => gradeAnswer(type, liveKey, test), [type, liveKey, test]);
  const objective = ["mc", "tf", "multi", "matching", "ordering"].includes(type);

  function toggleCorrect(i: number) {
    setDraft((d) => {
      if (type === "mc" || type === "tf") return { ...d, correct: [i] };
      return { ...d, correct: d.correct.includes(i) ? d.correct.filter((x) => x !== i) : [...d.correct, i] };
    });
  }

  async function onSave() {
    setSaving(true);
    try {
      await save({ data: { id: q.id, answer_key: liveKey, explanation: draft.explanation || null, needs_review: !ready } });
      toast.success(ready ? "Answer key saved and verified" : "Saved — still needs a key");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save the key");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-3xl border bg-card p-5 shadow-sm">
      <header className="flex flex-wrap items-center gap-2">
        <StatusPill ready={ready} />
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{TYPE_LABEL[type] ?? type}</span>
        {q.topics?.subject && <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{SUBJECT_LABEL[q.topics.subject] ?? q.topics.subject}</span>}
        {q.topics?.grade && <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">Grade {q.topics.grade}</span>}
        {q.source === "moey_official_2018" && <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold">Official MOEY</span>}
      </header>

      <StemText stem={q.stem} className="mt-3 text-sm" />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="grid gap-3">
          <h3 className="display text-sm font-bold uppercase tracking-wide text-muted-foreground">Answer key</h3>

          {objective && (
            opts.length ? (
              <div className="grid gap-2">
                {opts.map((o, i) => {
                  const on = draft.correct.includes(i);
                  return (
                    <button key={i} type="button" onClick={() => toggleCorrect(i)}
                      className={`rounded-2xl border-2 px-3 py-2 text-left text-sm transition-colors ${on ? "border-primary bg-secondary" : "border-transparent bg-muted hover:bg-secondary/60"}`}>
                      <span className="mr-2 font-bold">{String.fromCharCode(65 + i)}.</span>{o}
                      {on && <Check className="ml-2 inline h-4 w-4" />}
                    </button>
                  );
                })}
                <p className="text-xs text-muted-foreground">
                  {type === "mc" || type === "tf" ? "Tap the one correct option." : "Tap every correct option."}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">This item has no options stored — add them in Content Studio first.</p>
            )
          )}

          {type === "numeric" && (
            <div className="flex gap-3">
              <div className="grid gap-1">
                <Label>Correct value</Label>
                <Input value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} placeholder="e.g. 42" className="max-w-[140px]" />
              </div>
              <div className="grid gap-1">
                <Label>Tolerance (±)</Label>
                <Input value={draft.tolerance} onChange={(e) => setDraft({ ...draft, tolerance: e.target.value })} placeholder="0" className="max-w-[140px]" />
              </div>
            </div>
          )}

          {(type === "short_text" || type === "pt_scenario") && (
            <>
              <div className="grid gap-1">
                <Label>Accepted answers — one per line</Label>
                <Textarea rows={3} value={draft.accepted} onChange={(e) => setDraft({ ...draft, accepted: e.target.value })}
                  placeholder={"Vendor A\nA\nthe cheaper vendor"} />
                <p className="text-xs text-muted-foreground">Marking ignores capitals, spacing, punctuation and small spelling slips, and accepts the answer inside a longer sentence.</p>
              </div>
              <div className="grid gap-1">
                <Label>Key ideas (comma separated) — for explanation answers</Label>
                <Input value={draft.keywords} onChange={(e) => setDraft({ ...draft, keywords: e.target.value })} placeholder="cheaper, more carrots, $200" />
              </div>
              <div className="grid gap-1">
                <Label>Key ideas needed</Label>
                <Input value={draft.min_keywords} onChange={(e) => setDraft({ ...draft, min_keywords: e.target.value })} placeholder="auto (60%)" className="max-w-[140px]" />
              </div>
            </>
          )}

          <div className="grid gap-1">
            <Label>Explanation shown after answering</Label>
            <Textarea rows={2} value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} placeholder="Why this is the right answer…" />
          </div>

          <Button onClick={onSave} disabled={saving} className="justify-self-start rounded-2xl">
            <KeyRound className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save answer key"}
          </Button>
        </div>

        {/* Live student-answer checker */}
        <div className="grid content-start gap-3 rounded-2xl bg-muted/40 p-4">
          <h3 className="display flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-4 w-4" /> Try it as a student
          </h3>
          {objective ? (
            opts.length ? (
              <div className="grid gap-2">
                {opts.map((o, i) => (
                  <button key={i} type="button"
                    onClick={() => setTest(type === "mc" || type === "tf" ? i : (Array.isArray(test) && test.includes(i) ? test.filter((x: number) => x !== i) : [...(Array.isArray(test) ? test : []), i]))}
                    className={`rounded-2xl border-2 px-3 py-2 text-left text-sm ${(type === "mc" || type === "tf" ? test === i : Array.isArray(test) && test.includes(i)) ? "border-primary bg-card" : "border-transparent bg-card/60"}`}>
                    <span className="mr-2 font-bold">{String.fromCharCode(65 + i)}.</span>{o}
                  </button>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No options to try.</p>
          ) : type === "numeric" ? (
            <Input value={typeof test === "string" ? test : ""} onChange={(e) => setTest(e.target.value)} placeholder="Type a number" className="max-w-[200px]" />
          ) : (
            <Textarea rows={4} value={typeof test === "string" ? test : ""} onChange={(e) => setTest(e.target.value)} placeholder="Type an answer the way a student would…" />
          )}

          <div className={`rounded-2xl border-2 p-3 text-sm ${
            result.status === "correct" ? "border-primary bg-secondary" :
            result.status === "partial" ? "border-accent bg-accent/20" :
            result.status === "unscored" ? "border-dashed bg-card" : "border-destructive/40 bg-destructive/10"}`}>
            <div className="flex items-center gap-2 font-bold">
              {result.status === "correct" ? <Check className="h-4 w-4" /> : result.status === "incorrect" ? <X className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
              {result.status === "correct" ? "Marked correct" :
                result.status === "partial" ? `Partly correct — ${Math.round((result.score ?? 0) * 100)}%` :
                result.status === "unscored" ? "Can't be auto-marked yet" : "Marked incorrect"}
            </div>
            <p className="mt-1 text-muted-foreground">{result.reason}</p>
            {result.matched?.length ? <p className="mt-1 text-xs">Matched: {result.matched.join(", ")}</p> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function AnswerKeysPage() {
  const qc = useQueryClient();
  const list = useServerFn(listAnswerKeyQueue);
  const [status, setStatus] = useState<"all" | "missing" | "ready">("missing");
  const [source, setSource] = useState<"all" | "moey_official_2018" | "ai_generated">("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "answer-keys", source, search],
    queryFn: () => list({ data: { status: "all", source, search: search || undefined, limit: 300 } }),
  });

  const rows = data ?? [];
  const ready = rows.filter((q: any) => keyIsUsable(q.type, q.answer_key)).length;
  const filtered = rows.filter((q: any) => {
    const ok = keyIsUsable(q.type, q.answer_key);
    return status === "all" ? true : status === "ready" ? ok : !ok;
  });

  return (
    <AppShell nav={ADMIN_NAV} title="Answer key review">
      <div className="grid gap-4">
        <section className="grid gap-3 rounded-3xl border bg-card p-5 shadow-sm sm:grid-cols-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items loaded</div>
            <div className="display text-3xl font-bold">{rows.length}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Keys ready</div>
            <div className="display text-3xl font-bold text-primary">{ready}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Still to key</div>
            <div className="display text-3xl font-bold text-destructive">{rows.length - ready}</div>
          </div>
        </section>

        <section className="flex flex-wrap items-end gap-3 rounded-3xl border bg-card p-4 shadow-sm">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search question text…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="missing">Key missing</SelectItem>
              <SelectItem value="ready">Key ready</SelectItem>
              <SelectItem value="all">All items</SelectItem>
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={(v) => setSource(v as any)}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="moey_official_2018">Official MOEY 2018</SelectItem>
              <SelectItem value="ai_generated">AI generated</SelectItem>
            </SelectContent>
          </Select>
        </section>

        {isLoading && <p className="text-sm text-muted-foreground">Loading items…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="rounded-3xl border bg-card p-6 text-sm text-muted-foreground">Nothing here — every matching item has a usable answer key. 🎉</p>
        )}
        <div className="grid gap-4">
          {filtered.map((q: any) => (
            <KeyCard key={q.id} q={q} onSaved={() => qc.invalidateQueries({ queryKey: ["admin", "answer-keys"] })} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
