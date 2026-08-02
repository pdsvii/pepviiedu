-- 1) Remove unverified self-enrollment into classes
DROP POLICY IF EXISTS cm_insert_self_by_code ON public.class_members;

-- Server-verified join flow: requires the class's real join code
CREATE OR REPLACE FUNCTION public.join_class_by_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_class_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_role(v_uid, 'student'::public.app_role) THEN
    RAISE EXCEPTION 'Only students can join a class';
  END IF;

  IF _code IS NULL OR length(btrim(_code)) < 4 THEN
    RAISE EXCEPTION 'Invalid join code';
  END IF;

  SELECT id INTO v_class_id
  FROM public.classes
  WHERE upper(join_code) = upper(btrim(_code))
  LIMIT 1;

  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'Invalid join code';
  END IF;

  INSERT INTO public.class_members (class_id, student_id)
  VALUES (v_class_id, v_uid)
  ON CONFLICT DO NOTHING;

  RETURN v_class_id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_class_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_class_by_code(text) TO authenticated;

-- 2) Remove unverified parent-child self-linking
DROP POLICY IF EXISTS pc_insert_parent ON public.parent_child;
REVOKE INSERT ON public.parent_child FROM authenticated;