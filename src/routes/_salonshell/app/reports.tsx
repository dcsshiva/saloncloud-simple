import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadCsv } from "@/lib/csv";
import { formatTime } from "@/lib/slots";
import { addDays, currency, isoDate } from "@/lib/subscription";
import { useSalon } from "@/lib/use-salon";

export const Route = createFileRoute("/_salonshell/app/reports")({
  head: () => ({
    meta: [
      { title: "Salon Reports — SalonBook" },
      {
        name: "description",
        content: "Bookings by status and period, busiest slots and days, service revenue and repeat customers.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Salon Reports — SalonBook" },
      { property: "og:description", content: "Booking volume, busiest slots and service revenue for your salon." },
    ],
  }),
  component: SalonReports,
});

type Row = {
  appointment_date: string;
  slot_start_time: string;
  status: string;
  customer_mobile: string;
  customer_name: string;
  services: { service_name: string; price: number | null } | null;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const REVENUE_STATUSES = new Set(["approved", "completed"]);

function bucketOf(date: string, grouping: string): string {
  if (grouping === "month") return date.slice(0, 7);
  if (grouping === "week") {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    return `Week of ${d.toISOString().slice(0, 10)}`;
  }
  return date;
}

function SalonReports() {
  const { data: context } = useSalon();
  const salonId = context?.salon.id;
  const [from, setFrom] = useState(isoDate(addDays(new Date(), -90)));
  const [to, setTo] = useState(isoDate(new Date()));
  const [grouping, setGrouping] = useState<"day" | "week" | "month">("day");

  const { data, isLoading } = useQuery({
    queryKey: ["salon", "reports", salonId, from, to],
    enabled: Boolean(salonId),
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("appointments")
        .select("appointment_date, slot_start_time, status, customer_mobile, customer_name, services(service_name, price)")
        .eq("salon_id", salonId!)
        .gte("appointment_date", from)
        .lte("appointment_date", to)
        .order("appointment_date");
      if (error) throw error;
      return (rows ?? []) as unknown as Row[];
    },
  });

  const report = useMemo(() => {
    const rows = data ?? [];
    const periods = new Map<string, Record<string, number>>();
    const slots = new Map<string, number>();
    const weekdays = new Map<number, number>();
    const services = new Map<string, { count: number; revenue: number }>();
    const customers = new Map<string, { name: string; visits: number }>();

    for (const row of rows) {
      const bucket = bucketOf(row.appointment_date, grouping);
      const period = periods.get(bucket) ?? { total: 0, approved: 0, declined: 0, completed: 0, no_show: 0, pending_approval: 0 };
      period["total"] = (period["total"] ?? 0) + 1;
      period[row.status] = (period[row.status] ?? 0) + 1;
      periods.set(bucket, period);

      slots.set(row.slot_start_time, (slots.get(row.slot_start_time) ?? 0) + 1);
      const weekday = new Date(`${row.appointment_date}T12:00:00Z`).getUTCDay();
      weekdays.set(weekday, (weekdays.get(weekday) ?? 0) + 1);

      const serviceName = row.services?.service_name ?? "Unknown service";
      const service = services.get(serviceName) ?? { count: 0, revenue: 0 };
      service.count += 1;
      if (REVENUE_STATUSES.has(row.status)) service.revenue += Number(row.services?.price ?? 0);
      services.set(serviceName, service);

      const customer = customers.get(row.customer_mobile) ?? { name: row.customer_name, visits: 0 };
      customer.visits += 1;
      customers.set(row.customer_mobile, customer);
    }

    return {
      total: rows.length,
      periodRows: [...periods.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      slotRows: [...slots.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
      weekdayRows: [...weekdays.entries()].sort((a, b) => b[1] - a[1]),
      serviceRows: [...services.entries()].sort((a, b) => b[1].revenue - a[1].revenue),
      repeatRows: [...customers.entries()].filter(([, c]) => c.visits > 1).sort((a, b) => b[1].visits - a[1].visits).slice(0, 25),
      statusTotals: {
        approved: rows.filter((r) => r.status === "approved").length,
        pending: rows.filter((r) => r.status === "pending_approval").length,
        declined: rows.filter((r) => r.status === "declined").length,
        completed: rows.filter((r) => r.status === "completed").length,
        noShow: rows.filter((r) => r.status === "no_show").length,
      },
    };
  }, [data, grouping]);

  const exportAll = () => {
    downloadCsv(
      `salon-appointments-${from}-to-${to}.csv`,
      (data ?? []).map((row) => ({
        date: row.appointment_date,
        time: row.slot_start_time,
        status: row.status,
        service: row.services?.service_name ?? "",
        price: row.services?.price ?? "",
        customer: row.customer_name,
        mobile: row.customer_mobile,
      })),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {report.total} appointments between {from} and {to}.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportAll} disabled={(data ?? []).length === 0}>
          <Download className="size-4" /> Export all
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex gap-1">
            {(["day", "week", "month"] as const).map((option) => (
              <Button
                key={option}
                size="sm"
                variant={grouping === option ? "default" : "outline"}
                onClick={() => setGrouping(option)}
              >
                {option}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-5">
            {[
              { label: "Approved", value: report.statusTotals.approved },
              { label: "Pending", value: report.statusTotals.pending },
              { label: "Declined", value: report.statusTotals.declined },
              { label: "Completed", value: report.statusTotals.completed },
              { label: "No-show", value: report.statusTotals.noShow },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{stat.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-2xl font-semibold">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <ReportTable
            title={`Appointments by ${grouping}`}
            head={["Period", "Total", "Approved", "Declined", "Completed", "No-show"]}
            rows={report.periodRows.map(([period, counts]) => [
              period,
              String(counts["total"] ?? 0),
              String(counts["approved"] ?? 0),
              String(counts["declined"] ?? 0),
              String(counts["completed"] ?? 0),
              String(counts["no_show"] ?? 0),
            ])}
            onExport={() =>
              downloadCsv(
                `appointments-by-${grouping}-${from}-to-${to}.csv`,
                report.periodRows.map(([period, counts]) => ({
                  period,
                  total: counts["total"] ?? 0,
                  approved: counts["approved"] ?? 0,
                  declined: counts["declined"] ?? 0,
                  completed: counts["completed"] ?? 0,
                  no_show: counts["no_show"] ?? 0,
                })),
              )
            }
          />

          <ReportTable
            title="Busiest time slots"
            head={["Slot", "Bookings"]}
            rows={report.slotRows.map(([slot, count]) => [formatTime(slot), String(count)])}
            onExport={() =>
              downloadCsv(
                `busiest-slots-${from}-to-${to}.csv`,
                report.slotRows.map(([slot, count]) => ({ slot: formatTime(slot), bookings: count })),
              )
            }
          />

          <ReportTable
            title="Busiest days"
            head={["Day", "Bookings"]}
            rows={report.weekdayRows.map(([day, count]) => [WEEKDAYS[day] ?? "—", String(count)])}
            onExport={() =>
              downloadCsv(
                `busiest-days-${from}-to-${to}.csv`,
                report.weekdayRows.map(([day, count]) => ({ day: WEEKDAYS[day] ?? "", bookings: count })),
              )
            }
          />

          <ReportTable
            title="Service-wise bookings and revenue"
            head={["Service", "Bookings", "Revenue"]}
            rows={report.serviceRows.map(([name, s]) => [name, String(s.count), currency(s.revenue)])}
            onExport={() =>
              downloadCsv(
                `services-${from}-to-${to}.csv`,
                report.serviceRows.map(([name, s]) => ({ service: name, bookings: s.count, revenue: s.revenue })),
              )
            }
          />

          <ReportTable
            title="Repeat customers"
            head={["Customer", "Mobile", "Visits"]}
            rows={report.repeatRows.map(([mobile, c]) => [c.name, mobile, String(c.visits)])}
            onExport={() =>
              downloadCsv(
                `repeat-customers-${from}-to-${to}.csv`,
                report.repeatRows.map(([mobile, c]) => ({ customer: c.name, mobile, visits: c.visits })),
              )
            }
          />
        </>
      )}
    </div>
  );
}

function ReportTable({
  title,
  head,
  rows,
  onExport,
}: {
  title: string;
  head: string[];
  rows: string[][];
  onExport: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button variant="outline" size="sm" onClick={onExport} disabled={rows.length === 0}>
          <Download className="size-4" /> CSV
        </Button>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No data in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {head.map((cell) => (
                    <TableHead key={cell}>{cell}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={index}>
                    {row.map((cell, cellIndex) => (
                      <TableCell key={cellIndex}>{cell}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
