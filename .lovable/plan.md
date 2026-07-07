
# Exam Engine — Timed PEP Mock Exams

Additive mode alongside existing Practice. Four new tables, admin-editable blueprints, AI-generated PEP-aligned items, timed exam UI with auto-submit, per-band results, and role-scoped access.

## 1. Data model (new migration)

New tables (all with GRANT + RLS):

- `exam_blueprints` — `(grade, component, subject nullable)` unique; `item_count`, `duration_minutes`, `item_mix jsonb`, `band_cuts jsonb` (`{beginning, developing, proficient, highly_proficient}` as % thresholds), `is_default bool`. Admin write, everyone-authenticated read.
- `exam_sessions` — `student_id`, `grade`, `component`, `subject nullable`, `blueprint_id`, `status` (`in_progress|submitted|expired`), `started_at`, `submitted_at`, `time_limit_seconds`, `remaining_seconds`, `overall_pct`, `overall_band`. RLS: student self, parent-of, teacher-of (via existing helpers), admin.
- `exam_session_items` — `session_id`, `question_id`, `order_index`, `subject`, `strand`, `student_answer jsonb`, `is_correct`, `points_awarded numeric`, `points_max numeric`, `flagged bool`, `ai_feedback jsonb nullable`. RLS mirrors session.
- `exam_results` — `session_id` unique, `per_subject jsonb`, `per_strand jsonb`, `overall_pct`, `overall_band`, `time_used_seconds`, `created_at`. RLS mirrors session.

Extend `questions` (if not already present): ensure columns for `component` (AT/CBT/PT), `item_type` (mc/multi/numeric/short/constructed/reasoning/pt_scenario), `strand`, `grade`, `subject`, `difficulty`, `points`, `rubric jsonb nullable`, `stimulus_id nullable` (for PT scenario groups).

Seed default blueprints for G4/G5/G6 × {AT, CBT-per-subject, PT}. Placeholder counts/durations per spec; flagged as defaults.

## 2. Server functions

`src/lib/exam.functions.ts`:
- `listBlueprints`, `startExamSession({grade, component, subject?})` — snapshots items from bank by blueprint mix
- `getExamSession({session_id})` — returns session + items (WITHOUT answer keys)
- `saveAnswer({session_id, item_id, answer, flagged})` — updates `remaining_seconds`
- `submitExamSession({session_id})` — auto-grades objective, AI-grades open items via Lovable AI (`openai/gpt-5.5`) against rubric, computes per-subject/strand + band, writes `exam_results`
- `listMyExamHistory`, `getExamResult({session_id})`
- Parent/Teacher/Admin variants: `listChildExamResults`, `listClassExamResults`, `assignExamToClass`

`src/lib/admin.functions.ts` additions:
- `upsertBlueprint`, `deleteBlueprint`, `generateExamItems({grade, subject, component, strand?, count})` — Lovable AI generates PEP-aligned items with answer keys/rubrics, inserts into `questions`

Teacher assignment reuses existing `assignments` table with a new `kind='exam'` + `blueprint_id`.

## 3. Student UI

- New route `_authenticated/student/exams/index.tsx` — grade→component→(subject) picker, list resumable sessions
- `_authenticated/student/exams/session.$sessionId.tsx` — full-screen exam mode:
  - Overall countdown header, per-section timer when multi-subject
  - One question at a time, prev/next, flag toggle, review grid sidebar
  - Auto-save on answer change and every 15s (updates `remaining_seconds`)
  - Auto-submit when timer hits 0 (client + server-side re-check)
  - **No feedback shown during exam**
- `_authenticated/student/exams/result.$sessionId.tsx` — bands per subject, overall band card, strand strengths/weaknesses, answer review with correct answers + AI feedback

Add "Mock Exams" nav entry on student dashboard alongside Practice.

## 4. Parent UI

- On `parent/child.$childId.tsx`, add "Mock Exams" tab: toggle-enable per component, view child's exam history + result reports.

## 5. Teacher UI

- New `teacher/exams.tsx`: assign a mock to a class, view class results table + reuse existing heatmap component filtered to exam attempts.

## 6. Admin UI

- New `admin/blueprints.tsx`: CRUD blueprints — item_count, duration_minutes, item_mix, band_cuts.
- New `admin/generate-items.tsx`: form (grade/subject/component/strand/count) → calls `generateExamItems` → preview → save to bank.
- Link both from admin dashboard.

## 7. AI grading + generation

Use existing Lovable AI Gateway pattern (`src/lib/ai-gateway.server.ts` if present, else create). Model: `openai/gpt-5.5`. Structured output (Zod) for both generation and grading. Rubric-driven scoring for constructed responses; store rationale in `ai_feedback` (teachers can override later — reuse existing attempt override path if present, otherwise add a light `teacherOverrideResultItem` fn).

## 8. Theming

Reuse pastel Jamaican tokens, `BandBadge`, and existing shell. Exam mode uses a tighter focus layout (dimmed nav, prominent timer) but same tokens.

## Scope guardrails

- Practice mode, existing routes, auth, and domain remain untouched.
- Blueprint numbers seeded as editable defaults with a UI note "Pending official MoE spec".
- All new public tables get GRANT + RLS in the same migration.

## Technical notes

- Timer authority is server-side: `remaining_seconds` recomputed from `started_at + time_limit_seconds - now()` on every save; client clock is display only.
- Item snapshot at start prevents bank edits from changing an in-progress exam.
- AI grading runs inside `submitExamSession` handler; failure falls back to `needs_review` state so submission never blocks.
- All protected exam server fns use `requireSupabaseAuth`; admin fns gated by `is_admin`.
