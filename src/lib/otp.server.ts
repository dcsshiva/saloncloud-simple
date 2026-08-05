import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Validates the newest unused OTP for a mobile number and marks it verified.
 * Throws a user-facing error when the code is wrong or expired.
 */
export async function consumeOtp(
  admin: SupabaseClient<never>,
  mobile: string,
  code: string,
  purpose: string,
): Promise<string> {
  const { data, error } = await (admin as unknown as SupabaseClient)
    .from("otp_verifications")
    .select("id, otp_code, expires_at, is_verified")
    .eq("mobile_number", mobile)
    .eq("purpose", purpose)
    .eq("is_verified", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error("Could not verify the code right now");
  if (!data) throw new Error("No active code for this number. Request a new one.");
  if (new Date(data.expires_at as string).getTime() < Date.now()) {
    throw new Error("That code has expired. Request a new one.");
  }
  if ((data.otp_code as string) !== code) throw new Error("That code is incorrect.");

  await (admin as unknown as SupabaseClient)
    .from("otp_verifications")
    .update({ is_verified: true })
    .eq("id", data.id as string);

  return data.id as string;
}
