import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ADMIN_NAV } from "./index";
import { listSchools, upsertSchool, deleteSchool, listAllClasses, assignClassSchool, assignClassTeacher, listUsers } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/schools")({ component: AdminSchools });

function AdminSchools() {
  const qc = useQueryClient();
  const schoolsFn = useServerFn(listSchools);
  const classesFn = useServerFn(listAllClasses);
  const usersFn = useServerFn(listUsers);
  const rmSchool = useServerFn(deleteSchool);
  const setSchoolFn = useServerFn(assignClassSchool);
  const setTeacherFn = useServerFn(assignClassTeacher);

  const { data: schools = [] } = useQuery({ queryKey: ["admin","schools"], queryFn: () => schoolsFn() });
  const { data: classes = [] } = useQuery({ queryKey: ["admin","classes"], queryFn: () => classesFn() });
  const { data: users = [] } = useQuery({ queryKey: ["admin","users"], queryFn: () => usersFn({ data: {} }) });
  const teachers = users.filter((u: any) => u.roles?.includes("teacher") || u.roles?.includes("admin"));

  return (
    <AppShell nav={ADMIN_NAV} title="Schools & classes">
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="rounded-2xl border bg-card p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Schools</h2>
            <SchoolDialog onSaved={() => qc.invalidateQueries({ queryKey: ["admin","schools"] })} />
          </div>
          <ul className="divide-y">
            {schools.map((s: any) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <div><div className="font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{s.parish ?? "—"}</div></div>
                <div className="flex gap-1">
                  <SchoolDialog school={s} onSaved={() => qc.invalidateQueries({ queryKey: ["admin","schools"] })} />
                  <Button size="sm" variant="ghost" onClick={async () => {
                    if (!confirm(`Delete school "${s.name}"?`)) return;
                    await rmSchool({ data: { id: s.id } });
                    qc.invalidateQueries({ queryKey: ["admin","schools"] });
                  }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
            {schools.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">No schools yet.</li>}
          </ul>
        </div>

        <div className="rounded-2xl border bg-card p-3 shadow-sm">
          <h2 className="mb-2 font-semibold">Classes</h2>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr><th className="px-2 py-2">Class</th><th className="px-2 py-2">Teacher</th><th className="px-2 py-2">School</th><th className="px-2 py-2">Code</th></tr>
              </thead>
              <tbody>
                {classes.map((c: any) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-2 py-2"><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">Grade {c.grade}</div></td>
                    <td className="px-2 py-2">
                      <Select value={c.teacher_id} onValueChange={async (v) => {
                        await setTeacherFn({ data: { class_id: c.id, teacher_id: v } });
                        toast.success("Teacher assigned"); qc.invalidateQueries({ queryKey: ["admin","classes"] });
                      }}>
                        <SelectTrigger className="h-8 w-full max-w-52"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>{teachers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.profile?.full_name || t.email}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-2">
                      <Select value={c.school_id ?? "__none"} onValueChange={async (v) => {
                        await setSchoolFn({ data: { class_id: c.id, school_id: v === "__none" ? null : v } });
                        toast.success("School assigned"); qc.invalidateQueries({ queryKey: ["admin","classes"] });
                      }}>
                        <SelectTrigger className="h-8 w-full max-w-52"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">— none —</SelectItem>
                          {schools.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">{c.join_code}</td>
                  </tr>
                ))}
                {classes.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No classes yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SchoolDialog({ school, onSaved }: { school?: any; onSaved: () => void }) {
  const fn = useServerFn(upsertSchool);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(school?.name ?? "");
  const [parish, setParish] = useState(school?.parish ?? "");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await fn({ data: { id: school?.id, name, parish: parish || null } }); toast.success("Saved"); setOpen(false); onSaved(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{school ? <Button size="sm" variant="ghost">Edit</Button> : <Button size="sm">New school</Button>}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{school ? "Edit school" : "New school"}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Parish</Label><Input value={parish} onChange={(e) => setParish(e.target.value)} /></div>
          <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
