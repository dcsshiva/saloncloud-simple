-- ROLES ---------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('super_admin', 'salon_owner', 'executive');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users read own roles" ON public.user_roles
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins manage roles" ON public.user_roles
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- TENANT MEMBERSHIP HELPERS --------------------------------------------
CREATE OR REPLACE FUNCTION public.is_salon_member(_salon_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.salons s WHERE s.id = _salon_id AND s.owner_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.salon_staff st WHERE st.salon_id = _salon_id AND st.user_id = auth.uid() AND st.is_active)
$$;

CREATE OR REPLACE FUNCTION public.is_salon_public(_salon_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.salons s WHERE s.id = _salon_id AND s.status = 'active')
$$;

-- UPDATED_AT ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_salons_updated_at BEFORE UPDATE ON public.salons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- GRANTS ----------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salons TO authenticated;
GRANT SELECT ON public.salons TO anon;
GRANT ALL ON public.salons TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT SELECT ON public.services TO anon;
GRANT ALL ON public.services TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_hours TO authenticated;
GRANT SELECT ON public.business_hours TO anon;
GRANT ALL ON public.business_hours TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.salon_holidays TO authenticated;
GRANT SELECT ON public.salon_holidays TO anon;
GRANT ALL ON public.salon_holidays TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.salon_staff TO authenticated;
GRANT ALL ON public.salon_staff TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT INSERT ON public.appointments TO anon;
GRANT ALL ON public.appointments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.salon_subscriptions TO authenticated;
GRANT ALL ON public.salon_subscriptions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT SELECT ON public.subscription_plans TO anon;
GRANT ALL ON public.subscription_plans TO service_role;

GRANT ALL ON public.otp_verifications TO service_role;

-- RLS -------------------------------------------------------------------
ALTER TABLE public.salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- salons
CREATE POLICY "Public can view active salons" ON public.salons
FOR SELECT TO anon, authenticated USING (status = 'active');
CREATE POLICY "Members view own salon" ON public.salons
FOR SELECT TO authenticated USING (owner_user_id = auth.uid() OR public.is_salon_member(id));
CREATE POLICY "Owners create own salon" ON public.salons
FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Owners update own salon" ON public.salons
FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Super admins manage salons" ON public.salons
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- services
CREATE POLICY "Public view services of active salons" ON public.services
FOR SELECT TO anon, authenticated USING (is_active AND public.is_salon_public(salon_id));
CREATE POLICY "Members manage services" ON public.services
FOR ALL TO authenticated USING (public.is_salon_member(salon_id)) WITH CHECK (public.is_salon_member(salon_id));
CREATE POLICY "Super admins view services" ON public.services
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- business_hours
CREATE POLICY "Public view hours of active salons" ON public.business_hours
FOR SELECT TO anon, authenticated USING (public.is_salon_public(salon_id));
CREATE POLICY "Members manage hours" ON public.business_hours
FOR ALL TO authenticated USING (public.is_salon_member(salon_id)) WITH CHECK (public.is_salon_member(salon_id));

-- holidays
CREATE POLICY "Public view holidays of active salons" ON public.salon_holidays
FOR SELECT TO anon, authenticated USING (public.is_salon_public(salon_id));
CREATE POLICY "Members manage holidays" ON public.salon_holidays
FOR ALL TO authenticated USING (public.is_salon_member(salon_id)) WITH CHECK (public.is_salon_member(salon_id));

-- staff
CREATE POLICY "Members view staff" ON public.salon_staff
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_salon_member(salon_id) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Salon owners manage staff" ON public.salon_staff
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.salons s WHERE s.id = salon_id AND s.owner_user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.salons s WHERE s.id = salon_id AND s.owner_user_id = auth.uid()));

-- appointments
CREATE POLICY "Anyone can request an appointment" ON public.appointments
FOR INSERT TO anon, authenticated WITH CHECK (public.is_salon_public(salon_id));
CREATE POLICY "Members manage appointments" ON public.appointments
FOR ALL TO authenticated USING (public.is_salon_member(salon_id)) WITH CHECK (public.is_salon_member(salon_id));
CREATE POLICY "Super admins view appointments" ON public.appointments
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- notifications
CREATE POLICY "Members manage notifications" ON public.notifications
FOR ALL TO authenticated USING (public.is_salon_member(salon_id)) WITH CHECK (public.is_salon_member(salon_id));

-- subscriptions
CREATE POLICY "Owners view own subscriptions" ON public.salon_subscriptions
FOR SELECT TO authenticated USING (public.is_salon_member(salon_id));
CREATE POLICY "Owners create own subscriptions" ON public.salon_subscriptions
FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.salons s WHERE s.id = salon_id AND s.owner_user_id = auth.uid()));
CREATE POLICY "Super admins manage subscriptions" ON public.salon_subscriptions
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- plans
CREATE POLICY "Anyone views active plans" ON public.subscription_plans
FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins manage plans" ON public.subscription_plans
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- otp_verifications: server-side only, no anon/authenticated access
CREATE POLICY "Super admins view otps" ON public.otp_verifications
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));