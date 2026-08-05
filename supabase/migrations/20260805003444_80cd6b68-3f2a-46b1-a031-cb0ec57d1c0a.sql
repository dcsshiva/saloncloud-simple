-- 1. Salons: slug + timezone
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kolkata';

UPDATE public.salons
SET slug = regexp_replace(lower(salon_name), '[^a-z0-9]+', '-', 'g') || '-' || substr(id::text, 1, 6)
WHERE slug IS NULL;

ALTER TABLE public.salons ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS salons_slug_key ON public.salons (slug);

-- 2. Staff permissions
ALTER TABLE public.salon_staff ADD COLUMN IF NOT EXISTS can_manage_settings boolean NOT NULL DEFAULT false;
UPDATE public.salon_staff SET can_manage_settings = true WHERE role = 'owner';

-- 3. Appointments: booking reference + slot locking
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS booking_reference text NOT NULL
  DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

CREATE UNIQUE INDEX IF NOT EXISTS appointments_slot_lock
  ON public.appointments (salon_id, appointment_date, slot_start_time)
  WHERE status IN ('pending_approval', 'approved', 'completed');

-- 4. Public read access for the customer booking page
DROP POLICY IF EXISTS "Public can view active salons" ON public.salons;
CREATE POLICY "Public can view active salons" ON public.salons
  FOR SELECT TO anon, authenticated USING (status = 'active');

DROP POLICY IF EXISTS "Public can view services of active salons" ON public.services;
CREATE POLICY "Public can view services of active salons" ON public.services
  FOR SELECT TO anon, authenticated
  USING (is_active AND public.is_salon_public(salon_id));

DROP POLICY IF EXISTS "Public can view business hours of active salons" ON public.business_hours;
CREATE POLICY "Public can view business hours of active salons" ON public.business_hours
  FOR SELECT TO anon, authenticated
  USING (public.is_salon_public(salon_id));

DROP POLICY IF EXISTS "Public can view holidays of active salons" ON public.salon_holidays;
CREATE POLICY "Public can view holidays of active salons" ON public.salon_holidays
  FOR SELECT TO anon, authenticated
  USING (public.is_salon_public(salon_id));

-- 5. Safe public lookups
CREATE OR REPLACE FUNCTION public.get_taken_slots(_salon_id uuid, _date date)
RETURNS TABLE (slot_start_time time, slot_end_time time)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.slot_start_time, a.slot_end_time
  FROM public.appointments a
  WHERE a.salon_id = _salon_id
    AND a.appointment_date = _date
    AND a.status IN ('pending_approval', 'approved', 'completed');
$$;

REVOKE ALL ON FUNCTION public.get_taken_slots(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_taken_slots(uuid, date) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.lookup_bookings(_mobile text, _reference text)
RETURNS TABLE (
  booking_reference text,
  salon_name text,
  service_name text,
  appointment_date date,
  slot_start_time time,
  status text,
  decline_reason text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.booking_reference, s.salon_name, sv.service_name,
         a.appointment_date, a.slot_start_time, a.status, a.decline_reason
  FROM public.appointments a
  JOIN public.salons s ON s.id = a.salon_id
  JOIN public.services sv ON sv.id = a.service_id
  WHERE a.customer_mobile = _mobile
    AND upper(right(a.booking_reference, 4)) = upper(_reference)
  ORDER BY a.appointment_date DESC, a.slot_start_time DESC
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.lookup_bookings(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_bookings(text, text) TO anon, authenticated, service_role;

-- 6. Notify the salon on new booking requests
CREATE OR REPLACE FUNCTION public.notify_new_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (salon_id, appointment_id, title, body)
  VALUES (
    NEW.salon_id,
    NEW.id,
    'New booking request',
    NEW.customer_name || ' requested ' || to_char(NEW.slot_start_time, 'HH12:MI AM') ||
      ' on ' || to_char(NEW.appointment_date, 'DD Mon YYYY')
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_new_appointment() FROM PUBLIC;

DROP TRIGGER IF EXISTS appointments_notify_insert ON public.appointments;
CREATE TRIGGER appointments_notify_insert
AFTER INSERT ON public.appointments
FOR EACH ROW
WHEN (NEW.status = 'pending_approval')
EXECUTE FUNCTION public.notify_new_appointment();

-- 7. Realtime
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;