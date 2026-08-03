import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Band } from "@/lib/pep";
import { gradeAnswer, keyIsUsable } from "@/lib/grading";

const SubjectEnum = z.enum(["mathematics", "language_arts", "science", "social_studies"]);
const ComponentEnum = z.enum(["AT", "CBT", "PT"]);

type BandCuts = { developing?: number; proficient?: number; highly_proficient?: number };
function pctToBand(pct: number, cuts: BandCuts): Band {
  const hp = cuts.highly_proficient ?? 85;
  const p = cuts.proficient ?? 70;
  const d = cuts.developing ?? 50;
  if (pct >= hp) return "highly_proficient";
  if (pct >= p) return "proficient";
  if (pct >= d) return "developing";
  return "beginning";
}

function shuffle<T>(arr: T[]): T[] { return [...arr].sort(() => Math.random() - 0.5); }

// MOEY-style paper assembly:
//  * strands are sampled round-robin so every strand in the blueprint's grade/subject appears
//  * only one item per concept family (a MOEY parent item and its variations count as one)
//  * item_mix (type -> share) is honoured when the blueprint defines one
//  * items are ordered easiest -> hardest, the way official PEP papers ramp up
function buildPaper(
  qs: any[],
  topicMap: Map<string, any>,
  bp: { item_count: number; item_mix?: Record<string, number> | null; component: string },
): any[] {
  const target = bp.item_count;
  const mix = bp.item_mix && Object.keys(bp.item_mix).length ? bp.item_mix : null;

  // One representative per concept family, preferring official MOEY wording.
  const families = new Map<string, any[]>();
  for (const q of qs) {
    const fam = q.source_ref ?? q.id;
    (families.get(fam) ?? families.set(fam, []).get(fam)!).push(q);
  }
  const pool: any[] = [];
  for (const members of families.values()) {
    const official = members.find((m) => m.source === "moey_official_2018");
    pool.push(official ?? shuffle(members)[0]);
  }

  // Type quotas from item_mix (shares or counts both work).
  const quotas = new Map<string, number>();
  if (mix) {
    const totalWeight = Object.values(mix).reduce((a, b) => a + Number(b || 0), 0) || 1;
    for (const [type, w] of Object.entries(mix)) {
      quotas.set(type, Math.round((Number(w) / totalWeight) * target));
    }
  }
  const typeUsed = new Map<string, number>();
  const fitsMix = (type: string) => {
    if (!mix) return true;
    const cap = quotas.get(type);
    if (cap === undefined) return false;
    return (typeUsed.get(type) ?? 0) < cap;
  };

  // Group by strand for round-robin sampling.
  const byStrand = new Map<string, any[]>();
  for (const q of pool) {
    const t = topicMap.get(q.topic_id);
    const key = `${t?.subject ?? "general"}::${t?.strand ?? "general"}`;
    (byStrand.get(key) ?? byStrand.set(key, []).get(key)!).push(q);
  }
  const groups = shuffle([...byStrand.values()]).map((g) => shuffle(g));

  const chosen: any[] = [];
  const leftovers: any[] = [];
  let progress = true;
  while (chosen.length < target && progress) {
    progress = false;
    for (const g of groups) {
      if (chosen.length >= target) break;
      const next = g.shift();
      if (!next) continue;
      progress = true;
      if (fitsMix(next.type)) {
        chosen.push(next);
        typeUsed.set(next.type, (typeUsed.get(next.type) ?? 0) + 1);
      } else {
        leftovers.push(next);
      }
    }
  }
  // Top up with anything left so a paper is never short when content exists.
  for (const q of leftovers) {
    if (chosen.length >= target) break;
    chosen.push(q);
  }

  return chosen.sort((a, b) => Number(a.difficulty ?? 2) - Number(b.difficulty ?? 2));
}

// -------- Blueprints (readable to authenticated) --------
export const listExamBlueprints = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("exam_blueprints").select("*").order("grade").order("component").order("subject");
    if (error) throw error;
    return data ?? [];
  });

