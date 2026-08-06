import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, Clock, MapPin, Navigation } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { createBooking, lookupBookings } from "@/lib/booking.functions";
import { sendOtp } from "@/lib/otp.functions";
import { alertUser, ensureNotificationPermission, readPrefs, unlockAudio, writePrefs } from "@/lib/ringtone";
import { currency } from "@/lib/subscription";
import {
  formatTime,
  generateSlots,
  nowInTimezone,
  overlapsTaken,
  toMinutes,
  weekdayOf,
  type Hours,
  type TakenSlot,
} from "@/lib/slots";

export const Route = createFileRoute("/book/$salonSlug")({
  head: ({ params }) => ({
    meta: [
      { title: `Book an appointment — ${params.salonSlug} | SalonBook` },
      {
        name: "description",
        content: "Pick a service and a 30-minute slot, verify your mobile with an OTP and send your booking request.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Book an appointment — SalonBook" },
      { property: "og:description", content: "Choose a service and time slot, confirm with a mobile OTP." },
    ],
  }),
  component: BookingPage,
});

type Service = { id: string; service_name: string; duration_minutes: number; price: number | null };

function todayPlus(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function BookingPage() {
  const { salonSlug } = Route.useParams();
  const send = useServerFn(sendOtp);
  const book = useServerFn(createBooking);
  const lookup = useServerFn(lookupBookings);

  const [serviceId, setServiceId] = useState<string>("");
  const [date, setDate] = useState<string>(todayPlus(0));
  const [slot, setSlot] = useState<string>("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("pending_approval");
  const [declineReason, setDeclineReason] = useState<string | null>(null);
  const [alertsOn, setAlertsOn] = useState(false);
  const lastStatus = useRef("pending_approval");

  const { data: salon, isLoading } = useQuery({
    queryKey: ["public-salon", salonSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salons")
        .select("id, salon_name, address, latitude, longitude, logo_url, timezone, status")
        .eq("slug", salonSlug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const salonId = salon?.id;

  const { data: services } = useQuery({
    queryKey: ["public-services", salonId],
    enabled: Boolean(salonId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, service_name, duration_minutes, price")
        .eq("salon_id", salonId!)
        .eq("is_active", true)
        .order("service_name");
      if (error) throw error;
      return (data ?? []) as Service[];
    },
  });

  const { data: availability, isLoading: loadingSlots } = useQuery({
    queryKey: ["public-availability", salonId, date],
    enabled: Boolean(salonId) && Boolean(date),
    queryFn: async () => {
      const [hours, holiday, taken] = await Promise.all([
        supabase
          .from("business_hours")
          .select("is_open, open_time, close_time, break_start, break_end")
          .eq("salon_id", salonId!)
          .eq("weekday", weekdayOf(date))
          .maybeSingle(),
        supabase
          .from("salon_holidays")
          .select("id")
          .eq("salon_id", salonId!)
          .eq("holiday_date", date)
          .maybeSingle(),
        supabase.rpc("get_taken_slots", { _salon_id: salonId!, _date: date }),
      ]);
      return {
        hours: (hours.data ?? null) as Hours | null,
        isHoliday: Boolean(holiday.data),
        taken: ((taken.data ?? []) as TakenSlot[]),
      };
    },
  });

  const service = useMemo(() => services?.find((s) => s.id === serviceId) ?? null, [services, serviceId]);

  const slots = useMemo(() => {
    if (!service || !availability || availability.isHoliday) return [];
    const now = nowInTimezone(salon?.timezone ?? "Asia/Kolkata");
    return generateSlots(availability.hours, service.duration_minutes).filter((start) => {
      if (date === now.date && toMinutes(start) <= now.minutes) return false;
      return !overlapsTaken(start, service.duration_minutes, availability.taken);
    });
  }, [service, availability, date, salon?.timezone]);

  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendCode = useMutation({
    mutationFn: async () => send({ data: { mobile, purpose: "appointment_booking" } }),
    onSuccess: (result) => {
      setOtpSent(true);
      setCooldown(30);
      toast.success(
        result.previewCode
          ? `SMS is not configured yet — your code is ${result.previewCode}`
          : "We sent a 6-digit code to your mobile",
      );
    },
    onError: (error: Error) => toast.error(error.message || "Could not send the code"),
  });

  const confirm = useMutation({
    mutationFn: async () =>
      book({
        data: {
          salonSlug,
          serviceId,
          date,
          slotStart: slot,
          customerName: name,
          customerMobile: mobile,
          code,
        },
      }),
    onSuccess: async (result) => {
      setReference(result.bookingReference);
      const granted = await ensureNotificationPermission();
      if (granted === "granted") {
        const prefs = { ...readPrefs(), enabled: true };
        writePrefs(prefs);
        await unlockAudio(prefs);
        setAlertsOn(true);
      }
    },
    onError: (error: Error) => toast.error(error.message || "Could not create your booking"),
  });

  // While the confirmation screen is open, watch for the salon's decision and
  // alert the customer audibly the moment it changes.
  useEffect(() => {
    if (!reference) return;
    const tick = async () => {
      try {
        const result = await lookup({ data: { mobile, reference: reference.slice(-4) } });
        const match = result.bookings.find((b) => b.booking_reference === reference);
        if (!match || match.status === lastStatus.current) return;
        lastStatus.current = match.status;
        setStatus(match.status);
        setDeclineReason(match.decline_reason ?? null);
        if (match.status === "approved") {
          alertUser("Appointment confirmed", `${match.salon_name} confirmed your booking.`);
        } else if (match.status === "declined") {
          alertUser("Appointment declined", match.decline_reason ?? "Please pick another slot.");
        }
      } catch {
        /* transient network issue — the next tick retries */
      }
    };
    const timer = window.setInterval(tick, 15000);
    return () => window.clearInterval(timer);
  }, [reference, mobile, lookup]);

  if (isLoading) return <Skeleton className="m-4 h-96" />;

  if (!salon || salon.status !== "active") {
    return (
      <main className="mx-auto max-w-lg p-6 text-center">
        <h1 className="font-display text-2xl font-semibold">Salon not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This booking page is not live yet. Please check the link with the salon.
        </p>
        <Button asChild className="mt-4">
          <Link to="/">Back to SalonBook</Link>
        </Button>
      </main>
    );
  }

  if (reference) {
    return (
      <main className="mx-auto max-w-lg space-y-4 p-4 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">
              {status === "approved"
                ? "Your appointment is confirmed"
                : status === "declined"
                  ? "Your booking was declined"
                  : "Your booking request has been sent"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {status === "approved"
                ? `See you at ${salon.salon_name} on ${date} at ${formatTime(slot)}.`
                : status === "declined"
                  ? declineReason ?? "Please pick another slot."
                  : "The salon will confirm shortly. Keep this page open and we'll ring when they do."}
            </p>
            <p>
              Booking reference: <span className="font-mono font-semibold">{reference}</span>
            </p>
            <Badge variant="secondary">{status.replace("_", " ")}</Badge>

            {!alertsOn && (
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  const prefs = { ...readPrefs(), enabled: true };
                  writePrefs(prefs);
                  await unlockAudio(prefs);
                  await ensureNotificationPermission();
                  setAlertsOn(true);
                  toast.success("We'll ring the moment your appointment is confirmed");
                }}
              >
                <BellRing className="size-4" /> Get notified the moment it's confirmed
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              If you don't allow alerts, we'll text you the confirmation instead.
            </p>
            <Button asChild variant="ghost" className="w-full">
              <Link to="/booking-status">Check a booking later</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg space-y-4 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-semibold">{salon.salon_name}</h1>
        {salon.address && (
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" /> {salon.address}
          </p>
        )}
        {salon.latitude != null && salon.longitude != null && (
          <Button asChild size="sm" variant="outline">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${salon.latitude},${salon.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              <Navigation className="size-4" /> Get directions
            </a>
          </Button>
        )}
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">1. Choose a service</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(services ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No services listed yet.</p>
          ) : (
            (services ?? []).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setServiceId(item.id);
                  setSlot("");
                }}
                className={`flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors ${
                  serviceId === item.id ? "border-primary bg-primary/5" : "hover:bg-accent"
                }`}
              >
                <span>
                  <span className="font-medium">{item.service_name}</span>
                  <span className="block text-xs text-muted-foreground">
                    <Clock className="mr-1 inline size-3" />
                    {item.duration_minutes} min
                  </span>
                </span>
                <span className="font-medium">{item.price == null ? "—" : currency(item.price)}</span>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">2. Pick a date and time</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="date"
            value={date}
            min={todayPlus(0)}
            max={todayPlus(60)}
            onChange={(e) => {
              setDate(e.target.value);
              setSlot("");
            }}
          />
          {!service ? (
            <p className="text-sm text-muted-foreground">Choose a service first.</p>
          ) : loadingSlots ? (
            <Skeleton className="h-24 w-full" />
          ) : availability?.isHoliday ? (
            <p className="text-sm text-muted-foreground">The salon is closed on this date.</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No free slots left on this date.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((start) => (
                <Button
                  key={start}
                  type="button"
                  size="sm"
                  variant={slot === start ? "default" : "outline"}
                  onClick={() => setSlot(start)}
                >
                  {formatTime(start)}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">3. Verify your mobile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobile">Mobile number</Label>
            <Input
              id="mobile"
              inputMode="tel"
              placeholder="+919876543210"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            className="w-full"
            disabled={
              sendCode.isPending ||
              cooldown > 0 ||
              !slot ||
              name.trim().length < 2 ||
              mobile.trim().length < 10
            }
            onClick={() => sendCode.mutate()}
          >
            {cooldown > 0
              ? `Resend code in ${cooldown}s`
              : otpSent
                ? "Resend code"
                : "Send OTP"}
          </Button>

          {otpSent && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="code">6-digit code</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <Button
                className="w-full"
                disabled={confirm.isPending || code.length !== 6}
                onClick={() => confirm.mutate()}
              >
                Confirm booking request
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
