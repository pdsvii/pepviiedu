import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { platformAnalytics } from "@/lib/admin.functions";
import { Users, BookOpen, School, ClipboardList, ShieldCheck, Settings2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({ component: AdminHome });

export const ADMIN_NAV = [
  { to: "/admin", label: "Overview" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/content", label: "Content" },
  { to: "/admin/answer-keys", label: "Answer Keys" },
  { to: "/admin/blueprints", label: "Exam Blueprints" },
  { to: "/admin/generate", label: "Generate Items" },
  { to: "/admin/variations", label: "Variations" },
  { to: "/admin/schools", label: "Schools" },
  { to: "/admin/feedback", label: "Tester feedback" },
  { to: "/admin/settings", label: "Settings" },
];

function AdminHome() {
  const fn = useServerFn(platformAnalytics);
  const { data } = useQuery({ queryKey: ["admin", "analytics"], queryFn: () => fn() });
  const stats = [
    { label: "Users", value: data?.users ?? "—", icon: Users, to: "/admin/users" },
    { label: "Questions", value: data?.questions ?? "—", icon: BookOpen, to: "/admin/content" },
    { label: "Classes", value: data?.classes ?? "—", icon: ClipboardList, to: "/admin/schools" },
    { label: "Schools", value: data?.schools ?? "—", icon: School, to: "/admin/schools" },
    { label: "Attempts", value: data?.attempts ?? "—", icon: ShieldCheck, to: "/admin" },
    { label: "Settings", value: "Exam year", icon: Settings2, to: "/admin/settings" },
  ] as const;
  const bands = data?.bandCounts ?? {};
  return (
    <AppShell nav={ADMIN_NAV} title="Platform overview">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="group rounded-2xl border bg-card p-5 shadow-sm transition-colors hover:bg-muted/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</span>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 display text-3xl font-bold">{s.value}</div>
          </Link>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="display text-lg font-bold">Proficiency distribution</h2>
        <p className="text-sm text-muted-foreground">Across the last 2,000 completed attempts.</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["beginning", "developing", "proficient", "highly_proficient"] as const).map((b) => (
            <div key={b} className="rounded-xl bg-muted/50 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{b.replace("_", " ")}</div>
              <div className="mt-1 display text-2xl font-bold">{bands[b] ?? 0}</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
