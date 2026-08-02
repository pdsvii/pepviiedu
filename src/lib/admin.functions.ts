import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_admin", { _user_id: userId });
  if (error) throw error;
  if (!data) throw new Error("Admin only");
}

// -------- Users & roles --------
export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ search: z.string().optional(), limit: z.number().int().min(1).max(200).default(100) }).parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: data.limit });
    if (error) throw error;
    const list = users.users
      .filter((u) => !data.search || (u.email ?? "").toLowerCase().includes(data.search.toLowerCase()))
      .map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, banned_until: (u as any).banned_until }));
    const ids = list.map((u) => u.id);
    if (ids.length === 0) return [];
    const [{ data: roles }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
      supabaseAdmin.from("profiles").select("id, full_name, grade, is_disabled").in("id", ids),
    ]);
    const rmap = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => { const a = rmap.get(r.user_id) ?? []; a.push(r.role); rmap.set(r.user_id, a); });
    const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return list.map((u) => ({ ...u, roles: rmap.get(u.id) ?? [], profile: pmap.get(u.id) ?? null }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ user_id: z.string().uuid(), role: z.enum(["student","parent","teacher","admin"]) }).parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.role });
    if (error) throw error;
    return { ok: true };
  });

export const setUserDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ user_id: z.string().uuid(), disabled: z.boolean() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) throw new Error("You can't disable your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.disabled ? "876000h" : "none",
    } as any);
    if (error) throw error;
    await supabaseAdmin.from("profiles").update({ is_disabled: data.disabled }).eq("id", data.user_id);
    return { ok: true };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    const email = u?.user?.email;
    if (!email) throw new Error("User has no email");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({ type: "recovery", email });
    if (error) throw error;
    return { action_link: link?.properties?.action_link ?? null };
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(6).max(72),
      full_name: z.string().min(1).max(120),
      role: z.enum(["student","parent","teacher","admin"]),
      grade: z.number().int().min(4).max(6).optional(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      user_metadata: { full_name: data.full_name, role: data.role },
    });
    if (error || !created?.user) throw new Error(error?.message ?? "Failed");
    const id = created.user.id;
    await supabaseAdmin.from("profiles").upsert({ id, full_name: data.full_name, grade: data.grade ?? null });
    await supabaseAdmin.from("user_roles").upsert({ user_id: id, role: data.role }, { onConflict: "user_id,role" });
    return { id };
  });

// -------- Allowlist --------
export const listAllowlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await context.supabase.from("admin_allowlist").select("*").order("created_at", { ascending: false });
    return data ?? [];
  });

export const addAllowlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ email: z.string().email(), note: z.string().optional() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const email = data.email.toLowerCase();
    const { error } = await context.supabase.from("admin_allowlist").insert({ email, note: data.note ?? null });
    if (error) throw error;
    // If user with that email already exists, grant admin now.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = list.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (found) {
      await supabaseAdmin.from("user_roles").upsert({ user_id: found.id, role: "admin" }, { onConflict: "user_id,role" });
    }
    return { ok: true };
  });

export const removeAllowlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ email: z.string().email() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    await context.supabase.from("admin_allowlist").delete().eq("email", data.email.toLowerCase());
    return { ok: true };
  });

// -------- Content (topics, passages, questions) --------
export const listTopics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await context.supabase.from("topics").select("*").order("grade").order("subject");
    return data ?? [];
  });

export const upsertTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      subject: z.enum(["mathematics","language_arts","science","social_studies"]),
      grade: z.number().int().min(4).max(6),
      component: z.enum(["AT","CBT","PT"]),
      name: z.string().min(1),
      strand: z.string().optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const row: any = { subject: data.subject, grade: data.grade, component: data.component, name: data.name, strand: data.strand ?? null };
    if (data.id) row.id = data.id;
    const { data: out, error } = await context.supabase.from("topics").upsert(row).select().single();
    if (error) throw error;
    return out;
  });

