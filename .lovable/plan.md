
# viiVision PEP — Build Plan

A full-stack PEP prep app for Jamaican primary students, parents, and teachers, built on TanStack Start + Lovable Cloud (Supabase) with the pastel Jamaican palette.

## 1. Foundation

- Enable **Lovable Cloud** (Supabase-powered auth, Postgres, edge functions).
- Set up the design system in `src/styles.css` with the pastel palette (mint `#A8D5BA`, deeper green `#7CB79A`, cream gold `#F5E1A4`, charcoal `#3A3A3A`, off-white `#FBFBF7`, leaf `#B8E0C2`, apricot `#F6C79A`) as OKLCH semantic tokens. Load Nunito via a `<link>` in `__root.tsx`.
- Two visual modes via a `.student` scope class: student = rounder radii, larger type, playful; parent/teacher = tighter, more neutral, same tokens.
- Update `__root.tsx` head: title "viiVision PEP — Jamaica Primary Exit Profile Practice", proper description/OG.

## 2. Data Model (Supabase)

Roles are stored in a separate `user_roles` table with `has_role()` security-definer function (never on profiles).

Tables:
- `profiles` (id → auth.users, full_name, avatar, role_hint)
- `app_role` enum: `student | parent | teacher`
- `user_roles` (user_id, role)
- `parent_child` (parent_id, child_id) — links parent accounts to student accounts they created
- `classes` (id, teacher_id, name, grade)
- `class_members` (class_id, student_id)
- `subjects` enum: `mathematics | language_arts | science | social_studies`
- `pep_component` enum: `AT | CBT | PT`
- `topics` (id, subject, grade, component, name, strand)
- `questions` (id, topic_id, type, stem, media, options jsonb, answer_key jsonb, rubric jsonb, difficulty, explanation, passage_id nullable)
- `passages` (id, title, body, subject, grade) — for passage-based sets
- `question_type` enum: `mc | multi | tf | numeric | matching | ordering | short_text | pt_scenario`
- `assignments` (id, teacher_id, class_id, title, due_at, component filter, topic filter)
- `assignment_questions` (assignment_id, question_id, order)
- `attempts` (id, student_id, assignment_id nullable, started_at, finished_at, band)
- `attempt_answers` (attempt_id, question_id, response jsonb, correct, score, ai_feedback, teacher_override)
- `proficiency_bands` derived view: mapping score → `beginning | developing | proficient | highly_proficient`
- `rewards` (student_id, kind, earned_at) — badges/streaks

All tables: explicit `GRANT`s to `authenticated` + `service_role`, RLS enabled, policies scoped via `has_role()` and ownership (`auth.uid()`), plus parent→child access via `parent_child`.

## 3. Auth & Role Flows

- Landing page explains the app + Sign in / Sign up (Parent or Teacher only; students cannot self-register).
- Email/password auth (+ Google OAuth via Lovable broker).
- Signup selects role (parent | teacher) → assigns role in `user_roles`, creates profile via trigger.
- Parent dashboard has "Add child" flow: creates a new auth user (via edge function using service role) with a parent-set password, links `parent_child`, assigns `student` role.
- Route gating via managed `_authenticated/` layout, then role-specific pathless layouts: `_authenticated/_student`, `_authenticated/_parent`, `_authenticated/_teacher`, each `beforeLoad` checks `has_role` and redirects otherwise. Root route routes signed-in users to the right dashboard.

## 4. Student Experience (`/student/*`)

- Playful home: avatar, streak, current level, "Practice", "My Rewards", "Assignments from teacher".
- **Practice session flow**: choose subject → grade (pinned to profile) → component (AT/CBT, PT if enabled) → topic (or "mixed"). Present questions one at a time with the right renderer per type (MC, multi, T/F, numeric entry, drag-and-drop matching/ordering, short text, passage-set, PT scenario). Instant feedback + worked explanation after each answer. Progress ring during session.
- **Results screen**: band badge (Beginning → Highly Proficient), stars, encouraging copy, topics to keep practicing. **Never** shows raw percentages.
- Rewards page: badges + streaks.

## 5. Parent Experience (`/parent/*`)

- Children list, add child, reset child password, edit child profile, consent toggle.
- Per-child progress summary by subject with band chips + recent activity. No authoring.

## 6. Teacher Experience (`/teacher/*`)

- Classes list, create class, add students by email (must already be student accounts) or generate join code.
- Create Assignment: pick class, filter by subject/grade/component/topic, select questions from bank, set due date.
- Analytics: topic × student heatmap (band-colored), class summary, drill-down to individual report (printable via `window.print` styles), CSV export.
- Manual score override on open/PT responses.

## 7. Scoring

- Auto-score MC / multi / T/F / numeric / matching / ordering in a server function on submit.
- Short-text and PT scenarios: edge function calling Lovable AI (`openai/gpt-5.5`) with rubric → returns score + qualitative feedback; teacher can override.
- Band mapping (configurable thresholds; defaults 0–49 Beginning, 50–69 Developing, 70–84 Proficient, 85–100 Highly Proficient) — used server-side; students only see the band name/badge.

## 8. Seeded Starter Bank

Seed via migration: a couple of topics per subject × grade (4/5/6) × AT and CBT components, ~5–8 questions each, plus 2 sample PT scenarios. Every question has a worked explanation. Content is original PEP-style, not past papers.

## 9. Server Functions & Routes

- `src/lib/practice.functions.ts` — start session, submit answer, finish session (auto-score + band).
- `src/lib/parent.functions.ts` — create child (service-role via `.server.ts`), list children, reset child password.
- `src/lib/teacher.functions.ts` — classes, assignments, analytics queries.
- `src/lib/ai-score.functions.ts` — AI scoring for open responses via Lovable AI.

All authenticated fns use `requireSupabaseAuth`; privileged operations verify role with `has_role` before loading `client.server`.

## 10. Out of scope for this first pass

- Live class sessions, chat, video, offline mode, payments, i18n, dark mode toggle.
- Real past-paper content.

## Technical notes

- TanStack Start file-based routes under `src/routes/`; no `src/pages/`.
- Route tree: `/`, `/auth`, `/reset-password`, `_authenticated/_student/*`, `_authenticated/_parent/*`, `_authenticated/_teacher/*`.
- All colors as semantic tokens; no hardcoded hex in components. Two font pairings: Nunito (student) and Nunito + system for parent/teacher (same family, tighter tracking).
- `sitemap.xml` + `robots.txt` added at end of scaffolding for the public routes (`/`, `/auth`).

## Assumptions (please correct any)

1. Students can log in themselves (with credentials created by their parent), rather than being surfaced only through a parent-shared device.
2. Google OAuth is fine for parents/teachers; students use email + password only.
3. Band thresholds above are placeholders until you provide official cut points.
4. PT toggle is a global admin setting stored in a `settings` row (defaulting to ON); teachers see it but cannot toggle it.
