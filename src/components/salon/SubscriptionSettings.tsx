import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { currency, isoDate } from "@/lib/subscription";

type Plan = { id: string; plan_name: string; billing_cycle: string; price: number; duration_days: number | null };

export function SubscriptionSettings({ salonId, isOwner }: { salonId: string; isOwner: boolean }) {
  const queryClient = useQueryClient();
  const [planId, setPlanId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["salon", "subscriptions", salonId],
    queryFn: async () => {
      const [subs, plans] = await Promise.all([
        supabase
          .from("salon_subscriptions")
          .select("id, approval_status, amount_paid, start_date, end_date, rejection_reason, created_at, subscription_plans(plan_name)")
          .eq("salon_id", salonId)
          .order("created_at", { ascending: false }),
        supabase.from("subscription_plans").select("id, plan_name, billing_cycle, price, duration_days").eq("is_active", true),
      ]);
      if (subs.error) throw subs.error;
      if (plans.error) throw plans.error;
      return {
        subs: (subs.data ?? []) as unknown as {
          id: string;
          approval_status: string;
          amount_paid: number | null;
          start_date: string | null;
          end_date: string | null;
          rejection_reason: string | null;
          created_at: string | null;
          subscription_plans: { plan_name: string } | null;
        }[],
        plans: (plans.data ?? []) as Plan[],
      };
    },
  });

  const current = useMemo(() => data?.subs.find((s) => s.approval_status === "approved") ?? null, [data]);
  const today = isoDate(new Date());
  const expiringSoon =
    current?.end_date != null && current.end_date <= isoDate(new Date(Date.now() + 14 * 86400000));

  const renew = useMutation({
    mutationFn: async () => {
      if (!planId) throw new Error("Pick a plan");
      if (!file) throw new Error("Upload your payment screenshot");
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Please sign in again");

      const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "")}`;
      const upload = await supabase.storage.from("payment-proofs").upload(path, file);
      if (upload.error) throw upload.error;

      const plan = data?.plans.find((p) => p.id === planId);
      const { error } = await supabase.from("salon_subscriptions").insert({
        salon_id: salonId,
        plan_id: planId,
        payment_screenshot_url: path,
        amount_paid: plan?.price ?? null,
        approval_status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Renewal submitted — the platform team will review it shortly");
      setFile(null);
      void queryClient.invalidateQueries({ queryKey: ["salon", "subscriptions"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not submit the renewal"),
  });

  if (isLoading || !data) return <Skeleton className="h-56 w-full" />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current subscription</CardTitle>
          <CardDescription>Your plan, expiry date and submission history.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {current ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium">{current.subscription_plans?.plan_name ?? "Plan"}</p>
              <p className="text-muted-foreground">
                {current.start_date} → {current.end_date} · {currency(current.amount_paid)}
              </p>
              {current.end_date && current.end_date < today ? (
                <Badge variant="destructive">Expired</Badge>
              ) : expiringSoon ? (
                <Badge variant="secondary">Expiring soon — renew now</Badge>
              ) : (
                <Badge variant="secondary">Active</Badge>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No approved subscription yet.</p>
          )}

          <div className="space-y-1 pt-2 text-sm">
            {data.subs.map((sub) => (
              <div key={sub.id} className="flex flex-wrap items-center gap-2 border-t py-2 first:border-t-0">
                <span className="font-medium">{sub.subscription_plans?.plan_name ?? "Plan"}</span>
                <Badge variant="outline">{sub.approval_status}</Badge>
                <span className="text-muted-foreground">{sub.created_at?.slice(0, 10)}</span>
                {sub.rejection_reason && (
                  <span className="text-destructive">Reason: {sub.rejection_reason}</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Renew subscription</CardTitle>
            <CardDescription>
              Pay offline, then upload the payment screenshot. The platform team approves it and extends your
              expiry date.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {data.plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setPlanId(plan.id)}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                    planId === plan.id ? "border-primary bg-primary/5" : "hover:bg-accent"
                  }`}
                >
                  <p className="font-medium">{plan.plan_name}</p>
                  <p className="text-muted-foreground">
                    {currency(plan.price)} · {plan.billing_cycle}
                    {plan.billing_cycle === "manual" && plan.duration_days ? ` (${plan.duration_days} days)` : ""}
                  </p>
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="proof">Payment screenshot</Label>
              <Input
                id="proof"
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <Button onClick={() => renew.mutate()} disabled={renew.isPending}>
              <Upload className="size-4" /> Submit renewal
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
