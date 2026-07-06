import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRole } from "@/lib/roles.functions";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminGate });

function AdminGate() {
  const fn = useServerFn(getMyRole);
  const { data, isLoading } = useQuery({ queryKey: ["me", "role"], queryFn: () => fn() });
  if (isLoading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  if (data?.role !== "admin") return <Navigate to="/app" />;
  return <Outlet />;
}
