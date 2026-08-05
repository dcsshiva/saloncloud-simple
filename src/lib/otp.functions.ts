import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const mobileSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{10,15}$/, "Enter a valid mobile number including country code");

const purposeSchema = z.enum(["appointment_booking", "salon_signup"]);

/** Sends a 6-digit OTP to the given mobile number and stores it for ~5 minutes. */
export const sendOtp = createServerFn({ method: "POST" })
  .inputValidator((input: { mobile: string; purpose: string }) =>
    z.object({ mobile: mobileSchema, purpose: purposeSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendSms } = await import("@/lib/sms.server");

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("otp_verifications")
      .select("id", { count: "exact", head: true })
      .eq("mobile_number", data.mobile)
      .gte("created_at", since);

    if ((count ?? 0) >= 8) {
      throw new Error("Too many codes requested for this number. Try again later.");
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error } = await supabaseAdmin.from("otp_verifications").insert({
      mobile_number: data.mobile,
      otp_code: code,
      purpose: data.purpose,
      expires_at: expiresAt,
    });
    if (error) throw new Error("Could not create the verification code");

    const sms = await sendSms(data.mobile, `Your SalonBook verification code is ${code}. It expires in 5 minutes.`);

    return { sent: true, delivered: sms.delivered, previewCode: sms.delivered ? null : code };
  });

/** Verifies an OTP for flows that do not create a booking (e.g. salon signup). */
export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((input: { mobile: string; code: string; purpose: string }) =>
    z
      .object({
        mobile: mobileSchema,
        code: z.string().trim().regex(/^[0-9]{6}$/, "Enter the 6-digit code"),
        purpose: purposeSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { consumeOtp } = await import("@/lib/otp.server");
    await consumeOtp(supabaseAdmin, data.mobile, data.code, data.purpose);
    return { verified: true };
  });
