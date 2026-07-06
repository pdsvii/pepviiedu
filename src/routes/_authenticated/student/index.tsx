import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { BandBadge } from "@/components/BandBadge";
import { listMyAttempts, listMyAssignments } from "@/lib/practice.functions";
import { getMyRole } from "@/lib/roles.functions";
import { SUBJECTS, type Band } from "@/lib/pep";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/student/")({
  component: StudentHome,
});

const NAV = [
  { to: "/student", label: "Home" },
  { to: "/student/practice", label: "Practice" },
  { to: "/student/rewards", label: "My Rewards" },
];

function StudentHome() {
  const meFn = useServerFn(getMyRole);
  const attemptsFn = useServerFn(listMyAttempts);
  const assignFn = useServerFn(listMyAssignments);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const { data: attempts = [] } = useQuery({ queryKey: ["me", "attempts"], queryFn: () => attemptsFn() });
  const { data: assignments = [] } = useQuery({ queryKey: ["me", "assignments"], queryFn: () => assignFn() });

  const name = me?.profile?.full_name ?? "friend";
  const grade = me?.profile?.grade ?? 5;

  return (
    <AppShell variant="student" nav={NAV} title={`Hi, ${name.split(" ")[0]}! 👋`}>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-secondary p-6 md:col-span-2">
          <h2 className="display text-xl font-bold">Ready for today's practice?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pick a subject and jump in. You'll get instant feedback for every question.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SUBJECTS.map((s) => (
              <Link key={s.key} to="/student/practice" search={{ subject: s.key, grade, component: "CBT" as const }}
                className="rounded-2xl bg-card p-4 text-center shadow-sm transition-transform hover:-translate-y-0.5">
                <div className="text-3xl">{s.emoji}</div>
                <div className="mt-2 text-sm font-bold">{s.label}</div>
              </Link>
            ))}
          </div>
        </div>
        <div className="rounded-3xl bg-accent p-6">
          <div className="text-sm font-semibold text-muted-foreground">Streak</div>
          <div className="display mt-1 text-4xl font-extrabold">🔥 {Math.min(attempts.length, 30)}</div>
          <p className="mt-1 text-sm">Sessions finished. Keep going!</p>
          <Link to="/student/rewards"><Button size="sm" variant="secondary" className="mt-3 rounded-full">See rewards</Button></Link>
        </div>
      </div>

      {assignments.length > 0 && (
        <section className="mt-8">
          <h2 className="display text-xl font-bold">From your teacher</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {assignments.map((a: any) => (
              <div key={a.id} className="rounded-2xl bg-card p-4 shadow-sm">
                <div className="font-bold">{a.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {a.due_at ? `Due ${new Date(a.due_at).toLocaleDateString()}` : "No due date"}
                </div>
                <Link to="/student/practice" search={{ assignment_id: a.id }} className="mt-3 inline-block">
                  <Button size="sm">Start</Button>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="display text-xl font-bold">Recent progress</h2>
        {attempts.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No sessions yet. Start your first practice above!</p>
        ) : (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {attempts.slice(0, 6).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm">
                <div>
                  <div className="text-sm font-bold capitalize">{a.subject?.replace("_"," ")} · {a.component}</div>
                  <div className="text-xs text-muted-foreground">{new Date(a.finished_at).toLocaleDateString()}</div>
                </div>
                {a.band && <BandBadge band={a.band as Band} />}
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
