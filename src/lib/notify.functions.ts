import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const schema = z.object({
  appointmentId: z.string().uuid(),
  status: z.enum(["approved", "declined", "completed", "no_show"]),
  reason: z.string().trim().max(200).optional(),
});

/**
 * SMS fallback for the customer when a salon actions their booking. The customer
 * has no account, so push only reaches them while their confirmation page is
 * open — this guarantees they always hear about the decision.
 */
export const notifyAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    // RLS scopes this read to salons the caller is a member of.
    const { data: appointment } = await context.supabase
      .from("appointments")
      .select("customer_mobile, appointment_date, slot_start_time, booking_reference")
      .eq("id", data.appointmentId)
      .maybeSingle();
    if (!appointment) return { sent: false };

    const { sendSms } = await import("@/lib/sms.server");
    const when = `${appointment.appointment_date} at ${String(appointment.slot_start_time).slice(0, 5)}`;
    const message =
      data.status === "approved"
        ? `Your SalonBook appointment on ${when} is confirmed. Ref ${appointment.booking_reference}.`
        : data.status === "declined"
          ? `Your SalonBook appointment on ${when} was declined${data.reason ? `: ${data.reason}` : ""}. Please rebook.`
          : `Your SalonBook appointment on ${when} is marked ${data.status.replace("_", " ")}.`;

    const templateId = process.env["SOFTSMS_TXN_TEMPLATE_ID"];
    if (!templateId) return { sent: false };

    const result = await sendSms(appointment.customer_mobile, message, templateId);
    return { sent: result.delivered };
  });