export const deleteTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("topics").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    topic_id: z.string().uuid().optional(),
    source: z.enum(["all","moey_official_2018","ai_generated"]).default("all"),
    needs_review: z.boolean().optional(),
    limit: z.number().int().min(1).max(500).default(200),
  }).parse(i ?? {}))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    let q = context.supabase.from("questions").select("id, topic_id, type, stem, options, answer_key, rubric, explanation, media, passage_id, difficulty, source, source_ref, needs_review, created_at, topics(name, subject, grade, component)").order("created_at", { ascending: false }).limit(data.limit);
    if (data.topic_id) q = q.eq("topic_id", data.topic_id);
    if (data.source && data.source !== "all") q = q.eq("source", data.source);
    if (data.needs_review !== undefined) q = q.eq("needs_review", data.needs_review);
    const { data: out } = await q;
    return out ?? [];
  });

export const upsertQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      topic_id: z.string().uuid(),
      type: z.enum(["mc","multi","tf","numeric","matching","ordering","short_text","pt_scenario"]),
      stem: z.string().min(1),
      options: z.any().optional(),
      answer_key: z.any().optional(),
      rubric: z.any().optional(),
      difficulty: z.number().int().min(1).max(5).default(2),
      explanation: z.string().optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const row: any = { ...data };
    if (!data.id) delete row.id;
    const { data: out, error } = await context.supabase.from("questions").upsert(row).select().single();
    if (error) throw error;
    return out;
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("questions").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// -------- Schools & classes --------
export const listSchools = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await context.supabase.from("schools").select("*").order("name");
    return data ?? [];
  });

export const upsertSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid().optional(), name: z.string().min(1), parish: z.string().optional().nullable() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const row: any = { name: data.name, parish: data.parish ?? null };
    if (data.id) row.id = data.id;
    const { data: out, error } = await context.supabase.from("schools").upsert(row).select().single();
    if (error) throw error;
    return out;
  });

export const deleteSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("schools").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listAllClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("classes")
      .select("id, name, grade, join_code, teacher_id, school_id, created_at, profiles!classes_teacher_id_fkey(full_name), schools(name)");
    return data ?? [];
  });

export const assignClassTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ class_id: z.string().uuid(), teacher_id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("classes").update({ teacher_id: data.teacher_id }).eq("id", data.class_id);
    if (error) throw error;
    return { ok: true };
  });

export const assignClassSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ class_id: z.string().uuid(), school_id: z.string().uuid().nullable() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("classes").update({ school_id: data.school_id }).eq("id", data.class_id);
    if (error) throw error;
    return { ok: true };
  });

// -------- Analytics --------
export const platformAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = context.supabase;
    const [{ count: users }, { count: attempts }, { count: questions }, { count: classes }, { count: schools }, { data: bands }] =
      await Promise.all([
        sb.from("profiles").select("id", { count: "exact", head: true }),
        sb.from("attempts").select("id", { count: "exact", head: true }).not("finished_at", "is", null),
        sb.from("questions").select("id", { count: "exact", head: true }),
        sb.from("classes").select("id", { count: "exact", head: true }),
        sb.from("schools").select("id", { count: "exact", head: true }),
        sb.from("attempts").select("band, subject").not("band", "is", null).limit(2000),
      ]);
    const bandCounts: Record<string, number> = {};
    (bands ?? []).forEach((r: any) => { if (r.band) bandCounts[r.band] = (bandCounts[r.band] ?? 0) + 1; });
    return { users: users ?? 0, attempts: attempts ?? 0, questions: questions ?? 0, classes: classes ?? 0, schools: schools ?? 0, bandCounts };
  });

// -------- Exam settings --------
export const listExamSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await context.supabase.from("exam_settings").select("*").order("year");
    return data ?? [];
  });

export const upsertExamSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ year: z.number().int().min(2024).max(2100), performance_task_enabled: z.boolean(), notes: z.string().optional().nullable() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("exam_settings")
      .upsert({ year: data.year, performance_task_enabled: data.performance_task_enabled, notes: data.notes ?? null, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { ok: true };
  });

// -------- Exam blueprints --------
export const upsertBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      grade: z.number().int().min(4).max(6),
      component: z.enum(["AT","CBT","PT"]),
      subject: z.enum(["mathematics","language_arts","science","social_studies"]).nullable().optional(),
      item_count: z.number().int().min(1).max(200),
      duration_minutes: z.number().int().min(1).max(300),
      band_cuts: z.object({
        developing: z.number().min(0).max(100),
        proficient: z.number().min(0).max(100),
        highly_proficient: z.number().min(0).max(100),
      }),
      notes: z.string().optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const row: any = { ...data, subject: data.subject ?? null, is_default: false };
    if (!data.id) delete row.id;
    const { data: out, error } = await context.supabase.from("exam_blueprints").upsert(row).select().single();
    if (error) throw error;
    return out;
  });

