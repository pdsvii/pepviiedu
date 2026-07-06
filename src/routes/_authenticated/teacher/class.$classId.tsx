import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getClass, addStudentByEmail, removeStudentFromClass, getClassHeatmap } from "@/lib/teacher.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SUBJECTS, type Band } from "@/lib/pep";
import { BandBadge } from "@/components/BandBadge";

export const Route = createFileRoute("/_authenticated/teacher/class/$classId")({
  component: ClassDetail,
});

const NAV = [
  { to: "/teacher", label: "Classes" },
  { to: "/teacher/assignments", label: "Assignments" },
];

function ClassDetail() {
  const { classId } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getClass);
  const addFn = useServerFn(addStudentByEmail);
  const rmFn = useServerFn(removeStudentFromClass);
  const heatFn = useServerFn(getClassHeatmap);

  const { data } = useQuery({ queryKey: ["teacher","class",classId], queryFn: () => getFn({ data: { class_id: classId } }) });
  const { data: heat = [] } = useQuery({ queryKey: ["teacher","heat",classId], queryFn: () => heatFn({ data: { class_id: classId } }) });

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try {
      await addFn({ data: { class_id: classId, email } });
      toast.success("Student added");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["teacher","class",classId] });
      qc.invalidateQueries({ queryKey: ["teacher","heat",classId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add student");
    } finally { setLoading(false); }
  }

  async function remove(studentId: string) {
    try {
      await rmFn({ data: { class_id: classId, student_id: studentId } });
      qc.invalidateQueries({ queryKey: ["teacher","class",classId] });
      qc.invalidateQueries({ queryKey: ["teacher","heat",classId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not remove"); }
  }

  return (
    <AppShell nav={NAV} title={data?.klass?.name ?? "Class"}>
      <div className="mb-4"><Link to="/teacher"><Button variant="ghost" size="sm">← Back</Button></Link></div>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl bg-card p-5 shadow-sm">
          <h2 className="display text-lg font-bold">Roster</h2>
          <div className="mt-1 text-xs text-muted-foreground">Join code: <span className="font-mono font-bold">{data?.klass?.join_code}</span></div>
          <form className="mt-3 flex gap-2" onSubmit={add}>
            <Input placeholder="student@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required type="email" />
            <Button type="submit" disabled={loading}>Add</Button>
          </form>
          <ul className="mt-4 divide-y">
            {(data?.members ?? []).map((m: any) => (
              <li key={m.student_id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-semibold">{m.profiles?.full_name ?? "Student"}</div>
                  <div className="text-xs text-muted-foreground">Grade {m.profiles?.grade ?? "—"}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(m.student_id)}>Remove</Button>
              </li>
            ))}
            {(data?.members ?? []).length === 0 && <li className="py-3 text-sm text-muted-foreground">No students yet.</li>}
          </ul>
        </section>

        <section className="rounded-2xl bg-card p-5 shadow-sm">
          <h2 className="display text-lg font-bold">Strand heatmap</h2>
          <p className="text-xs text-muted-foreground">Latest band per subject for each student.</p>
          {heat.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No practice yet from this class.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-2">Student</th>
                    {SUBJECTS.map((s) => <th key={s.key} className="py-2 pr-2">{s.emoji}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {heat.map((row: any) => (
                    <tr key={row.student_id} className="border-t">
                      <td className="py-2 pr-2 font-semibold">{row.name}</td>
                      {SUBJECTS.map((s) => (
                        <td key={s.key} className="py-2 pr-2">
                          {row.bands[s.key] ? <BandBadge band={row.bands[s.key] as Band} size="sm" /> : <span className="text-muted-foreground">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