// -------- Start an exam session --------
export const startExamSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      grade: z.number().int().min(4).max(6),
      component: ComponentEnum,
      subject: SubjectEnum.optional(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    let bpQuery = supabase.from("exam_blueprints").select("*")
      .eq("grade", data.grade).eq("component", data.component);
    bpQuery = data.subject ? bpQuery.eq("subject", data.subject) : bpQuery.is("subject", null);
    const { data: bp, error: bpErr } = await bpQuery.maybeSingle();
    if (bpErr) throw bpErr;
    if (!bp) throw new Error("No blueprint configured for that selection");

    // Pull matching topics
    let topicsQ = supabase.from("topics").select("id, subject, strand, name")
      .eq("grade", data.grade).eq("component", data.component);
    if (data.subject) topicsQ = topicsQ.eq("subject", data.subject);
    const { data: topics } = await topicsQ;
    if (!topics || topics.length === 0) throw new Error("No content available for this exam yet. Ask an admin to generate items.");

    const topicMap = new Map(topics.map((t: any) => [t.id, t]));
    const topicIds = topics.map((t: any) => t.id);
    const { data: qs, error: qErr } = await supabase.from("questions")
      .select("id, topic_id, type, difficulty, source, source_ref").in("topic_id", topicIds);
    if (qErr) throw qErr;
    if (!qs || qs.length === 0) throw new Error("No questions available yet. Ask an admin to generate items.");

    const picked = buildPaper(qs as any[], topicMap, bp);
    if (picked.length === 0) throw new Error("Not enough questions to assemble this paper yet.");

    // Create session
    const timeLimit = bp.duration_minutes * 60;
    const { data: session, error: sErr } = await supabase.from("exam_sessions").insert({
      student_id: userId,
      blueprint_id: bp.id,
      grade: data.grade,
      component: data.component,
      subject: data.subject ?? null,
      time_limit_seconds: timeLimit,
      remaining_seconds: timeLimit,
    }).select("id").single();
    if (sErr) throw sErr;

    const rows = picked.map((q: any, idx: number) => {
      const t = topicMap.get(q.topic_id) as any;
      return {
        session_id: session.id,
        question_id: q.id,
        order_index: idx,
        subject: t?.subject ?? null,
        strand: t?.strand ?? null,
        points_max: 1,
      };
    });
    const { error: iErr } = await supabase.from("exam_session_items").insert(rows);
    if (iErr) throw iErr;

    return { session_id: session.id, item_count: rows.length, time_limit_seconds: timeLimit };
  });

// -------- Fetch session (no answer keys) --------
export const getExamSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ session_id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: session, error } = await supabase.from("exam_sessions").select("*").eq("id", data.session_id).single();
    if (error) throw error;

    const { data: items } = await supabase.from("exam_session_items")
      .select("id, order_index, subject, strand, student_answer, flagged, question_id, points_max, is_correct, points_awarded, ai_feedback")
      .eq("session_id", data.session_id).order("order_index");

    const qIds = (items ?? []).map((i: any) => i.question_id);
    const includeAnswers = session.status !== "in_progress";
    const cols = includeAnswers
      ? "id, type, stem, media, options, passage_id, topic_id, difficulty, answer_key, rubric, explanation"
      : "id, type, stem, media, options, passage_id, topic_id, difficulty";
    const { data: qs } = await supabase.from("questions").select(cols).in("id", qIds);
    const qMap = new Map((qs ?? []).map((q: any) => [q.id, q]));

    // Recompute server-authoritative remaining seconds
    let remaining = session.remaining_seconds;
    if (session.status === "in_progress") {
      const started = new Date(session.started_at).getTime();
      const elapsed = Math.floor((Date.now() - started) / 1000);
      remaining = Math.max(0, session.time_limit_seconds - elapsed);
    }

    return {
      session: { ...session, remaining_seconds: remaining },
      items: (items ?? []).map((it: any) => ({ ...it, question: qMap.get(it.question_id) ?? null })),
    };
  });

