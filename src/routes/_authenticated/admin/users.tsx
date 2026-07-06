import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ADMIN_NAV } from "./index";
import {
  listUsers, setUserRole, setUserDisabled, adminResetPassword, adminCreateUser,
  listAllowlist, addAllowlist, removeAllowlist,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KeyRound, Ban, RotateCcw, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({ component: AdminUsers });

const ROLES = ["student", "parent", "teacher", "admin"] as const;

function AdminUsers() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUsers);
  const allowFn = useServerFn(listAllowlist);
  const [search, setSearch] = useState("");
  const { data: users = [] } = useQuery({ queryKey: ["admin","users",search], queryFn: () => listFn({ data: { search, limit: 200 } }) });
  const { data: allow = [] } = useQuery({ queryKey: ["admin","allowlist"], queryFn: () => allowFn() });

  return (
    <AppShell nav={ADMIN_NAV} title="Users & roles">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input placeholder="Search email…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <div className="ml-auto flex gap-2"><NewUserDialog /><AllowlistDialog allow={allow} /></div>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">Email</th><th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Role</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <UserRow key={u.id} u={u} onChange={() => qc.invalidateQueries({ queryKey: ["admin","users"] })} />
            ))}
            {users.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No users found.</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

function UserRow({ u, onChange }: { u: any; onChange: () => void }) {
  const setRoleFn = useServerFn(setUserRole);
  const disableFn = useServerFn(setUserDisabled);
  const resetFn = useServerFn(adminResetPassword);
  const current = u.roles?.[0] ?? "";
  const disabled = u.profile?.is_disabled || !!u.banned_until;
  const [busy, setBusy] = useState(false);
  async function changeRole(role: string) {
    setBusy(true);
    try { await setRoleFn({ data: { user_id: u.id, role: role as any } }); toast.success("Role updated"); onChange(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  async function toggleDisabled() {
    setBusy(true);
    try { await disableFn({ data: { user_id: u.id, disabled: !disabled } }); toast.success(disabled ? "Re-enabled" : "Disabled"); onChange(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  async function sendReset() {
    setBusy(true);
    try {
      const r = await resetFn({ data: { user_id: u.id } });
      if (r.action_link) { await navigator.clipboard.writeText(r.action_link); toast.success("Password-reset link copied"); }
      else toast.success("Reset generated");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  return (
    <tr className="border-t">
      <td className="px-3 py-2 font-mono text-xs">{u.email}</td>
      <td className="px-3 py-2">{u.profile?.full_name ?? "—"}{u.profile?.grade ? ` · G${u.profile.grade}` : ""}</td>
      <td className="px-3 py-2">
        <Select value={current} onValueChange={changeRole} disabled={busy}>
          <SelectTrigger className="h-8 w-32"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">{disabled ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">Disabled</span> : <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">Active</span>}</td>
      <td className="px-3 py-2 text-right">
        <div className="inline-flex gap-1">
          <Button size="sm" variant="ghost" onClick={sendReset} disabled={busy} title="Copy reset link"><KeyRound className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={toggleDisabled} disabled={busy} title={disabled ? "Enable" : "Disable"}>{disabled ? <RotateCcw className="h-4 w-4" /> : <Ban className="h-4 w-4" />}</Button>
        </div>
      </td>
    </tr>
  );
}

function NewUserDialog() {
  const qc = useQueryClient();
  const fn = useServerFn(adminCreateUser);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [name, setName] = useState(""); const [role, setRole] = useState<typeof ROLES[number]>("teacher");
  const [grade, setGrade] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      await fn({ data: { email, password, full_name: name, role, grade: typeof grade === "number" ? grade : undefined } });
      toast.success("User created");
      setOpen(false); setEmail(""); setPassword(""); setName("");
      qc.invalidateQueries({ queryKey: ["admin","users"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>New user</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create user</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div><Label>Password</Label><Input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {role === "student" && (
            <div><Label>Grade</Label><Input type="number" min={4} max={6} value={grade} onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : "")} /></div>
          )}
          <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AllowlistDialog({ allow }: { allow: any[] }) {
  const qc = useQueryClient();
  const addFn = useServerFn(addAllowlist);
  const rmFn = useServerFn(removeAllowlist);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      await addFn({ data: { email, note: note || undefined } });
      toast.success("Added to admin allowlist"); setEmail(""); setNote("");
      qc.invalidateQueries({ queryKey: ["admin","allowlist"] });
      qc.invalidateQueries({ queryKey: ["admin","users"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  async function remove(em: string) {
    if (!confirm(`Remove ${em} from admin allowlist?`)) return;
    await rmFn({ data: { email: em } });
    qc.invalidateQueries({ queryKey: ["admin","allowlist"] });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="secondary">Admin allowlist</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Admin allowlist</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Emails here automatically receive the admin role when they sign up or complete a password reset.</p>
        <form onSubmit={add} className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit" disabled={busy}>Add</Button>
        </form>
        <ul className="mt-3 divide-y rounded-xl border">
          {allow.map((a: any) => (
            <li key={a.email} className="flex items-center justify-between px-3 py-2 text-sm">
              <div><div className="font-mono">{a.email}</div>{a.note && <div className="text-xs text-muted-foreground">{a.note}</div>}</div>
              <Button size="sm" variant="ghost" onClick={() => remove(a.email)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
          {allow.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">Empty.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
