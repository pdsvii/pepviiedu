// Dispatcher: send signed-in users to their role dashboard.
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRole, initAccount } from "@/lib/roles.functions";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app")({
  component: Dispatcher,
});

function Dispatcher() {
  const fn = useServerFn(getMyRole);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["me","role"], queryFn: () => fn() });

  if (isLoading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;

  // No role yet — offer a chooser (for Google sign-ins that skipped signup form).
  if (!data?.role) return <ChooseRole onDone={() => refetch()} />;

  if (data.role === "admin") return <Navigate to="/admin" />;
  if (data.role === "student") return <Navigate to="/student" />;
  if (data.role === "parent") return <Navigate to="/parent" />;
  if (data.role === "teacher") return <Navigate to="/teacher" />;
  return null;
}

function ChooseRole({ onDone }: { onDone: () => void }) {
  const [role, setRole] = useState<"parent" | "teacher">("parent");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const fn = useServerFn(initAccount);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata as { full_name?: string } | undefined;
      if (meta?.full_name) setName(meta.full_name);
      else if (data.user?.email) setName(data.user.email.split("@")[0]);
    });
  }, []);

  async function submit() {
    setLoading(true);
    try {
      await fn({ data: { role, full_name: name || "User" } });
      toast.success("You're all set!");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not set up account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="display text-2xl font-bold">One quick thing</h1>
      <p className="mt-1 text-sm text-muted-foreground">Tell us how you'll use PEP Ready.</p>
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
        {(["parent","teacher"] as const).map((r) => (
          <button key={r} onClick={() => setRole(r)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold capitalize transition-colors ${role===r?"bg-card shadow-sm":"text-muted-foreground"}`}>
            {r}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <Label htmlFor="n">Your name</Label>
        <Input id="n" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Button className="mt-4 w-full" onClick={submit} disabled={loading}>
        {loading ? "Setting up…" : "Continue"}
      </Button>
    </div>
  );
}