// -------- Save an answer / flag --------
export const saveExamAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      session_id: z.string().uuid(),
      item_id: z.string().uuid(),
      answer: z.any().optional(),
      flagged: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Verify ownership + status
    const { data: session } = await supabase.from("exam_sessions").select("*").eq("id", data.session_id).single();
    if (!session || session.student_id !== userId) throw new Error("Not your session");
    if (session.status !== "in_progress") throw new Error("Session no longer accepts answers");

    const update: any = {};
    if (data.answer !== undefined) update.student_answer = data.answer;
    if (data.flagged !== undefined) update.flagged = data.flagged;
    if (Object.keys(update).length) {
      await supabase.from("exam_session_items").update(update).eq("id", data.item_id);
    }

    const started = new Date(session.started_at).getTime();
    const elapsed = Math.floor((Date.now() - started) / 1000);
    const remaining = Math.max(0, session.time_limit_seconds - elapsed);
    await supabase.from("exam_sessions").update({ remaining_seconds: remaining }).eq("id", data.session_id);
    return { remaining_seconds: remaining };
  });

// -------- Grade objective answer (shared grader) --------
function gradeObjective(q: any, answer: any): { correct: boolean; points: number } {
  const g = gradeAnswer(q.type, q.answer_key, answer);
  return { correct: g.correct === true, points: g.score ?? 0 };
}


async function gradeOpenWithAI(q: any, answer: any): Promise<{ points: number; feedback: any }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key || !answer) return { points: 0, feedback: { note: "not graded" } };
  const rubric = q.rubric ?? { criteria: ["accuracy","clarity","completeness"], max: 1 };
  const prompt = `You are grading a Jamaican PEP primary-school student's response.\nQuestion: ${q.stem}\nRubric: ${JSON.stringify(rubric)}\nStudent answer: ${JSON.stringify(answer)}\n\nReturn strict JSON {"score":0..1,"feedback":"..."} where score is the fraction of max points awarded.`;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "openai/gpt-5.5",
        messages: [{ role: "system", content: "You grade primary-school PEP answers. Return only JSON." }, { role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return { points: 0, feedback: { note: `ai_error_${res.status}` } };
    const j: any = await res.json();
    const content = j?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    const score = Math.max(0, Math.min(1, Number(parsed.score ?? 0)));
    return { points: score, feedback: { ai: parsed.feedback ?? "", score } };
  } catch (e) {
    return { points: 0, feedback: { note: "ai_exception" } };
  }
}

