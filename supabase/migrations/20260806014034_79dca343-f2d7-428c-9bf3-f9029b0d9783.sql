ALTER TABLE public.subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_billing_cycle_check;
ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_billing_cycle_check CHECK (billing_cycle = ANY (ARRAY['trial','monthly','annual','manual']));

CREATE UNIQUE INDEX IF NOT EXISTS subscription_plans_single_trial ON public.subscription_plans (billing_cycle) WHERE billing_cycle = 'trial';

INSERT INTO public.subscription_plans (plan_name, billing_cycle, price, duration_days, is_active)
VALUES ('Free Trial', 'trial', 0, 30, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.subscription_plans (plan_name, billing_cycle, price, duration_days, is_active)
SELECT 'Monthly', 'monthly', 200, 30, true
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE billing_cycle = 'monthly');

INSERT INTO public.subscription_plans (plan_name, billing_cycle, price, duration_days, is_active)
SELECT 'Annual', 'annual', 2000, 365, true
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE billing_cycle = 'annual');

ALTER TABLE public.salons ALTER COLUMN owner_user_id DROP NOT NULL;
ALTER TABLE public.salon_subscriptions ALTER COLUMN payment_screenshot_url DROP NOT NULL;