import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRole } from "@/lib/roles.functions";

export const Route = createFileRoute("/_authenticated/tester")({ component: TesterGate });

export const TESTER_NAV = [
  { to: "/tester", label: "Review overview" },
  { to: "/tester/questions", label: "Questions" },
  { to: "/tester/notes", label: "My notes" },
];

function TesterGate() {
  const fn = useServerFn(getMyRole);
  const { data, isLoading } = useQuery({ queryKey: ["me", "role"], queryFn: () => fn() });
  if (isLoading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  if (data?.role !== "tester" && data?.role !== "admin") return <Navigate to="/app" />;
  return <Outlet />;
}
