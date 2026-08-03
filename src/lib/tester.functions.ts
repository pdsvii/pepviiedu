import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const AREAS = [
  "general","auth","student_dashboard","practice","exam","results",
  "parent","teacher","content","answer_keys","admin","performance",
] as const;
const CATEGORIES = [
  "content","answer_key","wording","curriculum_alignment","layout","bug","accessibility","suggestion",
] as const;
const SEVERITIES = ["low","medium","high","blocker"] as const;
const STATUSES = ["open","acknowledged","in_progress","fixed","wont_fix"] as const;

/** App Testers (teachers + MOEY reps) and admins may use the review console. */
async function assertReviewer(supabase: SupabaseClient<any>, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw error;
  const roles = (data ?? []).map((r: any) => String(r.role));
  const ok = roles.includes("tester") || roles.includes("admin");
  if (!ok) throw new Error("This area is for App Testers only");
  return { roles, isAdmin: roles.includes("admin") };
}

export const getReviewerContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { roles, isAdmin } = await assertReviewer(context.supabase, context.userId);
    return { roles, isAdmin, isTester: roles.includes("tester") };
  });

/** Questions to review, newest first, with this reviewer's note counts attached. */
export const listReviewQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      grade: z.number().int().min(4).max(6).optional(),
      subject: z.enum(["mathematics","language_arts","science","social_studies"]).optional(),
      component: z.enum(["AT","CBT","PT"]).optional(),
      source: z.string().optional(),
      search: z.string().max(200).optional(),
      only_unreviewed: z.boolean().optional(),
      limit: z.number().int().min(1).max(200).default(50),
    }).parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { isAdmin } = await assertReviewer(context.supabase, context.userId);
    const { supabase, userId } = context;

    let q = supabase
      .from("questions")
      .select("id, type, stem, options, answer_key, explanation, difficulty, source, source_ref, needs_review, created_at, topic_id, topics(name, subject, grade, component)")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.source && data.source !== "all") q = q.eq("source", data.source);
    if (data.search) q = q.ilike("stem", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw error;

    let questions = (rows ?? []).filter((r: any) => {
      const t = r.topics;
      if (data.grade && t?.grade !== data.grade) return false;
      if (data.subject && t?.subject !== data.subject) return false;
      if (data.component && t?.component !== data.component) return false;
      return true;
    });

    const ids = questions.map((r: any) => r.id);
    const counts = new Map<string, number>();
    if (ids.length) {
      let nq = supabase.from("review_notes").select("question_id, author_id").in("question_id", ids);
      if (!isAdmin) nq = nq.eq("author_id", userId);
      const { data: notes } = await nq;
      (notes ?? []).forEach((n: any) => counts.set(n.question_id, (counts.get(n.question_id) ?? 0) + 1));
    }
    questions = questions.map((r: any) => ({ ...r, note_count: counts.get(r.id) ?? 0 }));
    if (data.only_unreviewed) questions = questions.filter((r: any) => r.note_count === 0);
    return questions;
  });

/** Filter options for the console (grades/subjects present in the bank). */
export const reviewFilters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertReviewer(context.supabase, context.userId);
    const { data } = await context.supabase.from("topics").select("grade, subject, component");
    const grades = [...new Set((data ?? []).map((t: any) => t.grade))].sort();
    const subjects = [...new Set((data ?? []).map((t: any) => t.subject))].sort();
    return { grades, subjects };
  });

export const createReviewNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      question_id: z.string().uuid().nullable().optional(),
      area: z.enum(AREAS).default("general"),
      route: z.string().max(300).optional().nullable(),
      category: z.enum(CATEGORIES).default("content"),
      severity: z.enum(SEVERITIES).default("medium"),
      title: z.string().trim().min(3).max(160),
      body: z.string().trim().min(5).max(4000),
      suggested_fix: z.string().trim().max(4000).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertReviewer(context.supabase, context.userId);
    const { error, data: out } = await context.supabase
      .from("review_notes")
      .insert({
        author_id: context.userId,
        question_id: data.question_id ?? null,
        area: data.area,
        route: data.route ?? null,
        category: data.category,
        severity: data.severity,
        title: data.title,
        body: data.body,
        suggested_fix: data.suggested_fix || null,
      })
      .select()
      .single();
    if (error) throw error;
    return out;
  });

export const updateMyReviewNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      category: z.enum(CATEGORIES).optional(),
      severity: z.enum(SEVERITIES).optional(),
      title: z.string().trim().min(3).max(160).optional(),
      body: z.string().trim().min(5).max(4000).optional(),
      suggested_fix: z.string().trim().max(4000).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertReviewer(context.supabase, context.userId);
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("review_notes").update(patch).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteReviewNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertReviewer(context.supabase, context.userId);
    const { error } = await context.supabase.from("review_notes").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/** Notes visible to the caller. RLS narrows testers to their own notes. */
export const listReviewNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      question_id: z.string().uuid().optional(),
      area: z.enum(AREAS).optional(),
      status: z.enum(STATUSES).optional(),
      limit: z.number().int().min(1).max(300).default(200),
    }).parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertReviewer(context.supabase, context.userId);
    let q = context.supabase
      .from("review_notes")
      .select("*, questions(stem, type, topics(name, subject, grade, component))")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.question_id) q = q.eq("question_id", data.question_id);
    if (data.area) q = q.eq("area", data.area);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const reviewSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertReviewer(context.supabase, context.userId);
    const { data: notes } = await context.supabase.from("review_notes").select("status, severity, area, question_id");
    const byStatus: Record<string, number> = {};
    const byArea: Record<string, number> = {};
    let blockers = 0;
    let onQuestions = 0;
    (notes ?? []).forEach((n: any) => {
      byStatus[n.status] = (byStatus[n.status] ?? 0) + 1;
      byArea[n.area] = (byArea[n.area] ?? 0) + 1;
      if (n.severity === "blocker") blockers += 1;
      if (n.question_id) onQuestions += 1;
    });
    const { count: questionCount } = await context.supabase
      .from("questions")
      .select("id", { count: "exact", head: true });
    return { total: (notes ?? []).length, byStatus, byArea, blockers, onQuestions, questionCount: questionCount ?? 0 };
  });

/** Admin triage: change status / reply to a note. */
export const setReviewNoteStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(STATUSES),
      admin_response: z.string().trim().max(4000).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { isAdmin } = await assertReviewer(context.supabase, context.userId);
    if (!isAdmin) throw new Error("Only admins can triage review notes");
    const patch: Record<string, unknown> = { status: data.status };
    if (data.admin_response !== undefined) patch['admin_response'] = data.admin_response || null;
    const { error } = await context.supabase.from("review_notes").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
