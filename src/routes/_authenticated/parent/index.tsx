import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { listMyChildren, createChildAccount, resetChildPassword } from "@/lib/parent.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/parent/")({
  component: ParentHome,
});

const NAV = [{ to: "/parent", label: "My Children" }];

function ParentHome() {
  const fn = useServerFn(listMyChildren);
  const { data: children = [] } = useQuery({ queryKey: ["parent", "children"], queryFn: () => fn() });
  return (
    <AppShell nav={NAV} title="Your children">
      <div className="mb-4 flex justify-end"><AddChildDialog /></div>
      {children.length === 0 ? (
        <div className="rounded-3xl bg-card p-8 text-center shadow-sm">
          <p className="font-semibold">No child accounts yet.</p>
          <p className="text-sm text-muted-foreground">Add your child to get them started with PEP practice.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {children.map((c: any) => (
            <div key={c.id} className="rounded-2xl bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-lg font-bold">
                  {(c.full_name ?? "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold">{c.full_name}</div>
                  <div className="text-xs text-muted-foreground">{c.grade ? `Grade ${c.grade}` : "Grade not set"}</div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Link to="/parent/child/$childId" params={{ childId: c.id }}>
                  <Button size="sm">View progress</Button>
                </Link>
                <ResetPasswordDialog childId={c.id} name={c.full_name} />
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function AddChildDialog() {
  const qc = useQueryClient();
  const fn = useServerFn(createChildAccount);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [grade, setGrade] = useState(5);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fn({ data: { email, password, full_name: name, grade } });
      toast.success(`${name} is ready to practise!`);
      setOpen(false); setEmail(""); setPassword(""); setName("");
      qc.invalidateQueries({ queryKey: ["parent", "children"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create child account");
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>Add child</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a child account</DialogTitle>
          <DialogDescription>Your child will sign in with the email and password you set here.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div><Label htmlFor="cn">Child's name</Label><Input id="cn" required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label htmlFor="ce">Email</Label><Input id="ce" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label htmlFor="cp">Password (min 6 chars)</Label><Input id="cp" type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div>
            <Label>Grade</Label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {[4,5,6].map((g) => (
                <button key={g} type="button" onClick={() => setGrade(g)}
                  className={`rounded-xl border-2 py-2 font-semibold ${grade===g?"border-primary bg-secondary":"border-transparent bg-muted"}`}>
                  Grade {g}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create account"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ childId, name }: { childId: string; name: string }) {
  const fn = useServerFn(resetChildPassword);
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try {
      await fn({ data: { child_id: childId, new_password: pw } });
      toast.success(`Password reset for ${name}`);
      setOpen(false); setPw("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset password");
    } finally { setLoading(false); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="secondary">Reset password</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Reset password for {name}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label htmlFor="np">New password</Label><Input id="np" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <DialogFooter><Button type="submit" disabled={loading}>{loading ? "Saving…" : "Save"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
