# Guest booking OTP over SoftSMS

The guest booking page at `/book/:salonSlug` already asks for a 6-digit mobile OTP before creating an appointment, but the SMS layer is still wired to a Twilio placeholder that isn't configured — so the code is only shown on screen as a preview. This work replaces that layer with SoftSMS so real SMS goes out, and tightens the guest OTP flow around it.

## What changes for users

- A guest picks a service, date and slot, enters name + mobile, taps "Send OTP" and receives a real SMS with a 6-digit code from your registered sender ID.
- Entering the code confirms the booking; wrong/expired codes give a clear message and a resend option with a short cooldown.
- The on-screen "SMS is not configured yet — your code is …" fallback disappears once SoftSMS credentials are saved (it stays only as a safety net if credentials are missing).
- Salon approve/decline SMS to the customer also goes through SoftSMS, using the same sender ID.

## Credentials needed

Four values, stored securely as backend secrets (not in code):

- `SOFTSMS_API_KEY` — the key from your SoftSMS panel
- `SOFTSMS_SENDER_ID` — approved 6-char DLT sender ID
- `SOFTSMS_PEID` — DLT principal entity ID
- `SOFTSMS_OTP_TEMPLATE_ID` — DLT template ID for the OTP message
- `SOFTSMS_TXN_TEMPLATE_ID` — DLT template ID for booking confirm/decline messages (optional; if you only have the OTP template, transactional SMS is skipped)

I'll request these through the secure secrets form after you approve.

## Technical details

1. **`src/lib/sms.server.ts`** — replace the Twilio gateway call with a SoftSMS GET request to
   `https://softsms.in/app/smsapi/index.php` with params `key`, `type=text`, `contacts`, `senderid`, `peid`, `templateid`, `msg`.
   - Read all env vars inside the function (Worker runtime injects at request time).
   - Normalise the mobile number to the 10-digit / country-code form SoftSMS expects (strip `+91`).
   - Accept a `templateId` argument so OTP vs transactional messages use the right DLT template.
   - Parse the response body: SoftSMS returns a plain-text/JSON status string; treat a non-2xx or an `error`/`invalid` body as failure, log status + body, and return `{ delivered: false }` rather than throwing, so the OTP row is still usable.
2. **`src/lib/otp.functions.ts`** — build the OTP text to exactly match the approved DLT template wording (variable slot for the code), pass the OTP template ID, and keep the existing hourly rate limit (8/number). Keep `previewCode` only when credentials are absent.
3. **`src/lib/notify.functions.ts`** — pass the transactional template ID; skip sending when it isn't configured.
4. **`src/routes/book/$salonSlug.tsx`** — add a 30-second resend cooldown on the "Send OTP" button and surface a clear "couldn't send SMS" error state; no other UI changes.

DLT wording note: Indian carriers reject messages that don't match the registered template character-for-character. I'll draft the OTP text as `Your SalonBook verification code is {#var#}. It expires in 5 minutes.` — tell me your exact approved template text and I'll match it instead.
