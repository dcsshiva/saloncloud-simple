import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useServerFn } from "@tanstack/react-start";
import { notifyAppointmentStatus } from "@/lib/notify.functions";
import { formatTime, nowInTimezone } from "@/lib/slots";
import { useSalon } from "@/lib/use-salon";


export const Route = createFileRoute("/_salonshell/app/")({
  head: () => ({
    meta: [
      { title: "Today's Appointments — SalonBook" },
      { name: "description", content: "See today's bookings and approve new appointment requests for your salon." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Today's Appointments — SalonBook" },
      { property: "og:description", content: "Approve new appointment requests for your salon." },
    ],
  }),
  component: SalonDashboard,
});

type Appointment = {
  id: string;
  customer_name: string;
  customer_mobile: string;
  appointment_date: string;
  slot_start_time: string;
  slot_end_time: string;
  status: string;
  booking_reference: string;
  decline_reason: string | null;
  services: { service_name: string; price: number | null } | null;
};

const statusStyles: Record<string, string> = {
  pending_approval: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  approved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  declined: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100",
  completed: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
  no_show: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  pending_approval: "Pending",
  approved: "Approved",
  declined: "Declined",
  completed: "Completed",
  no_show: "No-show",
};

function SalonDashboard() {
  const queryClient = useQueryClient();
  const notify = useServerFn(notifyAppointmentStatus);

  const { data: context, isLoading: loadingSalon } = useSalon();
  const salonId = context?.salon.id;
  const timezone = context?.salon.timezone ?? "Asia/Kolkata";
  const today = nowInTimezone(timezone).date;

  const [selected, setSelected] = useState<Appointment | null>(null);
  const [reason, setReason] = useState("");

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["salon", "appointments", salonId, today],
    enabled: Boolean(salonId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, customer_name, customer_mobile, appointment_date, slot_start_time, slot_end_time, status, booking_reference, decline_reason, services(service_name, price)",
        )
        .eq("salon_id", salonId!)
        .gte("appointment_date", today)
        .order("appointment_date")
        .order("slot_start_time");
      if (error) throw error;
      return data as unknown as Appointment[];
    },
  });

  const todays = useMemo(
    () => (appointments ?? []).filter((a) => a.appointment_date === today),
    [appointments, today],
  );
  const pending = useMemo(
    () => (appointments ?? []).filter((a) => a.status === "pending_approval"),
    [appointments],
  );

  const setStatus = useMutation({
    mutationFn: async ({
      appointment,
      status,
      declineReason,
    }: {
      appointment: Appointment;
      status: string;
      declineReason?: string;
    }) => {
      const { error } = await supabase
        .from("appointments")
        .update({
          status,
          decline_reason: declineReason ?? null,
          approved_by: context?.staff.id ?? null,
          approved_at: new Date().toISOString(),
        })
        .eq("id", appointment.id);
      if (error) throw error;

      // SMS fallback for customers who did not allow browser alerts.
      try {
        await notify({
          data: {
            appointmentId: appointment.id,
            status: status as "approved" | "declined" | "completed" | "no_show",
            ...(declineReason ? { reason: declineReason } : {}),
          },
        });
      } catch {
        /* the status change already succeeded; delivery is best effort */
      }
    },
    onSuccess: () => {
      toast.success("Appointment updated");
      setSelected(null);
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["salon", "appointments"] });
    },
    onError: () => toast.error("Could not update the appointment"),
  });


  if (loadingSalon) return <Skeleton className="h-64 w-full" />;

  if (!context) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          No salon is linked to this account yet. Register your salon to get started.
        </CardContent>
      </Card>
    );
  }

  const locked = context.salon.status !== "active";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Today</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date(`${today}T12:00:00Z`).toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            New booking requests
            {pending.length > 0 && (
              <Badge className="ml-2" variant="destructive">
                {pending.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : pending.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">Nothing waiting for you right now.</p>
          ) : (
            pending.map((appointment) => (
              <AppointmentRow
                key={appointment.id}
                appointment={appointment}
                onOpen={() => setSelected(appointment)}
                showDate
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Today's appointments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : todays.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No appointments booked for today.</p>
          ) : (
            todays.map((appointment) => (
              <AppointmentRow
                key={appointment.id}
                appointment={appointment}
                onOpen={() => setSelected(appointment)}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={selected !== null} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.customer_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <dl className="space-y-1 text-sm">
                <Row label="Mobile" value={selected.customer_mobile} />
                <Row label="Service" value={selected.services?.service_name ?? "—"} />
                <Row
                  label="When"
                  value={`${new Date(`${selected.appointment_date}T12:00:00Z`).toLocaleDateString()} · ${formatTime(selected.slot_start_time)} – ${formatTime(selected.slot_end_time)}`}
                />
                <Row label="Reference" value={selected.booking_reference} />
                <Row label="Status" value={statusLabels[selected.status] ?? selected.status} />
                {selected.decline_reason && <Row label="Reason" value={selected.decline_reason} />}
              </dl>

              {locked ? (
                <p className="text-sm text-muted-foreground">
                  Your salon is not approved yet, so bookings cannot be actioned.
                </p>
              ) : (
                <div className="space-y-3">
                  {selected.status === "pending_approval" && (
                    <>
                      <Button
                        className="w-full"
                        onClick={() => setStatus.mutate({ appointment: selected, status: "approved" })}
                        disabled={setStatus.isPending}
                      >
                        Approve booking
                      </Button>
                      <div className="space-y-2">
                        <Label htmlFor="decline-reason">Decline reason</Label>
                        <Input
                          id="decline-reason"
                          value={reason}
                          maxLength={200}
                          placeholder="e.g. Stylist unavailable at that time"
                          onChange={(e) => setReason(e.target.value)}
                        />
                        <Button
                          variant="outline"
                          className="w-full"
                          disabled={setStatus.isPending}
                          onClick={() => {
                            if (reason.trim().length < 4) {
                              toast.error("Give the customer a short reason");
                              return;
                            }
                            setStatus.mutate({
                              appointment: selected,
                              status: "declined",
                              declineReason: reason.trim(),
                            });
                          }}
                        >
                          Decline and re-open the slot
                        </Button>
                      </div>
                    </>
                  )}

                  {selected.status === "approved" && (
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        onClick={() => setStatus.mutate({ appointment: selected, status: "completed" })}
                      >
                        Mark completed
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() =>
                          setStatus.mutate({
                            appointment: selected,
                            status: "no_show",
                            declineReason: "Customer did not arrive",
                          })
                        }
                      >
                        No-show
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AppointmentRow({
  appointment,
  onOpen,
  showDate,
}: {
  appointment: Appointment;
  onOpen: () => void;
  showDate?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{appointment.customer_name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {showDate && `${new Date(`${appointment.appointment_date}T12:00:00Z`).toLocaleDateString()} · `}
          {formatTime(appointment.slot_start_time)} · {appointment.services?.service_name ?? "Service"}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[appointment.status] ?? "bg-muted"}`}
      >
        {statusLabels[appointment.status] ?? appointment.status}
      </span>
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
