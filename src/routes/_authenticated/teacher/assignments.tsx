import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  listMyClasses, listTopics, browseQuestionsForTopic, createAssignment, listTeacherAssignments,
} from "@/lib/teacher.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SUBJECTS, COMPONENTS, type Subject, type PepComponent } from "@/lib/pep";

export const Route = createFileRoute("/_authenticated/teacher/assignments")({
  component: AssignmentsPage,
});

const NAV = [
  { to: "/teacher", label: "Classes" },
  { to: "/teacher/assignments", label: "Assignments" },
];

function AssignmentsPage() {
  const qc = useQueryClient();
  const classesFn = useServerFn(listMyClasses);
  const topicsFn = useServerFn(listTopics);
  const qsFn = useServerFn(browseQuestionsForTopic);
  const createFn = useServerFn(createAssignment);
  const listFn = useServerFn(listTeacherAssignments);

  const { data: classes = [] } = useQuery({ queryKey: ["teacher","classes"], queryFn: () => classesFn() });
  const { data: assignments = [] } = useQuery({ queryKey: ["teacher","assignments"], queryFn: () => listFn() });

  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<Subject>("mathematics");
  const [grade, setGrade] = useState(5);
  const [component, setComponent] = useState<PepComponent>("CBT");
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [dueAt, setDueAt] = useState("");

  const { data: topics = [] } = useQuery({
    queryKey: ["topics", subject, grade, component],
    queryFn: () => topicsFn({ data: { subject, grade, component } }),
  });
  const { data: questions = [] } = useQuery({
    queryKey: ["questions", selectedTopic],
    queryFn: () => selectedTopic ? qsFn({ data: { topic_id: selectedTopic } }) : Promise.resolve([]),
    enabled: !!selectedTopic,
  });

  const canSubmit = classId && title && picked.size > 0;

  async function submit() {
    try {
      await createFn({ data: {
        class_id: classId, title, question_ids: Array.from(picked),
        due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
      } });
      toast.success("Assignment created");
      setPicked(new Set()); setTitle(""); setDueAt("");
      qc.invalidateQueries({ queryKey: ["teacher","assignments"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create");
    }
  }

  function togglePick(id: string) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPicked(next);
  }

  return (
    <AppShell nav={NAV} title="Assignments">
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl bg-card p-5 shadow-sm lg:col-span-2">
          <h2 className="display text-lg font-bold">Build an assignment</h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <Label>Class</Label>
              <select className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Choose a class…</option>
                {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name} (Grade {c.grade})</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="t">Title</Label>
              <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="d">Due (optional)</Label>
              <Input id="d" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={subject} onChange={(e) => setSubject(e.target.value as Subject)}>
              {SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
              {[4,5,6].map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={component} onChange={(e) => setComponent(e.target.value as PepComponent)}>
              {COMPONENTS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>

          <div className="mt-4">
            <Label>Topic</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {topics.length === 0 && <span className="text-sm text-muted-foreground">No topics for this filter.</span>}
              {topics.map((t: any) => (
                <button key={t.id} onClick={() => setSelectedTopic(t.id)}
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${selectedTopic===t.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {selectedTopic && (
            <div className="mt-4">
              <div className="mb-2 text-sm font-semibold">Pick questions <span className="text-muted-foreground">({picked.size} selected)</span></div>
              <ul className="divide-y">
                {questions.map((q: any) => (
                  <li key={q.id}>
                    <label className="flex cursor-pointer items-start gap-3 py-2">
                      <input type="checkbox" checked={picked.has(q.id)} onChange={() => togglePick(q.id)} className="mt-1" />
                      <div>
                        <div className="text-sm">{q.stem}</div>
                        <div className="text-xs text-muted-foreground">{q.type} · difficulty {q.difficulty}</div>
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button className="mt-4" onClick={submit} disabled={!canSubmit}>Create assignment</Button>
        </section>

        <section className="rounded-2xl bg-card p-5 shadow-sm">
          <h2 className="display text-lg font-bold">Recent</h2>
          {assignments.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="mt-3 divide-y">
              {assignments.map((a: any) => (
                <li key={a.id} className="py-2">
                  <div className="font-semibold">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.classes?.name} {a.due_at ? `· due ${new Date(a.due_at).toLocaleDateString()}` : ""}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
