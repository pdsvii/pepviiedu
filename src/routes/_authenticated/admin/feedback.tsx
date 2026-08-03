import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ADMIN_NAV } from "./index";
import { listReviewNotes, setReviewNoteStatus, reviewSummary } from "@/lib/tester.functions";
import { REVIEW_AREAS, REVIEW_STATUSES, areaLabel, categoryLabel, severityClass, statusClass, statusLabel } from "@/lib/review-areas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/feedback")({ component: AdminFeedback });

function AdminFeedback() {
  const listFn = useServerFn(listReviewNotes);
  const sumFn = useServerFn(reviewSummary);
  const [status, setStatus] = useState("all");
  const [area, setArea] = useState("all");
  const { data: summary } = useQuery({ queryKey: ["review", "summary"], queryFn: () => sumFn() });
  const { data: notes = [] } = useQuery({
    queryKey: ["review", "notes", "admin", status, area],
    queryFn: () =>
      listFn({
        data: {
          ...(status !== "all" ? { status: status as never } : {}),
          ...(area !== "all" ? { area: area as never } : {}),
          limit: 300,
        },
      }),
  });

  return (
    <AppShell nav={ADMIN_NAV} title="App Tester feedback">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {REVIEW_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={area} onValueChange={setArea}>
          <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sections</SelectItem>
            {REVIEW_AREAS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto text-sm text-muted-foreground">
          {summary?.total ?? 0} total · {summary?.blockers ?? 0} blockers
        </div>
      </div>

      <div className="grid gap-2">
        {notes.map((n: any) => <NoteRow key={n.id} n={n} />)}
        {notes.length === 0 && (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">No feedback yet.</div>
        )}
      </div>
    </AppShell>
  );
}

function NoteRow({ n }: { n: any }) {
  const qc = useQueryClient();
  const setFn = useServerFn(setReviewNoteStatus);
  const [reply, setReply] = useState(n.admin_response ?? "");
  const [saving, setSaving] = useState(false);

  async function update(next: string) {
    setSaving(true);
    try {
      await setFn({ data: { id: n.id, status: next as never, admin_response: reply || null } });
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["review"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{n.title}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${severityClass(n.severity)}`}>{n.severity}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(n.status)}`}>{statusLabel(n.status)}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {areaLabel(n.area)} · {categoryLabel(n.category)} · {new Date(n.created_at).toLocaleDateString()}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{n.body}</p>
      {n.suggested_fix && <p className="mt-1 text-xs"><span className="font-semibold">Suggested: </span>{n.suggested_fix}</p>}
      {n.questions && (
        <p className="mt-2 rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">
          Question ({n.questions.topics ? `G${n.questions.topics.grade} ${String(n.questions.topics.subject).replace("_", " ")}` : n.questions.type}):{" "}
          {String(n.questions.stem).split("\n")[0].slice(0, 140)}…
        </p>
      )}
      {n.route && <p className="mt-1 text-xs text-muted-foreground">Seen at {n.route}</p>}

      <div className="mt-3 grid gap-2">
        <Textarea rows={2} placeholder="Reply to the tester (optional)…" value={reply} onChange={(e) => setReply(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {REVIEW_STATUSES.map((s) => (
            <Button key={s.value} size="sm" disabled={saving} variant={n.status === s.value ? "default" : "outline"} onClick={() => update(s.value)}>
              {s.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
