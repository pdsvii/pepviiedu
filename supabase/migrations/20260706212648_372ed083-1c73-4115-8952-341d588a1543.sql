
-- Enums
CREATE TYPE public.app_role AS ENUM ('student','parent','teacher');
CREATE TYPE public.subject AS ENUM ('mathematics','language_arts','science','social_studies');
CREATE TYPE public.pep_component AS ENUM ('AT','CBT','PT');
CREATE TYPE public.question_type AS ENUM ('mc','multi','tf','numeric','matching','ordering','short_text','pt_scenario');
CREATE TYPE public.proficiency_band AS ENUM ('beginning','developing','proficient','highly_proficient');

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar TEXT,
  grade INT CHECK (grade IN (4,5,6)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

-- parent_child
CREATE TABLE public.parent_child (
  parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_id, child_id)
);
GRANT SELECT, INSERT, DELETE ON public.parent_child TO authenticated;
GRANT ALL ON public.parent_child TO service_role;
ALTER TABLE public.parent_child ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_parent_of(_parent uuid, _child uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.parent_child WHERE parent_id=_parent AND child_id=_child)
$$;

-- classes
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade INT NOT NULL CHECK (grade IN (4,5,6)),
  join_code TEXT UNIQUE NOT NULL DEFAULT upper(substr(md5(random()::text),1,6)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.class_members (
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, student_id)
);
GRANT SELECT, INSERT, DELETE ON public.class_members TO authenticated;
GRANT ALL ON public.class_members TO service_role;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_teacher_of_student(_teacher uuid, _student uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_members cm
    JOIN public.classes c ON c.id=cm.class_id
    WHERE c.teacher_id=_teacher AND cm.student_id=_student
  )
$$;

-- passages
CREATE TABLE public.passages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  body TEXT NOT NULL,
  subject public.subject,
  grade INT
);
GRANT SELECT ON public.passages TO authenticated, anon;
GRANT ALL ON public.passages TO service_role;
ALTER TABLE public.passages ENABLE ROW LEVEL SECURITY;

-- topics
CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject public.subject NOT NULL,
  grade INT NOT NULL CHECK (grade IN (4,5,6)),
  component public.pep_component NOT NULL,
  name TEXT NOT NULL,
  strand TEXT
);
GRANT SELECT ON public.topics TO authenticated, anon;
GRANT ALL ON public.topics TO service_role;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

-- questions
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  passage_id UUID REFERENCES public.passages(id) ON DELETE SET NULL,
  type public.question_type NOT NULL,
  stem TEXT NOT NULL,
  media TEXT,
  options JSONB,
  answer_key JSONB,
  rubric JSONB,
  difficulty INT NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 5),
  explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- assignments
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.assignment_questions (
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  PRIMARY KEY (assignment_id, question_id)
);
GRANT SELECT, INSERT, DELETE ON public.assignment_questions TO authenticated;
GRANT ALL ON public.assignment_questions TO service_role;
ALTER TABLE public.assignment_questions ENABLE ROW LEVEL SECURITY;

-- attempts
CREATE TABLE public.attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE SET NULL,
  subject public.subject,
  grade INT,
  component public.pep_component,
  score NUMERIC,
  band public.proficiency_band,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attempts TO authenticated;
GRANT ALL ON public.attempts TO service_role;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.attempt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  response JSONB,
  correct BOOLEAN,
  score NUMERIC,
  ai_feedback TEXT,
  teacher_override NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attempt_answers TO authenticated;
GRANT ALL ON public.attempt_answers TO service_role;
ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;

-- rewards
CREATE TABLE public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label TEXT,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.rewards TO authenticated;
GRANT ALL ON public.rewards TO service_role;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- profiles: users see own; parents see children; teachers see students in their classes; all authed can read basic profile of visible users
CREATE POLICY "profiles_select_self" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_select_parent" ON public.profiles FOR SELECT TO authenticated USING (public.is_parent_of(auth.uid(), id));
CREATE POLICY "profiles_select_teacher" ON public.profiles FOR SELECT TO authenticated USING (public.is_teacher_of_student(auth.uid(), id));
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_parent" ON public.profiles FOR UPDATE TO authenticated USING (public.is_parent_of(auth.uid(), id)) WITH CHECK (public.is_parent_of(auth.uid(), id));
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- user_roles: users read own
CREATE POLICY "user_roles_select_self" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_roles_select_parent" ON public.user_roles FOR SELECT TO authenticated USING (public.is_parent_of(auth.uid(), user_id));

