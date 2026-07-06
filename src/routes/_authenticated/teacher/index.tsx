import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { listMyClasses, createClass } from "@/lib/teacher.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/teacher/")({
  component: TeacherHome,
});

const NAV = [
  { to: "/teacher", label: "Classes" },
  { to: "/teacher/assignments", label: "Assignments" },
];

function TeacherHome() {
  const fn = useServerFn(listMyClasses);
  const { data: classes = [] } = useQuery({ queryKey: ["teacher","classes"], queryFn: () => fn() });
  return (
    <AppShell nav={NAV} title="Your classes">
      <div className="mb-4 flex justify-end"><NewClassDialog /></div>
      {classes.length === 0 ? (
        <div className="rounded-3xl bg-card p-8 text-center shadow-sm">
          <p className="font-semibold">No classes yet.</p>
          <p className="text-sm text-muted-foreground">Create a class to add students and set assignments.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((c: any) => (
            <Link key={c.id} to="/teacher/class/$classId" params={{ classId: c.id }}
              className="rounded-2xl bg-card p-5 shadow-sm transition-transform hover:-translate-y-0.5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Grade {c.grade}</div>
              <div className="mt-1 display text-lg font-bold">{c.name}</div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{c.member_count} student{c.member_count === 1 ? "" : "s"}</span>
                <span className="rounded-full bg-secondary px-3 py-0.5 text-xs font-bold">{c.join_code}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function NewClassDialog() {
  const qc = useQueryClient();
  const fn = useServerFn(createClass);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState(5);
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try {
      await fn({ data: { name, grade } });
      toast.success("Class created");
      setOpen(false); setName("");
      qc.invalidateQueries({ queryKey: ["teacher","classes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create class");
    } finally { setLoading(false); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>New class</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create a class</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div><Label htmlFor="cn">Class name</Label><Input id="cn" required value={name} onChange={(e) => setName(e.target.value)} /></div>
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
          <DialogFooter><Button type="submit" disabled={loading}>{loading?"Creating…":"Create"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
