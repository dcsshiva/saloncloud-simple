import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const registerSchema = z.object({
  salonName: z.string().trim().min(2, "Enter your salon name").max(120),
  ownerName: z.string().trim().min(2, "Enter the owner name").max(80),
  mobile: z.string().trim().regex(/^\+?[0-9]{10,15}$/, "Enter a valid mobile number"),
  email: z.string().trim().email("Enter a valid email").max(255),
  address: z.string().trim().min(5, "Enter your salon address").max(400),
  planId: z.string().uuid("Select a subscription plan"),
  amountPaid: z.number().min(0).max(10_000_000),
  screenshotPath: z.string().trim().min(3).max(400),
  otpCode: z.string().trim().regex(/^[0-9]{6}$/, "Enter the 6-digit code"),
});

function slugify(value: string, suffix: string) {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "salon"}-${suffix}`;
}

/** Creates the salon, owner staff record, role and the pending subscription submission. */
export const registerSalon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => registerSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { consumeOtp } = await import("@/lib/otp.server");

    const { data: existing } = await supabaseAdmin
      .from("salons")
      .select("id")
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (existing) throw new Error("You already have a salon registered on this account.");

    await consumeOtp(supabaseAdmin, data.mobile, data.otpCode, "salon_signup");

    const slug = slugify(data.salonName, Math.random().toString(36).slice(2, 8));

    const { data: salon, error: salonError } = await supabaseAdmin
      .from("salons")
      .insert({
        owner_user_id: context.userId,
        salon_name: data.salonName,
        owner_name: data.ownerName,
        mobile_number: data.mobile,
        email: data.email,
        address: data.address,
        slug,
        status: "pending_approval",
      })
      .select("id, slug")
      .single();
    if (salonError || !salon) throw new Error("Could not create your salon. Please try again.");

    await supabaseAdmin.from("salon_staff").insert({
      salon_id: salon.id,
      user_id: context.userId,
      full_name: data.ownerName,
      mobile_number: data.mobile,
      role: "owner",
      can_manage_settings: true,
    });

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "salon_owner" }, { onConflict: "user_id,role" });

    const { error: subError } = await supabaseAdmin.from("salon_subscriptions").insert({
      salon_id: salon.id,
      plan_id: data.planId,
      payment_screenshot_url: data.screenshotPath,
      amount_paid: data.amountPaid,
      approval_status: "pending",
    });
    if (subError) throw new Error("Salon created, but the payment proof could not be saved.");

    // Sensible default opening hours the owner can edit later.
    await supabaseAdmin.from("business_hours").insert(
      Array.from({ length: 7 }, (_, weekday) => ({
        salon_id: salon.id,
        weekday,
        is_open: weekday !== 0,
        open_time: "10:00:00",
        close_time: "20:00:00",
        break_start: "13:00:00",
        break_end: "14:00:00",
      })),
    );

    return { salonId: salon.id as string, slug: salon.slug as string };
  });

/** Owner uploads a new payment screenshot for renewal — creates a pending submission. */
export const submitRenewal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        salonId: z.string().uuid(),
        planId: z.string().uuid(),
        amountPaid: z.number().min(0).max(10_000_000),
        screenshotPath: z.string().trim().min(3).max(400),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: salon, error } = await context.supabase
      .from("salons")
      .select("id")
      .eq("id", data.salonId)
      .maybeSingle();
    if (error || !salon) throw new Error("You cannot submit a renewal for this salon.");

    const { error: insertError } = await context.supabase.from("salon_subscriptions").insert({
      salon_id: data.salonId,
      plan_id: data.planId,
      payment_screenshot_url: data.screenshotPath,
      amount_paid: data.amountPaid,
      approval_status: "pending",
    });
    if (insertError) throw new Error("Could not submit the renewal. Please try again.");
    return { submitted: true };
  });

/** Owner invites an executive: creates the auth user (if needed) and the staff row. */
export const inviteExecutive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        salonId: z.string().uuid(),
        fullName: z.string().trim().min(2).max(80),
        email: z.string().trim().email().max(255),
        mobile: z.string().trim().regex(/^\+?[0-9]{10,15}$/, "Enter a valid mobile number"),
        canManageSettings: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: staff } = await context.supabase
      .from("salon_staff")
      .select("id, role")
      .eq("salon_id", data.salonId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!staff || staff.role !== "owner") throw new Error("Only the salon owner can invite staff.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email);

    let userId = invited?.user?.id;
    if (inviteError || !userId) {
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        email_confirm: true,
        password: crypto.randomUUID(),
      });
      if (createError || !created.user) throw new Error("Could not invite this email address.");
      userId = created.user.id;
    }

    const { error: staffError } = await supabaseAdmin.from("salon_staff").insert({
      salon_id: data.salonId,
      user_id: userId,
      full_name: data.fullName,
      mobile_number: data.mobile,
      role: "executive",
      can_manage_settings: data.canManageSettings,
    });
    if (staffError) throw new Error("That person is already on your team.");

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "executive" }, { onConflict: "user_id,role" });

    return { invited: true };
  });
