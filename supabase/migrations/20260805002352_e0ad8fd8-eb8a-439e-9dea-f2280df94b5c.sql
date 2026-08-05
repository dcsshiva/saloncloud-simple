REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_salon_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_salon_public(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_salon_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_salon_public(uuid) TO anon, authenticated, service_role;