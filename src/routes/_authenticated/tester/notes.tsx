import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TESTER_NAV } from "./route";
import { ReviewNoteDialog } from "@/components/ReviewNoteDialog";
import { listReviewNotes, deleteReviewNote, updateMyReviewNote } from "@/lib/tester.functions";
import { REVIEW_STATUSES, areaLabel, categoryLabel, severityClass, statusClass, statusLabel } from "@/lib/review-areas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tester/notes")({
  component: MyNotes,
  head: () => ({
    meta: [
      { title: "My review notes | PEP Ready" },
      { name: "description", content: "Track the corrections and updates you logged for PEP Ready and see the team's replies." },
      { property: "og:title", content: "My review notes | PEP Ready" },
      { property: "og:description", content: "Track the corrections you logged for PEP Ready." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function MyNotes() {
  const qc = useQueryClient();
  const listFn = useServerFn(listReviewNotes);
  const delFn = useServerFn(deleteReviewNote);
  const updFn = useServerFn(updateMyReviewNote);
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const { data: notes = [] } = useQuery({
    queryKey: ["review", "notes", "mine", status],
    queryFn: () => listFn({ data: { ...(status !== "all" ? { status: status as never } : {}), limit: 300 } }),
  });

  async function remove(id: string) {
    try {
      await delFn({ data: { id } });
      toast.success("Note deleted");
      qc.invalidateQueries({ queryKey: ["review"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  }

  async function save(id: string) {
    try {
      await updFn({ data: { id, title: title.trim(), body: body.trim() } });
      toast.success("Note updated");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["review"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    }
  }

  return (
    <AppShell nav={TESTER_NAV} title="My review notes">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {REVIEW_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto"><ReviewNoteDialog triggerLabel="New comment" /></div>
      </div>

      <div className="grid gap-2">
        {notes.map((n: any) => (
          <div key={n.id} className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${severityClass(n.severity)}`}>{n.severity}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(n.status)}`}>{statusLabel(n.status)}</span>
              <span className="text-xs text-muted-foreground">{areaLabel(n.area)} · {categoryLabel(n.category)}</span>
              <span className="ml-auto text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</span>
            </div>

            {editing === n.id ? (
              <div className="mt-3 grid gap-2">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => save(n.id)}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-2 font-semibold">{n.title}</div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{n.body}</p>
                {n.suggested_fix && <p className="mt-1 text-xs"><span className="font-semibold">Suggested: </span>{n.suggested_fix}</p>}
                {n.questions && (
                  <p className="mt-2 rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">
                    On question: {String(n.questions.stem).split("\n")[0].slice(0, 120)}…
                  </p>
                )}
                {n.admin_response && (
                  <p className="mt-2 rounded-lg bg-secondary p-2 text-xs"><span className="font-semibold">Team reply: </span>{n.admin_response}</p>
                )}
                {n.status === "open" && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditing(n.id); setTitle(n.title); setBody(n.body); }}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(n.id)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {notes.length === 0 && (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">No notes yet.</div>
        )}
      </div>
    </AppShell>
  );
}
