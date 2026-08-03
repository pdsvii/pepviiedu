import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LogOut, ChevronDown } from "lucide-react";
import { Brand } from "@/components/Brand";

type NavItem = { to: string; label: string };
type NavSection = { label: string; items: NavItem[] };
type Nav = NavItem | NavSection;

function isNavSection(n: Nav): n is NavSection {
  return "items" in n;
}

export function AppShell({
  variant = "adult",
  nav,
  title,
  children,
}: {
  variant?: "adult" | "student";
  nav: Nav[];
  title: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const pathname = location.pathname;

  const initiallyOpen = new Set<number>();
  nav.forEach((section, i) => {
    if (isNavSection(section) && section.items.some((n) => pathname === n.to || pathname.startsWith(n.to + "/"))) {
      initiallyOpen.add(i);
    }
  });

  const [openSections, setOpenSections] = useState<Set<number>>(initiallyOpen);

  function toggleSection(i: number) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className={variant === "student" ? "student-surface min-h-screen bg-background" : "min-h-screen bg-background"}>
      <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Brand />

          <div className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {nav.map((section, i) =>
              isNavSection(section) ? (
                <div key={i} className="relative">
                  <button
                    onClick={() => toggleSection(i)}
                    className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-muted ${openSections.has(i) ? "bg-muted" : ""}`}
                    aria-expanded={openSections.has(i)}
                  >
                    {section.label}
                    <ChevronDown className={`h-3 w-3 transition-transform ${openSections.has(i) ? "rotate-180" : ""}`} />
                  </button>
                  {openSections.has(i) && (
                    <div className="absolute left-0 top-full z-20 mt-1 flex w-max min-w-[12rem] flex-col gap-1 rounded-2xl border bg-background p-2 shadow-lg">
                      {section.items.map((n) => (
                        <Link key={n.to} to={n.to} activeProps={{ className: "bg-secondary" }} className="rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-muted">
                          {n.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link key={section.to} to={section.to} activeProps={{ className: "bg-secondary" }} className="rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-muted">
                  {section.label}
                </Link>
              )
            )}
          </div>

          <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out">
            <LogOut className="mr-1 h-4 w-4" /> Sign out
          </Button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-2 md:hidden">
          {nav.flatMap((section) => (isNavSection(section) ? section.items : [section])).map((n) => (
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
