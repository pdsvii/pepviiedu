
-- Fix search_path on trigger
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Restrict execute on SECURITY DEFINER helpers to authenticated only
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_parent_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_teacher_of_student(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_parent_of(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_student(uuid, uuid) TO authenticated, service_role;
