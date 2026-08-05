import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { currency, isoDate } from "@/lib/subscription";

export const Route = createFileRoute("/_adminshell/admin/")({
  head: () => ({
    meta: [
      { title: "Platform Overview — SalonBook Admin" },
      { name: "description", content: "Salon counts, pending approvals and subscription revenue at a glance." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Platform Overview — SalonBook Admin" },
      { property: "og:description", content: "Salon counts, pending approvals and subscription revenue at a glance." },
    ],
  }),
  component: AdminOverview,
});

function AdminOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: async () => {
      const today = isoDate(new Date());
      const [salons, subs, appointments] = await Promise.all([
        supabase.from("salons").select("id, status"),
        supabase.from("salon_subscriptions").select("amount_paid, approval_status, end_date"),
        supabase.from("appointments").select("id", { count: "exact", head: true }),
      ]);
      if (salons.error) throw salons.error;
      if (subs.error) throw subs.error;

      const rows = salons.data ?? [];
      const subRows = subs.data ?? [];
      return {
        active: rows.filter((s) => s.status === "active").length,
        pending: rows.filter((s) => s.status === "pending_approval").length,
        rejected: rows.filter((s) => s.status === "rejected").length,
        expired: subRows.filter(
          (s) => s.approval_status === "approved" && s.end_date !== null && s.end_date < today,
        ).length,
        revenue: subRows
          .filter((s) => s.approval_status === "approved")
          .reduce((sum, s) => sum + Number(s.amount_paid ?? 0), 0),
        appointments: appointments.count ?? 0,
      };
    },
  });

  const stats = [
    { label: "Active salons", value: data?.active ?? 0 },
    { label: "Pending approval", value: data?.pending ?? 0 },
    { label: "Rejected", value: data?.rejected ?? 0 },
    { label: "Expired subscriptions", value: data?.expired ?? 0 },
    { label: "Approved revenue", value: currency(data?.revenue), raw: true },
    { label: "Total appointments", value: data?.appointments ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Platform overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Approve new salons, manage plans and track subscription revenue.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="font-display text-3xl font-semibold">{stat.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link to="/admin/approvals" className="text-primary underline-offset-4 hover:underline">
          Review salon approvals
        </Link>
        <Link to="/admin/plans" className="text-primary underline-offset-4 hover:underline">
          Manage subscription plans
        </Link>
        <Link to="/admin/reports" className="text-primary underline-offset-4 hover:underline">
          Open reports
        </Link>
      </div>
    </div>
  );
}
