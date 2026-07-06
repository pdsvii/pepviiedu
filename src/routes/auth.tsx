import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { initAccount } from "@/lib/roles.functions";

const search = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  role: z.enum(["parent", "teacher"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  component: AuthPage,
});

function AuthPage() {
  const { mode: initMode = "signin", role: initRole = "parent" } = Route.useSearch();
  const navigate = useNavigate();
  const initAccountFn = useServerFn(initAccount);
  const [mode, setMode] = useState<"signin" | "signup">(initMode);
  const [role, setRole] = useState<"parent" | "teacher">(initRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // If already signed in, bounce to the dispatcher — unless this is a password-recovery redirect.
  useEffect(() => {
    let cancelled = false;
    const isRecovery = typeof window !== "undefined" && (window.location.hash.includes("type=recovery") || new URLSearchParams(window.location.search).get("type") === "recovery");
    if (isRecovery) return;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) navigate({ to: "/app" });
    });
    return () => { cancelled = true; };
  }, [navigate]);

  async function sendReset() {
    if (!email) { toast.error("Enter your email above first"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
      toast.success("Password reset email sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { full_name: name, role },
          },
        });
        if (error) throw error;
        if (data.session) {
          await initAccountFn({ data: { role, full_name: name } });
          toast.success("Welcome to viiVision PEP!");
          navigate({ to: "/app" });
        } else {
          toast.success("Check your email to confirm your account.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/app" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) throw new Error(result.error instanceof Error ? result.error.message : String(result.error));
      if (result.redirected) return;
      // Popup path: tokens set. Try to init account if this was a signup.
      if (mode === "signup") {
        try { await initAccountFn({ data: { role, full_name: name || email || "User" } }); } catch { /* profile exists */ }
      }
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 py-10">
        <Link to="/" className="mb-8 inline-flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-primary text-primary-foreground display font-bold">v</span>
          <span className="display text-lg font-bold">viiVision PEP</span>
        </Link>

        <div className="rounded-3xl bg-card p-6 shadow-sm">
          <h1 className="display text-2xl font-bold">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Parents & teachers only. Students sign in with the account a parent creates."
              : "Sign in to your parent, teacher, or student account."}
          </p>

          {mode === "signup" && (
            <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
              {(["parent","teacher"] as const).map((r) => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold capitalize transition-colors ${role===r ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
                  {r}
                </button>
              ))}
            </div>
          )}

          <form className="mt-5 space-y-3" onSubmit={onSubmit}>
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
            {mode === "signin" && (
              <button type="button" onClick={sendReset} className="w-full text-center text-xs font-semibold text-primary hover:underline" disabled={loading}>
                {resetSent ? "Reset email sent — check your inbox" : "Forgot your password?"}
              </button>
            )}
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <Button type="button" variant="secondary" className="w-full" onClick={signInWithGoogle} disabled={loading}>
            Continue with Google
          </Button>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
            <button className="font-semibold text-primary" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
              {mode === "signup" ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
