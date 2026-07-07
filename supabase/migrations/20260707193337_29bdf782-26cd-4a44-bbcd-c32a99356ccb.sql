
-- Exam engine tables
CREATE TABLE public.exam_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade int NOT NULL CHECK (grade BETWEEN 4 AND 6),
  component pep_component NOT NULL,
  subject subject NULL,
  item_count int NOT NULL DEFAULT 20,
  duration_minutes int NOT NULL DEFAULT 60,
  item_mix jsonb NOT NULL DEFAULT '{}'::jsonb,
  band_cuts jsonb NOT NULL DEFAULT '{"developing":50,"proficient":70,"highly_proficient":85}'::jsonb,
  is_default boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grade, component, subject)
);
GRANT SELECT ON public.exam_blueprints TO authenticated;
GRANT ALL ON public.exam_blueprints TO service_role;
ALTER TABLE public.exam_blueprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blueprints readable by authenticated" ON public.exam_blueprints FOR SELECT TO authenticated USING (true);
CREATE POLICY "blueprints admin write" ON public.exam_blueprints FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER touch_exam_blueprints BEFORE UPDATE ON public.exam_blueprints FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE public.exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blueprint_id uuid NOT NULL REFERENCES public.exam_blueprints(id) ON DELETE RESTRICT,
  grade int NOT NULL,
  component pep_component NOT NULL,
  subject subject NULL,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','expired')),
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  time_limit_seconds int NOT NULL,
  remaining_seconds int NOT NULL,
  overall_pct numeric,
  overall_band proficiency_band,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_sessions TO authenticated;
GRANT ALL ON public.exam_sessions TO service_role;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam_sessions student self" ON public.exam_sessions FOR ALL TO authenticated
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY "exam_sessions parent read" ON public.exam_sessions FOR SELECT TO authenticated
  USING (public.is_parent_of(auth.uid(), student_id));
CREATE POLICY "exam_sessions teacher read" ON public.exam_sessions FOR SELECT TO authenticated
  USING (public.is_teacher_of_student(auth.uid(), student_id));
CREATE POLICY "exam_sessions admin all" ON public.exam_sessions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER touch_exam_sessions BEFORE UPDATE ON public.exam_sessions FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE INDEX exam_sessions_student_idx ON public.exam_sessions(student_id, created_at DESC);

CREATE TABLE public.exam_session_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  order_index int NOT NULL,
  subject subject,
  strand text,
  student_answer jsonb,
  is_correct boolean,
  points_awarded numeric,
  points_max numeric NOT NULL DEFAULT 1,
  flagged boolean NOT NULL DEFAULT false,
  ai_feedback jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, order_index)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_session_items TO authenticated;
GRANT ALL ON public.exam_session_items TO service_role;
ALTER TABLE public.exam_session_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam_items student self" ON public.exam_session_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exam_sessions s WHERE s.id = session_id AND s.student_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.exam_sessions s WHERE s.id = session_id AND s.student_id = auth.uid()));
CREATE POLICY "exam_items parent read" ON public.exam_session_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exam_sessions s WHERE s.id = session_id AND public.is_parent_of(auth.uid(), s.student_id)));
CREATE POLICY "exam_items teacher read" ON public.exam_session_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exam_sessions s WHERE s.id = session_id AND public.is_teacher_of_student(auth.uid(), s.student_id)));
CREATE POLICY "exam_items admin all" ON public.exam_session_items FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER touch_exam_session_items BEFORE UPDATE ON public.exam_session_items FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE INDEX exam_session_items_session_idx ON public.exam_session_items(session_id, order_index);

CREATE TABLE public.exam_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  per_subject jsonb NOT NULL DEFAULT '{}'::jsonb,
  per_strand jsonb NOT NULL DEFAULT '{}'::jsonb,
  overall_pct numeric NOT NULL DEFAULT 0,
  overall_band proficiency_band NOT NULL DEFAULT 'beginning',
  time_used_seconds int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_results TO authenticated;
GRANT ALL ON public.exam_results TO service_role;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam_results student self" ON public.exam_results FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exam_sessions s WHERE s.id = session_id AND s.student_id = auth.uid()));
CREATE POLICY "exam_results parent read" ON public.exam_results FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exam_sessions s WHERE s.id = session_id AND public.is_parent_of(auth.uid(), s.student_id)));
CREATE POLICY "exam_results teacher read" ON public.exam_results FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exam_sessions s WHERE s.id = session_id AND public.is_teacher_of_student(auth.uid(), s.student_id)));
CREATE POLICY "exam_results admin all" ON public.exam_results FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Seed default blueprints for G4/5/6
INSERT INTO public.exam_blueprints (grade, component, subject, item_count, duration_minutes, notes) VALUES
  -- Ability Test (single paper per grade)
  (4, 'AT', NULL, 40, 60, 'Default — pending official MoE spec'),
  (5, 'AT', NULL, 50, 70, 'Default — pending official MoE spec'),
  (6, 'AT', NULL, 60, 75, 'Default — pending official MoE spec'),
  -- Performance Task (integrated, per grade)
  (4, 'PT', NULL, 4, 60, 'Default — pending official MoE spec'),
  (5, 'PT', NULL, 4, 75, 'Default — pending official MoE spec'),
  (6, 'PT', NULL, 4, 90, 'Default — pending official MoE spec'),
  -- CBT per subject per grade
  (4, 'CBT', 'mathematics', 30, 50, 'Default — pending official MoE spec'),
  (5, 'CBT', 'mathematics', 35, 55, 'Default — pending official MoE spec'),
  (6, 'CBT', 'mathematics', 40, 60, 'Default — pending official MoE spec'),
  (4, 'CBT', 'language_arts', 30, 50, 'Default — pending official MoE spec'),
  (5, 'CBT', 'language_arts', 35, 55, 'Default — pending official MoE spec'),
  (6, 'CBT', 'language_arts', 40, 60, 'Default — pending official MoE spec'),
  (4, 'CBT', 'science', 30, 50, 'Default — pending official MoE spec'),
  (5, 'CBT', 'science', 35, 55, 'Default — pending official MoE spec'),
  (6, 'CBT', 'science', 40, 60, 'Default — pending official MoE spec'),
  (4, 'CBT', 'social_studies', 30, 50, 'Default — pending official MoE spec'),
  (5, 'CBT', 'social_studies', 35, 55, 'Default — pending official MoE spec'),
  (6, 'CBT', 'social_studies', 40, 60, 'Default — pending official MoE spec')
ON CONFLICT DO NOTHING;
