import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ADMIN_NAV } from "./index";
import { listExamBlueprints } from "@/lib/exam.functions";
import { upsertBlueprint, deleteBlueprint } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/blueprints")({ component: AdminBlueprints });

function AdminBlueprints() {
  const qc = useQueryClient();
  const listFn = useServerFn(listExamBlueprints);
  const upFn = useServerFn(upsertBlueprint);
  const delFn = useServerFn(deleteBlueprint);
  const { data: rows = [] } = useQuery({ queryKey: ["admin","blueprints"], queryFn: () => listFn() });
  const [edits, setEdits] = useState<Record<string, any>>({});

  function setField(id: string, k: string, v: any) {
    setEdits((p) => ({ ...p, [id]: { ...(p[id] ?? {}), [k]: v } }));
  }
  async function save(row: any) {
    const e = edits[row.id] ?? {};
    const merged = {
      id: row.id,
      grade: row.grade,
      component: row.component,
      subject: row.subject,
      item_count: Number(e.item_count ?? row.item_count),
      duration_minutes: Number(e.duration_minutes ?? row.duration_minutes),
      band_cuts: {
        developing: Number(e.developing ?? row.band_cuts?.developing ?? 50),
        proficient: Number(e.proficient ?? row.band_cuts?.proficient ?? 70),
        highly_proficient: Number(e.highly_proficient ?? row.band_cuts?.highly_proficient ?? 85),
      },
      notes: row.notes,
    };
    try {
      await upFn({ data: merged });
      toast.success("Saved");
      setEdits((p) => { const n = { ...p }; delete n[row.id]; return n; });
      qc.invalidateQueries({ queryKey: ["admin","blueprints"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <AppShell nav={ADMIN_NAV} title="Exam blueprints">
      <p className="text-sm text-muted-foreground">Configure per grade/component/subject. Defaults are placeholders pending official Ministry of Education spec.</p>
      <div className="mt-4 overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Grade</th><th className="p-3">Component</th><th className="p-3">Subject</th>
              <th className="p-3">Items</th><th className="p-3">Minutes</th>
              <th className="p-3">Developing ≥</th><th className="p-3">Proficient ≥</th><th className="p-3">Highly ≥</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(rows as any[]).map((r) => {
              const e = edits[r.id] ?? {};
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.grade}</td>
                  <td className="p-3">{r.component}</td>
                  <td className="p-3 capitalize">{r.subject ? r.subject.replace("_"," ") : "—"}</td>
                  <td className="p-3"><Input type="number" className="w-20" defaultValue={r.item_count} onChange={(ev) => setField(r.id, "item_count", ev.target.value)} /></td>
                  <td className="p-3"><Input type="number" className="w-20" defaultValue={r.duration_minutes} onChange={(ev) => setField(r.id, "duration_minutes", ev.target.value)} /></td>
                  <td className="p-3"><Input type="number" className="w-20" defaultValue={r.band_cuts?.developing ?? 50} onChange={(ev) => setField(r.id, "developing", ev.target.value)} /></td>
                  <td className="p-3"><Input type="number" className="w-20" defaultValue={r.band_cuts?.proficient ?? 70} onChange={(ev) => setField(r.id, "proficient", ev.target.value)} /></td>
                  <td className="p-3"><Input type="number" className="w-20" defaultValue={r.band_cuts?.highly_proficient ?? 85} onChange={(ev) => setField(r.id, "highly_proficient", ev.target.value)} /></td>
                  <td className="p-3 space-x-2 whitespace-nowrap">
                    <Button size="sm" onClick={() => save(r)} disabled={!edits[r.id]}>Save</Button>
                    <Button size="sm" variant="outline" onClick={async () => { if (confirm("Delete?")) { await delFn({ data: { id: r.id } }); qc.invalidateQueries({ queryKey: ["admin","blueprints"] }); } }}>Delete</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