// -------- Submit --------
export const submitExamSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ session_id: z.string().uuid(), auto: z.boolean().optional() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: session } = await supabase.from("exam_sessions").select("*, exam_blueprints(*)").eq("id", data.session_id).single();
    if (!session) throw new Error("Session not found");
    if (session.student_id !== userId) throw new Error("Not your session");
    if (session.status !== "in_progress") {
      const { data: existing } = await supabase.from("exam_results").select("*").eq("session_id", data.session_id).maybeSingle();
      return { ok: true, result: existing };
    }

    const { data: items } = await supabase.from("exam_session_items")
      .select("id, question_id, subject, strand, student_answer, points_max")
      .eq("session_id", data.session_id).order("order_index");
    const qIds = (items ?? []).map((i: any) => i.question_id);
    const { data: qs } = await supabase.from("questions").select("id, type, stem, answer_key, rubric, topics(strand, subject)").in("id", qIds);
    const qMap = new Map((qs ?? []).map((q: any) => [q.id, q]));

    let earned = 0;
    let total = 0;
    const subjAgg: Record<string, { earned: number; total: number }> = {};
    const strandAgg: Record<string, { earned: number; total: number; subject: string | null }> = {};

    for (const it of items ?? []) {
      const q = qMap.get(it.question_id) as any;
      if (!q) continue;
      const openTypes = new Set(["short_text","pt_scenario"]);
      let points = 0, correct: boolean | null = null;
      let feedback: any = null;
      if (openTypes.has(q.type)) {
        // A typed answer is checked against the answer key first (instant and
        // deterministic); AI marking is the fallback when no key exists.
        const keyed = keyIsUsable(q.type, q.answer_key) ? gradeAnswer(q.type, q.answer_key, it.student_answer) : null;
        if (keyed && keyed.status !== "unscored") {
          points = keyed.score ?? 0;
          correct = keyed.correct;
          feedback = { source: "answer_key", note: keyed.reason, matched: keyed.matched ?? [] };
        } else {
          const g = await gradeOpenWithAI(q, it.student_answer);
          points = g.points;
          feedback = { source: "ai", ...g.feedback };
          correct = points >= 0.7;
        }
      } else {
        const g = gradeObjective(q, it.student_answer);
        points = g.points;
        correct = g.correct;
      }

      await supabase.from("exam_session_items").update({
        is_correct: correct, points_awarded: points, ai_feedback: feedback,
      }).eq("id", it.id);

      const pmax = Number(it.points_max ?? 1);
      earned += points * pmax;
      total += pmax;
      const subj = it.subject ?? q.topics?.subject ?? "general";
      const strand = it.strand ?? q.topics?.strand ?? "general";
      const sa = subjAgg[subj] ??= { earned: 0, total: 0 };
      sa.earned += points * pmax; sa.total += pmax;
      const sk = `${subj}::${strand}`;
      const st = strandAgg[sk] ??= { earned: 0, total: 0, subject: subj };
      st.earned += points * pmax; st.total += pmax;
    }

    const overallPct = total > 0 ? Math.round((earned / total) * 1000) / 10 : 0;
    const bp = (session as any).exam_blueprints ?? {};
    const cuts: BandCuts = (bp.band_cuts ?? {}) as BandCuts;
    const band = pctToBand(overallPct, cuts);

    const perSubject: Record<string, { pct: number; band: Band }> = {};
    for (const [k, v] of Object.entries(subjAgg)) {
      const pct = v.total ? Math.round((v.earned / v.total) * 1000) / 10 : 0;
      perSubject[k] = { pct, band: pctToBand(pct, cuts) };
    }
    const perStrand: Record<string, { pct: number; subject: string | null }> = {};
    for (const [k, v] of Object.entries(strandAgg)) {
      perStrand[k] = { pct: v.total ? Math.round((v.earned / v.total) * 1000) / 10 : 0, subject: v.subject };
    }

    const timeUsed = Math.max(0, session.time_limit_seconds - session.remaining_seconds);
    await supabase.from("exam_sessions").update({
      status: data.auto ? "expired" : "submitted",
      submitted_at: new Date().toISOString(),
      overall_pct: overallPct,
      overall_band: band,
      remaining_seconds: 0,
    }).eq("id", data.session_id);

    // exam_results is read-only for students under RLS — write it with the
    // privileged server client after the session ownership check above.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error: resultError } = await supabaseAdmin.from("exam_results").upsert({
      session_id: data.session_id,
      per_subject: perSubject,
      per_strand: perStrand,
      overall_pct: overallPct,
      overall_band: band,
      time_used_seconds: timeUsed,
    }, { onConflict: "session_id" }).select().single();
    if (resultError) throw resultError;

    return { ok: true, result };

  });

// -------- History --------
export const listMyExamSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("exam_sessions")
      .select("*, exam_blueprints(item_count, duration_minutes)")
      .eq("student_id", context.userId).order("created_at", { ascending: false }).limit(50);
    return data ?? [];
  });

export const listChildExamSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ child_id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { data: rows } = await context.supabase.from("exam_sessions")
      .select("*, exam_blueprints(item_count, duration_minutes)")
      .eq("student_id", data.child_id).order("created_at", { ascending: false }).limit(50);
    return rows ?? [];
  });

export const getExamResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ session_id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { data: session } = await context.supabase.from("exam_sessions").select("*").eq("id", data.session_id).single();
    const { data: result } = await context.supabase.from("exam_results").select("*").eq("session_id", data.session_id).maybeSingle();
    return { session, result };
  });
