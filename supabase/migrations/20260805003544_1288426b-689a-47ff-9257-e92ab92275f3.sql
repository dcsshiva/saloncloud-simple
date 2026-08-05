DROP POLICY IF EXISTS "Anyone can request an appointment" ON public.appointments;
DROP POLICY IF EXISTS "Public view hours of active salons" ON public.business_hours;
DROP POLICY IF EXISTS "Public view holidays of active salons" ON public.salon_holidays;
DROP POLICY IF EXISTS "Public view services of active salons" ON public.services;