import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { TESTER_NAV } from "./route";
import { ReviewNoteDialog } from "@/components/ReviewNoteDialog";
import { listReviewNotes, reviewSummary } from "@/lib/tester.functions";
import { REVIEW_AREAS, areaLabel, categoryLabel, severityClass, statusClass, statusLabel } from "@/lib/review-areas";

export const Route = createFileRoute("/_authenticated/tester/")({
  component: TesterHome,
  head: () => ({
    meta: [
      { title: "App Tester review console | PEP Ready" },
      { name: "description", content: "Teachers and MOEY reviewers check every section and question of PEP Ready and log corrections and updates." },
      { property: "og:title", content: "App Tester review console | PEP Ready" },
      { property: "og:description", content: "Review every section and question of PEP Ready and log corrections." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function TesterHome() {
  const sumFn = useServerFn(reviewSummary);
  const notesFn = useServerFn(listReviewNotes);
  const { data: summary } = useQuery({ queryKey: ["review", "summary"], queryFn: () => sumFn() });
  const { data: notes = [] } = useQuery({ queryKey: ["review", "notes", "recent"], queryFn: () => notesFn({ data: { limit: 8 } }) });
  const byArea = summary?.byArea ?? {};

  return (
    <AppShell nav={TESTER_NAV} title="App Tester review console">
      <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
        Walk through each section of PEP Ready and each question in the bank. Log every correction or update you
        want actioned — the product team triages these and replies with a status.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Notes logged", value: summary?.total ?? "—" },
          { label: "Blockers", value: summary?.blockers ?? "—" },
          { label: "On questions", value: summary?.onQuestions ?? "—" },
          { label: "Questions in bank", value: summary?.questionCount ?? "—" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="display mt-1 text-3xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="display text-lg font-bold">Review by section</h2>
          <ReviewNoteDialog triggerLabel="New comment" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REVIEW_AREAS.map((a) => (
            <div key={a.value} className="flex flex-col justify-between rounded-2xl border bg-card p-4 shadow-sm">
              <div>
                <div className="font-semibold">{a.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {byArea[a.value] ? `${byArea[a.value]} note${byArea[a.value] === 1 ? "" : "s"} logged` : "No notes yet"}
                </div>
              </div>
              <div className="mt-3">
                <ReviewNoteDialog defaultArea={a.value} variant="outline" triggerLabel="Add comment" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="display mb-3 text-lg font-bold">Latest notes</h2>
        <div className="grid gap-2">
          {notes.map((n: any) => (
            <div key={n.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{n.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${severityClass(n.severity)}`}>{n.severity}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(n.status)}`}>{statusLabel(n.status)}</span>
                <span className="ml-auto text-xs text-muted-foreground">{areaLabel(n.area)} · {categoryLabel(n.category)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{n.body}</p>
            </div>
          ))}
          {notes.length === 0 && (
            <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
              No review notes yet. Start with a section above or head to Questions.
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