-- parent_child: parents manage their own links
CREATE POLICY "pc_select_parent" ON public.parent_child FOR SELECT TO authenticated USING (parent_id = auth.uid() OR child_id = auth.uid());
CREATE POLICY "pc_insert_parent" ON public.parent_child FOR INSERT TO authenticated WITH CHECK (parent_id = auth.uid() AND public.has_role(auth.uid(),'parent'));
CREATE POLICY "pc_delete_parent" ON public.parent_child FOR DELETE TO authenticated USING (parent_id = auth.uid());

-- classes: teacher manages own; students see classes they belong to
CREATE POLICY "classes_teacher_all" ON public.classes FOR ALL TO authenticated USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid() AND public.has_role(auth.uid(),'teacher'));
CREATE POLICY "classes_select_member" ON public.classes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.class_members cm WHERE cm.class_id = id AND cm.student_id = auth.uid()));
CREATE POLICY "classes_select_parent_of_member" ON public.classes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.class_members cm WHERE cm.class_id = id AND public.is_parent_of(auth.uid(), cm.student_id)));

-- class_members: teacher of class manages; student sees own memberships
CREATE POLICY "cm_teacher_all" ON public.class_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.teacher_id = auth.uid()));
CREATE POLICY "cm_select_self" ON public.class_members FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "cm_select_parent" ON public.class_members FOR SELECT TO authenticated USING (public.is_parent_of(auth.uid(), student_id));
CREATE POLICY "cm_insert_self_by_code" ON public.class_members FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

-- passages / topics / questions: all authed can read
CREATE POLICY "passages_read_all" ON public.passages FOR SELECT TO authenticated USING (true);
CREATE POLICY "topics_read_all" ON public.topics FOR SELECT TO authenticated USING (true);
CREATE POLICY "questions_read_all" ON public.questions FOR SELECT TO authenticated USING (true);

-- assignments: teacher owns; students in class can view; parents of members can view
CREATE POLICY "assign_teacher_all" ON public.assignments FOR ALL TO authenticated USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "assign_student_read" ON public.assignments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.class_members cm WHERE cm.class_id = class_id AND cm.student_id = auth.uid()));
CREATE POLICY "assign_parent_read" ON public.assignments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.class_members cm WHERE cm.class_id = class_id AND public.is_parent_of(auth.uid(), cm.student_id)));

CREATE POLICY "aq_teacher_all" ON public.assignment_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND a.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND a.teacher_id = auth.uid()));
CREATE POLICY "aq_student_read" ON public.assignment_questions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.assignments a JOIN public.class_members cm ON cm.class_id = a.class_id WHERE a.id = assignment_id AND cm.student_id = auth.uid())
);

-- attempts: student owns; parent of student sees; teacher of student sees
CREATE POLICY "attempts_student_all" ON public.attempts FOR ALL TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY "attempts_parent_read" ON public.attempts FOR SELECT TO authenticated USING (public.is_parent_of(auth.uid(), student_id));
CREATE POLICY "attempts_teacher_read" ON public.attempts FOR SELECT TO authenticated USING (public.is_teacher_of_student(auth.uid(), student_id));

CREATE POLICY "answers_student_all" ON public.attempt_answers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.attempts a WHERE a.id = attempt_id AND a.student_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.attempts a WHERE a.id = attempt_id AND a.student_id = auth.uid()));
CREATE POLICY "answers_parent_read" ON public.attempt_answers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.attempts a WHERE a.id = attempt_id AND public.is_parent_of(auth.uid(), a.student_id))
);
CREATE POLICY "answers_teacher_read" ON public.attempt_answers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.attempts a WHERE a.id = attempt_id AND public.is_teacher_of_student(auth.uid(), a.student_id))
);
CREATE POLICY "answers_teacher_override" ON public.attempt_answers FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.attempts a WHERE a.id = attempt_id AND public.is_teacher_of_student(auth.uid(), a.student_id))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.attempts a WHERE a.id = attempt_id AND public.is_teacher_of_student(auth.uid(), a.student_id))
);

-- rewards
CREATE POLICY "rewards_student_all" ON public.rewards FOR ALL TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY "rewards_parent_read" ON public.rewards FOR SELECT TO authenticated USING (public.is_parent_of(auth.uid(), student_id));
CREATE POLICY "rewards_teacher_read" ON public.rewards FOR SELECT TO authenticated USING (public.is_teacher_of_student(auth.uid(), student_id));

-- updated_at trigger for profiles
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_touch_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
