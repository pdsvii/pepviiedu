
-- 1. Extend the role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

-- 2. is_admin helper (avoids referencing the new enum literal via a text cast at query time)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'admin'
  )
$$;

-- 3. Admin allowlist: emails that automatically get the admin role on signup / password reset.
CREATE TABLE public.admin_allowlist (
  email text PRIMARY KEY,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_allowlist TO authenticated;
GRANT ALL ON public.admin_allowlist TO service_role;
ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allowlist_admin_all" ON public.admin_allowlist FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 4. Schools
CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parish text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schools_read_authenticated" ON public.schools FOR SELECT TO authenticated USING (true);
CREATE POLICY "schools_admin_write" ON public.schools FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER schools_touch_updated BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL;

-- 5. Exam settings (per year)
CREATE TABLE public.exam_settings (
  year int PRIMARY KEY,
  performance_task_enabled boolean NOT NULL DEFAULT true,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exam_settings TO authenticated;
GRANT ALL ON public.exam_settings TO service_role;
ALTER TABLE public.exam_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam_settings_read_all" ON public.exam_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "exam_settings_admin_write" ON public.exam_settings FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER exam_settings_touch_updated BEFORE UPDATE ON public.exam_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Default rows
INSERT INTO public.exam_settings(year, performance_task_enabled)
VALUES (2026, true), (2027, true) ON CONFLICT DO NOTHING;

-- 6. Profiles: disable-account flag
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false;

-- 7. Admin blanket policies on core tables (managed content + all user data reads)
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "topics_admin_write" ON public.topics FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "passages_admin_write" ON public.passages FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "questions_admin_write" ON public.questions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "classes_admin_all" ON public.classes FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "class_members_admin_all" ON public.class_members FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "parent_child_admin_all" ON public.parent_child FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "assignments_admin_all" ON public.assignments FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "aq_admin_all" ON public.assignment_questions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "attempts_admin_read" ON public.attempts FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "answers_admin_read" ON public.attempt_answers FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "rewards_admin_read" ON public.rewards FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- 8. Auto-grant admin role for allowlisted emails on signup / email confirmation
CREATE OR REPLACE FUNCTION public.grant_admin_from_allowlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(NEW.email);
BEGIN
  IF v_email IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.admin_allowlist WHERE lower(email) = v_email) THEN
    INSERT INTO public.profiles(id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_roles(user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_from_allowlist();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_admin ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_admin
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_admin_from_allowlist();

-- 9. Seed the first admin email
INSERT INTO public.admin_allowlist(email, note)
VALUES ('philip.salmon@live.com', 'Initial platform admin')
ON CONFLICT (email) DO NOTHING;
