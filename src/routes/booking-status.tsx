import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lookupBookings } from "@/lib/booking.functions";
import { formatTime } from "@/lib/slots";

export const Route = createFileRoute("/booking-status")({
  head: () => ({
    meta: [
      { title: "Check your booking status — SalonBook" },
      {
        name: "description",
        content: "Enter your mobile number and the last 4 characters of your booking reference to see the status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Check your booking status — SalonBook" },
      { property: "og:description", content: "No login needed — mobile number plus booking reference." },
    ],
  }),
  component: BookingStatusPage,
});

type Booking = {
  booking_reference: string;
  salon_name: string;
  service_name: string;
  appointment_date: string;
  slot_start_time: string;
  status: string;
  decline_reason: string | null;
};

function BookingStatusPage() {
  const lookup = useServerFn(lookupBookings);
  const [mobile, setMobile] = useState("");
  const [reference, setReference] = useState("");
  const [bookings, setBookings] = useState<Booking[] | null>(null);

  const search = useMutation({
    mutationFn: async () => lookup({ data: { mobile, reference } }),
    onSuccess: (result) => setBookings(result.bookings as unknown as Booking[]),
    onError: (error: Error) => toast.error(error.message || "Could not look up your bookings"),
  });

  return (
    <main className="mx-auto max-w-lg space-y-4 p-4 sm:p-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Check your booking</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          No account needed — just your mobile number and the last 4 characters of your reference.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="mobile">Mobile number</Label>
            <Input id="mobile" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reference">Last 4 of reference</Label>
            <Input
              id="reference"
              maxLength={4}
              value={reference}
              onChange={(e) => setReference(e.target.value.toUpperCase())}
            />
          </div>
          <Button className="w-full" disabled={search.isPending} onClick={() => search.mutate()}>
            Find my bookings
          </Button>
        </CardContent>
      </Card>

      {bookings && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings matched those details.</p>
            ) : (
              bookings.map((booking) => (
                <div key={booking.booking_reference} className="space-y-1 rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{booking.salon_name}</span>
                    <Badge variant="secondary">{booking.status.replace("_", " ")}</Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {booking.service_name} · {booking.appointment_date} at {formatTime(booking.slot_start_time)}
                  </p>
                  {booking.decline_reason && (
                    <p className="text-destructive">Reason: {booking.decline_reason}</p>
                  )}
                  <p className="font-mono text-xs text-muted-foreground">{booking.booking_reference}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <Button asChild variant="ghost" className="w-full">
        <Link to="/">Back to SalonBook</Link>
      </Button>
    </main>
  );
}
