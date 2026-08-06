/**
 * SMS delivery through the SoftSMS gateway (https://softsms.in).
 *
 * India's DLT rules require a registered sender ID, principal entity ID and a
 * template ID whose text matches the message character-for-character. All four
 * values are stored as backend secrets and read at call time (the Worker
 * runtime injects env per request, so never read them at module scope).
 *
 * When the credentials are missing the code is logged server-side and the
 * caller can surface it in preview so the flow stays testable.
 */
export type SmsResult = { delivered: boolean; devCode?: string };

const ENDPOINT = "https://softsms.in/app/smsapi/index.php";

/** SoftSMS expects bare digits; strip +, spaces and a leading 91/0 prefix. */
function normaliseMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

function looksLikeFailure(body: string): boolean {
  const text = body.toLowerCase();
  return (
    text.includes("error") ||
    text.includes("invalid") ||
    text.includes("failed") ||
    text.includes("insufficient") ||
    text.includes("\"status\":\"error\"")
  );
}

/**
 * Sends one SMS. `templateId` must be the DLT template registered for this
 * exact message wording. Returns `delivered: false` (never throws) so callers
 * can fall back gracefully instead of losing the OTP row they just created.
 */
export async function sendSms(
  mobile: string,
  message: string,
  templateId?: string,
): Promise<SmsResult> {
  const key = process.env["SOFTSMS_API_KEY"];
  const senderId = process.env["SOFTSMS_SENDER_ID"];
  const peid = process.env["SOFTSMS_PEID"];

  if (!key || !senderId || !peid || !templateId) {
    console.info(`[sms:not-configured] to=${mobile} message=${message}`);
    return { delivered: false };
  }

  const params = new URLSearchParams({
    key,
    type: "text",
    contacts: normaliseMobile(mobile),
    senderid: senderId,
    peid,
    templateid: templateId,
    msg: message,
  });

  try {
    const response = await fetch(`${ENDPOINT}?${params.toString()}`, { method: "GET" });
    const body = (await response.text()).trim();

    if (!response.ok || looksLikeFailure(body)) {
      console.error(`[sms:failed ${response.status}] ${body}`);
      return { delivered: false };
    }

    return { delivered: true };
  } catch (error) {
    console.error(`[sms:error] ${(error as Error).message}`);
    return { delivered: false };
  }
}
