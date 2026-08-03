ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tester';

CREATE OR REPLACE FUNCTION public.is_tester(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'tester'
  )
$$;

REVOKE ALL ON FUNCTION public.is_tester(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tester(uuid) TO authenticated;

CREATE TABLE public.review_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
  area text NOT NULL DEFAULT 'general',
  route text,
  category text NOT NULL DEFAULT 'content',
  severity text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  body text NOT NULL,
  suggested_fix text,
  status text NOT NULL DEFAULT 'open',
  admin_response text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX review_notes_question_idx ON public.review_notes (question_id);
CREATE INDEX review_notes_author_idx ON public.review_notes (author_id);
CREATE INDEX review_notes_status_idx ON public.review_notes (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_notes TO authenticated;
GRANT ALL ON public.review_notes TO service_role;

ALTER TABLE public.review_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Testers and admins can add review notes"
ON public.review_notes FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (public.is_tester(auth.uid()) OR public.is_admin(auth.uid()))
);

CREATE POLICY "Authors and admins can read review notes"
ON public.review_notes FOR SELECT TO authenticated
USING (author_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Authors can edit their open notes"
ON public.review_notes FOR UPDATE TO authenticated
USING (author_id = auth.uid() AND status = 'open')
WITH CHECK (author_id = auth.uid());

CREATE POLICY "Admins can update any review note"
ON public.review_notes FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Authors and admins can delete review notes"
ON public.review_notes FOR DELETE TO authenticated
USING ((author_id = auth.uid() AND status = 'open') OR public.is_admin(auth.uid()));

CREATE TRIGGER review_notes_touch_updated_at
BEFORE UPDATE ON public.review_notes
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE OR REPLACE FUNCTION public.validate_review_note()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.category NOT IN ('content','answer_key','wording','layout','bug','suggestion','accessibility','curriculum_alignment') THEN
    RAISE EXCEPTION 'Invalid category';
  END IF;
  IF NEW.severity NOT IN ('low','medium','high','blocker') THEN
    RAISE EXCEPTION 'Invalid severity';
  END IF;
  IF NEW.status NOT IN ('open','acknowledged','in_progress','fixed','wont_fix') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  IF length(btrim(NEW.title)) < 3 THEN
    RAISE EXCEPTION 'Title is too short';
  END IF;
  IF length(btrim(NEW.body)) < 5 THEN
    RAISE EXCEPTION 'Note is too short';
  END IF;
  IF NEW.status IN ('fixed','wont_fix') AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER review_notes_validate
BEFORE INSERT OR UPDATE ON public.review_notes
FOR EACH ROW EXECUTE FUNCTION public.validate_review_note();