/**
 * SMS delivery for mobile OTP codes.
 *
 * Uses the Twilio connector through the Lovable connector gateway when it is
 * configured. When no SMS provider is connected yet, the code is logged on the
 * server and returned to the caller so the flow is testable in preview.
 */
export type SmsResult = { delivered: boolean; devCode?: string };

export async function sendSms(mobile: string, message: string): Promise<SmsResult> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const twilioKey = process.env["TWILIO_API_KEY"];
  const from = process.env["TWILIO_FROM_NUMBER"];

  if (!lovableKey || !twilioKey || !from) {
    console.info(`[sms:not-configured] to=${mobile} message=${message}`);
    return { delivered: false };
  }

  const response = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": twilioKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: mobile, From: from, Body: message }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[sms:failed ${response.status}] ${body}`);
    throw new Error(`Could not send the SMS [${response.status}]`);
  }

  return { delivered: true };
}
