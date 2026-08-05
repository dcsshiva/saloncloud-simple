DROP POLICY "Anyone views active plans" ON public.subscription_plans;
CREATE POLICY "Anyone views active plans" ON public.subscription_plans
FOR SELECT TO anon, authenticated USING (is_active);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_salon_member(uuid) FROM anon;