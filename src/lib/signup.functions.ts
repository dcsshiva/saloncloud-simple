import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const codeSchema = z.string().trim().regex(/^[0-9]{4}$/, "Enter the 4-digit code");
const PURPOSE = "salon_signup_email";

function slugify(value: string, suffix: string) {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "salon"}-${suffix}`;
}

/** Emails a 4-digit verification code to the salon owner's email address. */
export const sendSignupOtp = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; salonName?: string }) =>
    z.object({ email: emailSchema, salonName: z.string().trim().max(120).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

    const email = data.email.toLowerCase();
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("otp_verifications")
      .select("id", { count: "exact", head: true })
      .eq("mobile_number", email)
      .gte("created_at", since);
    if ((count ?? 0) >= 8) throw new Error("Too many codes requested for this email. Try again later.");

    const code = String(Math.floor(1000 + Math.random() * 9000));
    const { error } = await supabaseAdmin.from("otp_verifications").insert({
      mobile_number: email,
      otp_code: code,
      purpose: PURPOSE,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (error) throw new Error("Could not create the verification code");

    await sendTemplateEmail("signup-otp", email, {
      templateData: { code, salonName: data.salonName },
    });

    return { sent: true };
  });

/** Checks the 4-digit code and marks the email as verified for this signup. */
export const verifySignupOtp = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; code: string }) =>
    z.object({ email: emailSchema, code: codeSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { consumeOtp } = await import("@/lib/otp.server");
    await consumeOtp(supabaseAdmin, data.email.toLowerCase(), data.code, PURPOSE);
    return { verified: true };
  });

const signupSchema = z.object({
  salonName: z.string().trim().min(2, "Enter your salon name").max(120),
  contactName: z.string().trim().min(2, "Enter the contact name").max(80),
  mobile: z.string().trim().regex(/^\+?[0-9]{10,15}$/, "Enter a valid contact number"),
  email: emailSchema,
});

/**
 * Creates the pending salon after email verification, together with a pending
 * free-trial subscription that Super Admin approves.
 */
export const submitSalonSignup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => signupSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();

    const { data: otp } = await supabaseAdmin
      .from("otp_verifications")
      .select("id, created_at")
      .eq("mobile_number", email)
      .eq("purpose", PURPOSE)
      .eq("is_verified", true)
      .is("reference_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otp) throw new Error("Verify your email with the 4-digit code first.");
    if (Date.now() - new Date(otp.created_at as string).getTime() > 60 * 60 * 1000) {
      throw new Error("That verification has expired. Request a new code.");
    }

    const { data: existing } = await supabaseAdmin
      .from("salons")
      .select("id")
      .eq("mobile_number", data.mobile)
      .maybeSingle();
    if (existing) throw new Error("A salon is already registered with this contact number.");

    const { data: trial } = await supabaseAdmin
      .from("subscription_plans")
      .select("id")
      .eq("billing_cycle", "trial")
      .maybeSingle();

    const slug = slugify(data.salonName, Math.random().toString(36).slice(2, 8));
    const { data: salon, error: salonError } = await supabaseAdmin
      .from("salons")
      .insert({
        salon_name: data.salonName,
        owner_name: data.contactName,
        mobile_number: data.mobile,
        email,
        slug,
        status: "pending_approval",
      })
      .select("id")
      .single();
    if (salonError || !salon) throw new Error("Could not register your salon. Please try again.");

    if (trial) {
      await supabaseAdmin.from("salon_subscriptions").insert({
        salon_id: salon.id,
        plan_id: trial.id,
        amount_paid: 0,
        approval_status: "pending",
      });
    }

    await supabaseAdmin
      .from("otp_verifications")
      .update({ reference_id: salon.id })
      .eq("id", otp.id as string);

    return { submitted: true };
  });
