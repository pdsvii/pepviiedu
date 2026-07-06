import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ADMIN_NAV } from "./index";
import { listExamSettings, upsertExamSetting } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/settings")({ component: AdminSettings });

function AdminSettings() {
  const qc = useQueryClient();
  const listFn = useServerFn(listExamSettings);
  const upsert = useServerFn(upsertExamSetting);
  const { data: rows = [] } = useQuery({ queryKey: ["admin","exam_settings"], queryFn: () => listFn() });
  const [year, setYear] = useState<number>(new Date().getFullYear() + 1);
  const [busy, setBusy] = useState(false);

  async function toggle(row: any) {
    await upsert({ data: { year: row.year, performance_task_enabled: !row.performance_task_enabled, notes: row.notes } });
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["admin","exam_settings"] });
  }

  async function addYear() {
    setBusy(true);
    try {
      await upsert({ data: { year, performance_task_enabled: true } });
      qc.invalidateQueries({ queryKey: ["admin","exam_settings"] });
      toast.success("Year added");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <AppShell nav={ADMIN_NAV} title="Platform settings">
      <div className="max-w-2xl rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="display text-lg font-bold">Exam years</h2>
        <p className="text-sm text-muted-foreground">Enable or disable the Performance Task component per exam year.</p>
        <ul className="mt-4 divide-y">
          {rows.map((r: any) => (
            <li key={r.year} className="flex items-center justify-between py-3">
              <div>
                <div className="display text-lg font-bold">{r.year}</div>
                <div className="text-xs text-muted-foreground">Performance Task {r.performance_task_enabled ? "enabled" : "disabled"}</div>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={`sw-${r.year}`} className="text-sm">Performance Task</Label>
                <Switch id={`sw-${r.year}`} checked={r.performance_task_enabled} onCheckedChange={() => toggle(r)} />
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-end gap-2">
          <div className="w-32"><Label>Add year</Label><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></div>
          <Button onClick={addYear} disabled={busy}>Add</Button>
        </div>
      </div>
    </AppShell>
  );
}
