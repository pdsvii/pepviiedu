import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { listMyRewards } from "@/lib/practice.functions";

export const Route = createFileRoute("/_authenticated/student/rewards")({
  component: RewardsPage,
});

const NAV = [
  { to: "/student", label: "Home" },
  { to: "/student/practice", label: "Practice" },
  { to: "/student/rewards", label: "My Rewards" },
];

function RewardsPage() {
  const fn = useServerFn(listMyRewards);
  const { data: rewards = [] } = useQuery({ queryKey: ["me", "rewards"], queryFn: () => fn() });
  return (
    <AppShell variant="student" nav={NAV} title="My Rewards">
      {rewards.length === 0 ? (
        <div className="rounded-3xl bg-card p-8 text-center">
          <div className="text-5xl">🌱</div>
          <p className="mt-3 font-semibold">Your first badge is coming!</p>
          <p className="text-sm text-muted-foreground">Reach the Proficient band on any practice to earn a badge.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {rewards.map((r: any) => (
            <div key={r.id} className="rounded-3xl bg-secondary p-5 text-center shadow-sm">
              <div className="text-4xl">🏅</div>
              <div className="mt-2 font-bold">{r.label ?? r.kind}</div>
              <div className="text-xs text-muted-foreground">{new Date(r.earned_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
