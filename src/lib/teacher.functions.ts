import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertTeacher(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "teacher" });
  if (!data) throw new Error("Only teachers can do that");
}

export const listMyClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertTeacher(supabase, userId);
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name, grade, join_code, created_at")
      .eq("teacher_id", userId)
      .order("created_at", { ascending: false });
    // Count members per class
    const ids = (classes ?? []).map((c: any) => c.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: members } = await supabase.from("class_members").select("class_id").in("class_id", ids);
      for (const m of members ?? []) counts[m.class_id] = (counts[m.class_id] ?? 0) + 1;
    }
    return (classes ?? []).map((c: any) => ({ ...c, member_count: counts[c.id] ?? 0 }));
  });

export const createClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      name: z.string().min(1).max(80),
      grade: z.number().int().min(4).max(6),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertTeacher(supabase, userId);
    const { data: c, error } = await supabase
      .from("classes")
      .insert({ teacher_id: userId, name: data.name, grade: data.grade })
      .select("*")
      .single();
    if (error) throw error;
    return c;
  });

export const getClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ class_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertTeacher(supabase, userId);
    const { data: klass } = await supabase.from("classes").select("*").eq("id", data.class_id).single();
    if (!klass || klass.teacher_id !== userId) throw new Error("Not your class");
    const { data: members } = await supabase
      .from("class_members")
      .select("student_id, profiles!inner(id, full_name, grade, avatar)")
      .eq("class_id", data.class_id);
    return { klass, members: members ?? [] };
  });

export const addStudentByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ class_id: z.string().uuid(), email: z.string().email() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertTeacher(supabase, userId);
    const { data: klass } = await supabase.from("classes").select("id, teacher_id").eq("id", data.class_id).maybeSingle();
    if (!klass || klass.teacher_id !== userId) throw new Error("Not your class");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Look up user by email
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw error;
    const user = list.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
    if (!user) throw new Error("No student found with that email. Ask their parent to create the account first.");

    // Confirm student role
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r: any) => r.role === "student")) throw new Error("That user is not a student account.");

    await supabaseAdmin.from("class_members").upsert({ class_id: data.class_id, student_id: user.id });
    return { ok: true };
  });

export const removeStudentFromClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ class_id: z.string().uuid(), student_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertTeacher(supabase, userId);
    const { data: klass } = await supabase.from("classes").select("teacher_id").eq("id", data.class_id).maybeSingle();
    if (!klass || klass.teacher_id !== userId) throw new Error("Not your class");
    await supabase.from("class_members").delete().eq("class_id", data.class_id).eq("student_id", data.student_id);
    return { ok: true };
  });

// Class heatmap: for each student in a class, their band per subject (based on most recent attempt).
export const getClassHeatmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ class_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertTeacher(supabase, userId);
    const { data: klass } = await supabase.from("classes").select("teacher_id").eq("id", data.class_id).maybeSingle();
    if (!klass || klass.teacher_id !== userId) throw new Error("Not your class");

    const { data: members } = await supabase
      .from("class_members")
      .select("student_id, profiles!inner(id, full_name)")
      .eq("class_id", data.class_id);

    const rows = [] as any[];
    for (const m of members ?? []) {
      const studentId = m.student_id;
      const { data: attempts } = await supabase
        .from("attempts")
        .select("subject, band, finished_at")
        .eq("student_id", studentId)
        .not("finished_at", "is", null)
        .order("finished_at", { ascending: false });
      const bySubject: Record<string, string | null> = {
        mathematics: null, language_arts: null, science: null, social_studies: null,
      };
      for (const a of attempts ?? []) {
        if (a.subject && bySubject[a.subject] == null) bySubject[a.subject] = a.band;
      }
      rows.push({
        student_id: studentId,
        name: (m as any).profiles?.full_name ?? "Student",
        bands: bySubject,
      });
    }
    return rows;
  });

export const listTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      subject: z.enum(["mathematics", "language_arts", "science", "social_studies"]).optional(),
      grade: z.number().int().min(4).max(6).optional(),
      component: z.enum(["AT", "CBT", "PT"]).optional(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let q = supabase.from("topics").select("id, subject, grade, component, name, strand");
    if (data.subject) q = q.eq("subject", data.subject);
    if (data.grade) q = q.eq("grade", data.grade);
    if (data.component) q = q.eq("component", data.component);
    const { data: rows } = await q.order("subject").order("grade").order("name");
    return rows ?? [];
  });

export const browseQuestionsForTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ topic_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows } = await supabase
      .from("questions")
      .select("id, stem, type, difficulty")
      .eq("topic_id", data.topic_id);
    return rows ?? [];
  });

export const createAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      class_id: z.string().uuid(),
      title: z.string().min(1).max(140),
      due_at: z.string().datetime().optional(),
      question_ids: z.array(z.string().uuid()).min(1).max(50),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertTeacher(supabase, userId);
    const { data: klass } = await supabase.from("classes").select("teacher_id").eq("id", data.class_id).maybeSingle();
    if (!klass || klass.teacher_id !== userId) throw new Error("Not your class");
    const { data: a, error } = await supabase
      .from("assignments")
      .insert({
        teacher_id: userId,
        class_id: data.class_id,
        title: data.title,
        due_at: data.due_at ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    const rows = data.question_ids.map((qid, i) => ({ assignment_id: a.id, question_id: qid, position: i }));
    await supabase.from("assignment_questions").insert(rows);
    return { assignment_id: a.id };
  });

export const listTeacherAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertTeacher(supabase, userId);
    const { data } = await supabase
      .from("assignments")
      .select("id, title, due_at, class_id, created_at, classes!inner(name)")
      .eq("teacher_id", userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const overrideAnswerScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      answer_id: z.string().uuid(),
      score: z.number().min(0).max(1),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertTeacher(supabase, userId);
    await supabase.from("attempt_answers").update({ teacher_override: data.score }).eq("id", data.answer_id);
    return { ok: true };
  });
