import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { getChildProgress, listMyChildren } from "@/lib/parent.functions";
import { BandBadge } from "@/components/BandBadge";
import { SUBJECTS, type Band } from "@/lib/pep";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/parent/child/$childId")({
  component: ChildDetail,
});

const NAV = [{ to: "/parent", label: "My Children" }];

function ChildDetail() {
  const { childId } = Route.useParams();
  const progFn = useServerFn(getChildProgress);
  const kidsFn = useServerFn(listMyChildren);
  const { data: kids = [] } = useQuery({ queryKey: ["parent","children"], queryFn: () => kidsFn() });
  const { data } = useQuery({ queryKey: ["parent","child", childId], queryFn: () => progFn({ data: { child_id: childId } }) });
  const kid = kids.find((k: any) => k.id === childId);

  const attempts = data?.attempts ?? [];
  const bySubject = SUBJECTS.map((s) => {
    const latest = attempts.find((a: any) => a.subject === s.key);
    return { ...s, band: latest?.band as Band | undefined, when: latest?.finished_at };
  });

  return (
    <AppShell nav={NAV} title={kid ? `${kid.full_name}'s progress` : "Progress"}>
      <div className="mb-4"><Link to="/parent"><Button variant="ghost" size="sm">← Back</Button></Link></div>
      <div className="grid gap-3 md:grid-cols-2">
        {bySubject.map((s) => (
          <div key={s.key} className="rounded-2xl bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.emoji} {s.label}</div>
                <div className="mt-1 text-sm">
                  {s.when ? `Last practised ${new Date(s.when).toLocaleDateString()}` : "Not started yet"}
                </div>
              </div>
              {s.band ? <BandBadge band={s.band} /> : <span className="text-xs text-muted-foreground">—</span>}
            </div>
          </div>
        ))}
      </div>

      <h2 className="display mt-8 text-xl font-bold">Recent sessions</h2>
      {attempts.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No sessions yet.</p>
      ) : (
        <div className="mt-3 grid gap-2">
          {attempts.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm">
              <div>
                <div className="text-sm font-bold capitalize">{a.subject?.replace("_"," ")} · {a.component}</div>
                <div className="text-xs text-muted-foreground">{new Date(a.finished_at).toLocaleString()}</div>
              </div>
              {a.band && <BandBadge band={a.band as Band} />}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
