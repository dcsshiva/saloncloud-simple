import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const schema = z.object({
  salonId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().max(500).optional(),
  planName: z.string().trim().max(120).optional(),
  endDate: z.string().trim().max(40).optional(),
});

/**
 * Emails the salon owner when a super admin approves or rejects their
 * submission. Admin-only: the caller's role is verified before sending.
 */
export const emailSalonDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: salon } = await supabaseAdmin
      .from("salons")
      .select("salon_name, owner_name, email")
      .eq("id", data.salonId)
      .maybeSingle();

    if (!salon?.email) return { sent: false as const };

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const templateName = data.decision === "approved" ? "salon-approved" : "salon-rejected";

    const result = await sendTemplateEmail(templateName, salon.email, {
      templateData: {
        salonName: salon.salon_name,
        ownerName: salon.owner_name,
        reason: data.reason,
        planName: data.planName,
        endDate: data.endDate,
      },
      idempotencyKey: `${templateName}-${data.salonId}-${data.endDate ?? data.reason ?? ""}`,
    });

    return { sent: result.sent };
  });
