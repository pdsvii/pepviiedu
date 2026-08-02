-- 1) Fix tautology in assignments read policies
DROP POLICY IF EXISTS assign_student_read ON public.assignments;
DROP POLICY IF EXISTS assign_parent_read ON public.assignments;

CREATE POLICY assign_student_read ON public.assignments
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.class_members cm
  WHERE cm.class_id = assignments.class_id
    AND cm.student_id = auth.uid()
));

CREATE POLICY assign_parent_read ON public.assignments
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.class_members cm
  WHERE cm.class_id = assignments.class_id
    AND public.is_parent_of(auth.uid(), cm.student_id)
));

-- 2) Lock down SECURITY DEFINER function execution
-- Trigger-only functions: no direct callers at all
REVOKE ALL ON FUNCTION public.grant_admin_from_allowlist() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Authorization helpers: signed-in users only (needed for RLS evaluation + app checks)
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_parent_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_teacher_of_student(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_parent_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_student(uuid, uuid) TO authenticated;