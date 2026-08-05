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
import { addDays, currency, isoDate } from "@/lib/subscription";

export const Route = createFileRoute("/_adminshell/admin/reports")({
  head: () => ({
    meta: [
      { title: "Platform Reports — SalonBook Admin" },
      { name: "description", content: "Salon status counts, revenue by plan, monthly revenue and top salons by bookings." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Platform Reports — SalonBook Admin" },
      { property: "og:description", content: "Revenue by plan, monthly trends and top salons by booking volume." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const [from, setFrom] = useState(isoDate(addDays(new Date(), -180)));
  const [to, setTo] = useState(isoDate(new Date()));

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "reports", from, to],
    queryFn: async () => {
      const fromIso = new Date(`${from}T00:00:00.000Z`).toISOString();
      const toIso = new Date(`${to}T23:59:59.999Z`).toISOString();

      const [salons, subs, appointments] = await Promise.all([
        supabase.from("salons").select("id, salon_name, status"),
        supabase
          .from("salon_subscriptions")
          .select("amount_paid, approval_status, created_at, end_date, subscription_plans(plan_name)")
          .gte("created_at", fromIso)
          .lte("created_at", toIso),
        supabase
          .from("appointments")
          .select("salon_id, status, created_at")
          .gte("created_at", fromIso)
          .lte("created_at", toIso),
      ]);
      if (salons.error) throw salons.error;
      if (subs.error) throw subs.error;
      if (appointments.error) throw appointments.error;

      return {
        salons: salons.data ?? [],
        subs: (subs.data ?? []) as unknown as {
          amount_paid: number | null;
          approval_status: string;
          created_at: string | null;
          end_date: string | null;
          subscription_plans: { plan_name: string } | null;
        }[],
        appointments: appointments.data ?? [],
      };
    },
  });

  const report = useMemo(() => {
    if (!data) return null;
    const today = isoDate(new Date());
    const approved = data.subs.filter((s) => s.approval_status === "approved");

    const byPlan = new Map<string, { plan: string; revenue: number; count: number }>();
    for (const sub of approved) {
      const plan = sub.subscription_plans?.plan_name ?? "Unassigned";
      const row = byPlan.get(plan) ?? { plan, revenue: 0, count: 0 };
      row.revenue += Number(sub.amount_paid ?? 0);
      row.count += 1;
      byPlan.set(plan, row);
    }

    const byMonth = new Map<string, number>();
    for (const sub of approved) {
      if (!sub.created_at) continue;
      const key = sub.created_at.slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + Number(sub.amount_paid ?? 0));
    }

    const salonNames = new Map(data.salons.map((s) => [s.id, s.salon_name]));
    const bySalon = new Map<string, number>();
    for (const appointment of data.appointments) {
      bySalon.set(appointment.salon_id, (bySalon.get(appointment.salon_id) ?? 0) + 1);
    }

    return {
      statusCounts: {
        active: data.salons.filter((s) => s.status === "active").length,
        pending: data.salons.filter((s) => s.status === "pending_approval").length,
        rejected: data.salons.filter((s) => s.status === "rejected").length,
        expired: approved.filter((s) => s.end_date !== null && s.end_date < today).length,
      },
      planRows: [...byPlan.values()].sort((a, b) => b.revenue - a.revenue),
      monthRows: [...byMonth.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, revenue]) => ({ month, revenue })),
      salonRows: [...bySalon.entries()]
        .map(([id, bookings]) => ({ salon: salonNames.get(id) ?? "Unknown", bookings }))
        .sort((a, b) => b.bookings - a.bookings)
        .slice(0, 20),
    };
  }, [data]);

  const monthOverMonth = (index: number) => {
    if (!report || index === 0) return null;
    const prev = report.monthRows[index - 1]!.revenue;
    const curr = report.monthRows[index]!.revenue;
    if (prev === 0) return null;
    return Math.round(((curr - prev) / prev) * 100);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Subscription revenue and booking volume across all salons.
        </p>
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
        </CardContent>
      </Card>

      {isLoading || !report ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Active salons", value: report.statusCounts.active },
              { label: "Pending", value: report.statusCounts.pending },
              { label: "Rejected", value: report.statusCounts.rejected },
              { label: "Expired", value: report.statusCounts.expired },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-3xl font-semibold">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <ReportTable
            title="Revenue by plan"
            onExport={() =>
              downloadCsv(
                `revenue-by-plan-${from}-to-${to}.csv`,
                report.planRows.map((r) => ({ plan: r.plan, subscriptions: r.count, revenue: r.revenue })),
              )
            }
            head={["Plan", "Subscriptions", "Revenue"]}
            rows={report.planRows.map((r) => [r.plan, String(r.count), currency(r.revenue)])}
          />

          <ReportTable
            title="Month-over-month revenue"
            onExport={() =>
              downloadCsv(
                `monthly-revenue-${from}-to-${to}.csv`,
                report.monthRows.map((r) => ({ month: r.month, revenue: r.revenue })),
              )
            }
            head={["Month", "Revenue", "Change"]}
            rows={report.monthRows.map((r, index) => {
              const change = monthOverMonth(index);
              return [r.month, currency(r.revenue), change === null ? "—" : `${change > 0 ? "+" : ""}${change}%`];
            })}
          />

          <ReportTable
            title="Top salons by bookings"
            onExport={() => downloadCsv(`top-salons-${from}-to-${to}.csv`, report.salonRows)}
            head={["Salon", "Bookings"]}
            rows={report.salonRows.map((r) => [r.salon, String(r.bookings)])}
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
