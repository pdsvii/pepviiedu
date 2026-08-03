import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { Brand } from "@/components/Brand";

type NavItem = { to: string; label: string };

export function AppShell({
  variant = "adult",
  nav,
  title,
  children,
}: {
  variant?: "adult" | "student";
  nav: NavItem[];
  title: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className={variant === "student" ? "student-surface min-h-screen bg-background" : "min-h-screen bg-background"}>
      <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col px-4 py-3">
          <div className="flex items-center justify-between">
            <Brand />
            <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out">
              <LogOut className="mr-1 h-4 w-4" /> Sign out
            </Button>
          </div>

          <nav className="mt-3 hidden flex-wrap gap-1 md:flex">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} activeProps={{ className: "bg-secondary" }} className="rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-muted">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-2 md:hidden">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} activeProps={{ className: "bg-secondary" }} className="whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold hover:bg-muted">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-6 pt-10">
        <h1 className="display mt-10 mb-4 text-2xl font-bold md:text-3xl">{title}</h1>
        {children}
      </main>
    </div>
  );
}
