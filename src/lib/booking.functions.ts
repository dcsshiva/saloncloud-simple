import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const mobileSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{10,15}$/, "Enter a valid mobile number including country code");

const bookingSchema = z.object({
  salonSlug: z.string().trim().min(1).max(120),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
  slotStart: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Pick a valid slot"),
  customerName: z.string().trim().min(2, "Enter your name").max(80),
  customerMobile: mobileSchema,
  code: z.string().trim().regex(/^[0-9]{6}$/, "Enter the 6-digit code"),
});

/**
 * Verifies the customer's OTP and creates the appointment in one server call.
 * The partial unique index rejects a simultaneous double booking of a slot.
 */
export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => bookingSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { consumeOtp } = await import("@/lib/otp.server");
    const slots = await import("@/lib/slots");

    const { data: salon } = await supabaseAdmin
      .from("salons")
      .select("id, timezone, status")
      .eq("slug", data.salonSlug)
      .maybeSingle();
    if (!salon || salon.status !== "active") throw new Error("This salon is not accepting bookings.");

    const { data: service } = await supabaseAdmin
      .from("services")
      .select("id, duration_minutes, is_active")
      .eq("id", data.serviceId)
      .eq("salon_id", salon.id)
      .maybeSingle();
    if (!service || !service.is_active) throw new Error("That service is no longer available.");

    const { data: holiday } = await supabaseAdmin
      .from("salon_holidays")
      .select("id")
      .eq("salon_id", salon.id)
      .eq("holiday_date", data.date)
      .maybeSingle();
    if (holiday) throw new Error("The salon is closed on that date.");

    const { data: hours } = await supabaseAdmin
      .from("business_hours")
      .select("is_open, open_time, close_time, break_start, break_end")
      .eq("salon_id", salon.id)
      .eq("weekday", slots.weekdayOf(data.date))
      .maybeSingle();

    const slotStart = data.slotStart.length === 5 ? `${data.slotStart}:00` : data.slotStart;
    const valid = slots.generateSlots(hours, service.duration_minutes);
    if (!valid.includes(slotStart)) throw new Error("That slot is outside the salon's working hours.");

    const now = slots.nowInTimezone(salon.timezone ?? "Asia/Kolkata");
    if (data.date < now.date) throw new Error("That date is in the past.");
    if (data.date === now.date && slots.toMinutes(slotStart) <= now.minutes) {
      throw new Error("That time has already passed today.");
    }

    const { data: taken } = await supabaseAdmin.rpc("get_taken_slots", {
      _salon_id: salon.id,
      _date: data.date,
    });
    if (slots.overlapsTaken(slotStart, service.duration_minutes, taken ?? [])) {
      throw new Error("This slot was just taken, please pick another.");
    }

    await consumeOtp(supabaseAdmin, data.customerMobile, data.code, "appointment_booking");

    const slotEnd = slots.toTimeString(slots.toMinutes(slotStart) + service.duration_minutes);
    const { data: appointment, error } = await supabaseAdmin
      .from("appointments")
      .insert({
        salon_id: salon.id,
        service_id: service.id,
        customer_name: data.customerName,
        customer_mobile: data.customerMobile,
        appointment_date: data.date,
        slot_start_time: slotStart,
        slot_end_time: slotEnd,
        status: "pending_approval",
        otp_verified: true,
      })
      .select("booking_reference")
      .single();

    if (error) {
      if (error.code === "23505") throw new Error("This slot was just taken, please pick another.");
      throw new Error("Could not create your booking. Please try again.");
    }

    return { bookingReference: appointment.booking_reference as string };
  });

/** Customer self-service status check: mobile number + last 4 of the booking reference. */
export const lookupBookings = createServerFn({ method: "POST" })
  .inputValidator((input: { mobile: string; reference: string }) =>
    z
      .object({ mobile: mobileSchema, reference: z.string().trim().length(4, "Enter the last 4 characters") })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("lookup_bookings", {
      _mobile: data.mobile,
      _reference: data.reference,
    });
    if (error) throw new Error("Could not look up your bookings.");
    return { bookings: rows ?? [] };
  });
