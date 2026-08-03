import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createReviewNote } from "@/lib/tester.functions";
import { REVIEW_AREAS, REVIEW_CATEGORIES, REVIEW_SEVERITIES } from "@/lib/review-areas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { MessageSquarePlus } from "lucide-react";

/**
 * Review note composer. Used both for whole sections of the app and for a
 * single question (when questionId is provided).
 */
export function ReviewNoteDialog({
  questionId,
  defaultArea = "general",
  route,
  triggerLabel = "Add comment",
  variant = "default",
  size = "sm",
}: {
  questionId?: string;
  defaultArea?: string;
  route?: string;
  triggerLabel?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "sm" | "default";
}) {
  const qc = useQueryClient();
  const create = useServerFn(createReviewNote);
  const [open, setOpen] = useState(false);
  const [area, setArea] = useState(defaultArea);
  const [category, setCategory] = useState(questionId ? "content" : "bug");
  const [severity, setSeverity] = useState("medium");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [fix, setFix] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (title.trim().length < 3 || body.trim().length < 5) {
      toast.error("Add a short title and a description of what needs fixing.");
      return;
    }
    setSaving(true);
    try {
      await create({
        data: {
          question_id: questionId ?? null,
          area: area as never,
          route: route ?? (typeof window !== "undefined" ? window.location.pathname : null),
          category: category as never,
          severity: severity as never,
          title: title.trim(),
          body: body.trim(),
          suggested_fix: fix.trim() || null,
        },
      });
      toast.success("Thanks — your review note was logged.");
      setTitle(""); setBody(""); setFix("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["review"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <MessageSquarePlus className="mr-1.5 h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="display">{questionId ? "Comment on this question" : "Review comment"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {!questionId && (
            <div>
              <Label>Section of the app</Label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REVIEW_AREAS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>What kind of issue?</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REVIEW_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REVIEW_SEVERITIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="rn-title">Title</Label>
            <Input id="rn-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary of the correction" maxLength={160} />
          </div>
          <div>
            <Label htmlFor="rn-body">What needs correcting?</Label>
            <Textarea id="rn-body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={4000}
              placeholder="Describe what you saw, and why it needs to change." />
          </div>
          <div>
            <Label htmlFor="rn-fix">Suggested update (optional)</Label>
            <Textarea id="rn-fix" value={fix} onChange={(e) => setFix(e.target.value)} rows={3} maxLength={4000}
              placeholder="e.g. the correct answer should be C, or reword the stem to…" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Submit review note"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
