import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { scoreToBand } from "@/lib/pep";

const SubjectEnum = z.enum(["mathematics", "language_arts", "science", "social_studies"]);
const ComponentEnum = z.enum(["AT", "CBT", "PT"]);

// Assert the caller is a student.
async function assertStudent(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "student" });
  if (!data) throw new Error("Only students can do that");
}

// Start a practice session: pick N questions matching filter, create an attempt row.
export const startPracticeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      subject: SubjectEnum,
      grade: z.number().int().min(4).max(6),
      component: ComponentEnum,
      count: z.number().int().min(3).max(20).default(6),
      assignment_id: z.string().uuid().optional(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertStudent(supabase, userId);

    let questionIds: string[] = [];
    if (data.assignment_id) {
      const { data: aq } = await supabase
        .from("assignment_questions")
        .select("question_id, position")
        .eq("assignment_id", data.assignment_id)
        .order("position");
      questionIds = (aq ?? []).map((r: any) => r.question_id);
    } else {
      const { data: topics } = await supabase
        .from("topics")
        .select("id")
        .eq("subject", data.subject)
        .eq("grade", data.grade)
        .eq("component", data.component);
      const topicIds = (topics ?? []).map((t: any) => t.id);
      if (topicIds.length === 0) return { attempt_id: null, questions: [] };
      const { data: qs } = await supabase
        .from("questions")
        .select("id")
        .in("topic_id", topicIds);
      const shuffled = [...(qs ?? [])].sort(() => Math.random() - 0.5).slice(0, data.count);
      questionIds = shuffled.map((q: any) => q.id);
    }

    if (questionIds.length === 0) return { attempt_id: null, questions: [] };

    const { data: attempt, error: aErr } = await supabase
      .from("attempts")
      .insert({
        student_id: userId,
        subject: data.subject,
        grade: data.grade,
        component: data.component,
        assignment_id: data.assignment_id ?? null,
      })
      .select("id")
      .single();
    if (aErr) throw aErr;

    const { data: questions } = await supabase
      .from("questions")
      .select("id, type, stem, media, options, passage_id, topic_id, difficulty")
      .in("id", questionIds);

    // Sort questions in the order they were selected
    const order = new Map(questionIds.map((id, i) => [id, i]));
    const ordered = (questions ?? []).sort((a: any, b: any) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    // Fetch any passages referenced.
    const passageIds = Array.from(new Set(ordered.map((q: any) => q.passage_id).filter(Boolean)));
    let passages: any[] = [];
    if (passageIds.length) {
      const { data: p } = await supabase.from("passages").select("id, title, body").in("id", passageIds);
      passages = p ?? [];
    }

    return { attempt_id: attempt.id, questions: ordered, passages };
  });

// Score a single answer against its answer key. Returns { correct, score, explanation }.
export const submitAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      attempt_id: z.string().uuid(),
      question_id: z.string().uuid(),
      response: z.any(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Load question with answer key
    const { data: q, error: qErr } = await supabase
      .from("questions")
      .select("id, type, answer_key, explanation, rubric")
      .eq("id", data.question_id)
      .single();
    if (qErr) throw qErr;

    // Verify attempt belongs to caller
    const { data: attempt } = await supabase.from("attempts").select("id, student_id").eq("id", data.attempt_id).single();
    if (!attempt || attempt.student_id !== userId) throw new Error("Not your attempt");

    let correct: boolean | null = null;
    let score: number | null = null;
    const key = q.answer_key as any;

    switch (q.type) {
      case "mc":
      case "tf": {
        correct = Number(data.response) === Number(key?.correct);
        score = correct ? 1 : 0;
        break;
      }
      case "multi": {
        const chosen = Array.isArray(data.response) ? [...data.response].sort() : [];
        const expected = Array.isArray(key?.correct) ? [...key.correct].sort() : [];
        correct = JSON.stringify(chosen) === JSON.stringify(expected);
        score = correct ? 1 : 0;
        break;
      }
      case "numeric": {
        const v = Number(data.response);
        correct = !Number.isNaN(v) && Math.abs(v - Number(key?.value)) < 1e-6;
        score = correct ? 1 : 0;
        break;
      }
      case "short_text": {
        // Naive keyword hit-rate scoring; teacher can override later.
        const answer = String(data.response ?? "").toLowerCase();
        const keywords: string[] = Array.isArray(key?.keywords) ? key.keywords : [];
        const hits = keywords.filter((k) => answer.includes(k.toLowerCase())).length;
        score = keywords.length ? hits / keywords.length : 0;
        correct = score >= 0.6;
        break;
      }
      case "pt_scenario": {
        // Deferred: teacher scores manually. Store as pending.
        score = null;
        correct = null;
        break;
      }
      default: {
        score = null;
        correct = null;
      }
    }

    await supabase.from("attempt_answers").insert({
      attempt_id: data.attempt_id,
      question_id: data.question_id,
      response: data.response,
      correct,
      score,
    });

    return { correct, score, explanation: q.explanation, rubric: q.rubric };
  });

export const finishPracticeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ attempt_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: attempt } = await supabase.from("attempts").select("id, student_id").eq("id", data.attempt_id).single();
    if (!attempt || attempt.student_id !== userId) throw new Error("Not your attempt");

    const { data: answers } = await supabase.from("attempt_answers").select("score").eq("attempt_id", data.attempt_id);
    const scored = (answers ?? []).filter((a: any) => a.score !== null);
    const total = scored.length;
    const sum = scored.reduce((s: number, a: any) => s + Number(a.score), 0);
    const pct = total > 0 ? Math.round((sum / total) * 100) : 0;
    const band = scoreToBand(pct);

    await supabase
      .from("attempts")
      .update({ score: pct, band, finished_at: new Date().toISOString() })
      .eq("id", data.attempt_id);

    // Award a streak reward if this puts them at proficient or higher.
    if (band === "proficient" || band === "highly_proficient") {
      await supabase.from("rewards").insert({
        student_id: userId,
        kind: "band",
        label: band === "highly_proficient" ? "⭐ Highly Proficient" : "🌱 Proficient",
      });
    }

    return { band, pct };
  });

// List recent attempts for the current student.
export const listMyAttempts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("attempts")
      .select("id, subject, grade, component, band, score, finished_at, started_at")
      .eq("student_id", userId)
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(20);
    return data ?? [];
  });

export const listMyRewards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("rewards")
      .select("id, kind, label, earned_at")
      .eq("student_id", userId)
      .order("earned_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const listMyAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Classes the student belongs to
    const { data: memberships } = await supabase.from("class_members").select("class_id").eq("student_id", userId);
    const classIds = (memberships ?? []).map((m: any) => m.class_id);
    if (classIds.length === 0) return [];
    const { data } = await supabase
      .from("assignments")
      .select("id, title, due_at, class_id, created_at")
      .in("class_id", classIds)
      .order("due_at", { ascending: true, nullsFirst: false });
    return data ?? [];
  });