export const deleteBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("exam_blueprints").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// -------- AI-generated PEP items --------
export const generateExamItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      grade: z.number().int().min(4).max(6),
      subject: z.enum(["mathematics","language_arts","science","social_studies"]),
      component: z.enum(["AT","CBT","PT"]),
      strand: z.string().optional(),
      count: z.number().int().min(1).max(20).default(5),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY missing");

    // Ensure a topic exists
    const strand = data.strand ?? "general";
    let { data: topic } = await context.supabase.from("topics").select("id")
      .eq("subject", data.subject).eq("grade", data.grade).eq("component", data.component).eq("strand", strand).maybeSingle();
    if (!topic) {
      const { data: t, error } = await context.supabase.from("topics").insert({
        subject: data.subject, grade: data.grade, component: data.component,
        name: `${data.subject} · ${strand}`, strand,
      }).select("id").single();
      if (error) throw error;
      topic = t;
    }

    const prompt = `Generate ${data.count} Jamaica PEP practice items for a Grade ${data.grade} student.
Subject: ${data.subject}. Component: ${data.component}. Strand: ${strand}.
Items must be age-appropriate, Jamaican cultural context where relevant, and aligned to the PEP curriculum.

Return JSON: { "items": [ { "type": "mc"|"numeric"|"short_text"|"pt_scenario", "stem": string, "options": string[] (for mc, 4 options), "answer_key": { "value": <index-for-mc | number-for-numeric | string-for-short_text>, "tolerance": <optional-number> }, "rubric": { "criteria": string[], "max": 1 } (for pt_scenario/short_text), "explanation": string, "difficulty": 1-5 } ] }.
For mc: answer_key.value is the 0-based index of the correct option.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "openai/gpt-5.5",
        messages: [
          { role: "system", content: "You are a PEP (Primary Exit Profile) content writer for Jamaican primary schools. Output only valid JSON." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI error ${res.status}: ${t.slice(0, 200)}`);
    }
    const j: any = await res.json();
    const content = j?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { throw new Error("AI returned invalid JSON"); }
    const items: any[] = Array.isArray(parsed.items) ? parsed.items : [];
    if (items.length === 0) throw new Error("No items returned");

    const rows = items.map((it) => ({
      topic_id: topic!.id,
      type: (["mc","multi","tf","numeric","short_text","pt_scenario","matching","ordering"].includes(it.type) ? it.type : "mc"),
      stem: String(it.stem ?? "").slice(0, 4000),
      options: it.options ?? null,
      answer_key: it.answer_key ?? null,
      rubric: it.rubric ?? null,
      difficulty: Math.max(1, Math.min(5, Number(it.difficulty ?? 2))),
      explanation: it.explanation ?? null,
    }));
    const { error: insErr, data: inserted } = await context.supabase.from("questions").insert(rows).select("id");
    if (insErr) throw insErr;
    return { inserted: inserted?.length ?? 0 };
  });

// -------- Answer keys --------
// Items whose key is missing/unusable come first so admins can close gaps fast.
export const listAnswerKeyQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    status: z.enum(["all", "missing", "ready"]).default("all"),
    source: z.enum(["all", "moey_official_2018", "ai_generated"]).default("all"),
    search: z.string().optional(),
    limit: z.number().int().min(1).max(500).default(300),
  }).parse(i ?? {}))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("questions")
      .select("id, type, stem, options, answer_key, rubric, explanation, difficulty, source, source_ref, needs_review, topics(name, subject, grade, component, strand)")
      .limit(data.limit);
    if (data.source !== "all") q = q.eq("source", data.source);
    if (data.search) q = q.ilike("stem", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const setAnswerKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(),
    answer_key: z.any(),
    explanation: z.string().optional().nullable(),
    needs_review: z.boolean().optional(),
  }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const update: any = { answer_key: data.answer_key ?? null };
    if (data.explanation !== undefined) update.explanation = data.explanation;
    if (data.needs_review !== undefined) update.needs_review = data.needs_review;
    const { data: out, error } = await context.supabase
      .from("questions").update(update).eq("id", data.id)
      .select("id, answer_key, needs_review, explanation").single();
    if (error) throw error;
    return out;
  });
