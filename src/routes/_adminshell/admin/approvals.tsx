import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { addDays, currency, cycleDays, isoDate } from "@/lib/subscription";

export const Route = createFileRoute("/_adminshell/admin/approvals")({
  head: () => ({
    meta: [
      { title: "Salon Approvals — SalonBook Admin" },
      { name: "description", content: "Review salon signups and renewal payment screenshots, then approve or reject." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Salon Approvals — SalonBook Admin" },
      { property: "og:description", content: "Review salon signups and renewals, then approve or reject." },
    ],
  }),
  component: ApprovalsPage,
});

type Submission = {
  id: string;
  salon_id: string;
  plan_id: string;
  payment_screenshot_url: string;
  amount_paid: number | null;
  cycle_override_days: number | null;
  approval_status: string;
  created_at: string | null;
  salons: {
    id: string;
    salon_name: string;
    owner_name: string;
    mobile_number: string;
    status: string;
  } | null;
  subscription_plans: { plan_name: string; billing_cycle: string; duration_days: number | null } | null;
};

function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [zoom, setZoom] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Submission | null>(null);
  const [reason, setReason] = useState("");
  const [planChoice, setPlanChoice] = useState<Record<string, string>>({});

  const { data: plans } = useQuery({
    queryKey: ["admin", "plans", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, plan_name, billing_cycle, price, duration_days")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["admin", "submissions", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salon_subscriptions")
        .select(
          "id, salon_id, plan_id, payment_screenshot_url, amount_paid, cycle_override_days, approval_status, created_at, salons(id, salon_name, owner_name, mobile_number, status), subscription_plans(plan_name, billing_cycle, duration_days)",
        )
        .eq("approval_status", tab)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Submission[];
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "submissions"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
  };

  const approve = useMutation({
    mutationFn: async (submission: Submission) => {
      const planId = planChoice[submission.id] ?? submission.plan_id;
      const plan = plans?.find((p) => p.id === planId);
      if (!plan) throw new Error("Choose a plan before approving");

      const days = submission.cycle_override_days ?? cycleDays(plan.billing_cycle, plan.duration_days);
      const start = new Date();
      const { data: userData } = await supabase.auth.getUser();

      const { error: subError } = await supabase
        .from("salon_subscriptions")
        .update({
          plan_id: planId,
          approval_status: "approved",
          approved_by: userData.user?.id ?? null,
          approved_at: new Date().toISOString(),
          start_date: isoDate(start),
          end_date: isoDate(addDays(start, days)),
          rejection_reason: null,
        })
        .eq("id", submission.id);
      if (subError) throw subError;

      const { error: salonError } = await supabase
        .from("salons")
        .update({ status: "active" })
        .eq("id", submission.salon_id);
      if (salonError) throw salonError;

      // Email is a courtesy — never fail the approval because it bounced.
      try {
        await emailSalonDecision({
          data: {
            salonId: submission.salon_id,
            decision: "approved",
            planName: plan.plan_name,
            endDate: isoDate(addDays(start, days)),
          },
        });
      } catch (err) {
        console.error("Approval email failed", err);
      }
    },

    onSuccess: () => {
      toast.success("Salon approved and now live on the booking directory");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reject = useMutation({
    mutationFn: async () => {
      const parsed = z.string().trim().min(5, "Give the salon a clear reason").max(500).safeParse(reason);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid reason");
      if (!rejecting) throw new Error("Nothing selected");

      const { data: userData } = await supabase.auth.getUser();
      const { error: subError } = await supabase
        .from("salon_subscriptions")
        .update({
          approval_status: "rejected",
          rejection_reason: parsed.data,
          approved_by: userData.user?.id ?? null,
          approved_at: new Date().toISOString(),
        })
        .eq("id", rejecting.id);
      if (subError) throw subError;

      const { error: salonError } = await supabase
        .from("salons")
        .update({ status: "rejected" })
        .eq("id", rejecting.salon_id);
      if (salonError) throw salonError;
    },
    onSuccess: () => {
      toast.success("Rejection sent to the salon owner");
      setRejecting(null);
      setReason("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Salon approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signups and renewals wait here until you review the payment screenshot.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : submissions && submissions.length > 0 ? (
        <div className="space-y-3">
          {submissions.map((submission) => (
            <Card key={submission.id}>
              <CardContent className="grid gap-4 p-5 sm:grid-cols-[10rem_1fr]">
                <ProofImage
                  path={submission.payment_screenshot_url}
                  onZoom={(url) => setZoom(url)}
                />
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {submission.salons?.salon_name ?? "Unknown salon"}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {submission.salons?.owner_name} · {submission.salons?.mobile_number}
                      </p>
                    </div>
                    <Badge
                      variant={
                        submission.approval_status === "approved"
                          ? "default"
                          : submission.approval_status === "rejected"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {submission.approval_status}
                    </Badge>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Requested plan: {submission.subscription_plans?.plan_name ?? "—"} · Paid{" "}
                    {currency(submission.amount_paid)}
                    {submission.cycle_override_days
                      ? ` · Override ${submission.cycle_override_days} days`
                      : ""}
                  </p>

                  {submission.approval_status === "pending" && (
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-48 space-y-1.5">
                        <Label htmlFor={`plan-${submission.id}`} className="text-xs">
                          Plan to activate
                        </Label>
                        <Select
                          value={planChoice[submission.id] ?? submission.plan_id}
                          onValueChange={(value) =>
                            setPlanChoice({ ...planChoice, [submission.id]: value })
                          }
                        >
                          <SelectTrigger id={`plan-${submission.id}`}>
                            <SelectValue placeholder="Choose plan" />
                          </SelectTrigger>
                          <SelectContent>
                            {(plans ?? []).map((plan) => (
                              <SelectItem key={plan.id} value={plan.id}>
                                {plan.plan_name} · {plan.billing_cycle}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={() => approve.mutate(submission)} disabled={approve.isPending}>
                        Approve
                      </Button>
                      <Button variant="outline" onClick={() => setRejecting(submission)}>
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nothing in the {tab} queue.
          </CardContent>
        </Card>
      )}

      <Dialog open={zoom !== null} onOpenChange={() => setZoom(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Payment screenshot</DialogTitle>
          </DialogHeader>
          {zoom && <img src={zoom} alt="Payment screenshot submitted by the salon" className="w-full rounded-md" />}
        </DialogContent>
      </Dialog>

      <Dialog open={rejecting !== null} onOpenChange={() => setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejecting?.salons?.salon_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (shown to the salon owner)</Label>
            <Textarea
              id="reason"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. The payment screenshot is unreadable. Please upload a clearer image."
            />
          </div>
          <Button onClick={() => reject.mutate()} disabled={reject.isPending} variant="destructive">
            {reject.isPending ? "Sending…" : "Reject salon"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProofImage({ path, onZoom }: { path: string; onZoom: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (/^https?:\/\//.test(path)) {
        if (active) setUrl(path);
        return;
      }
      const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 3600);
      if (active) setUrl(data?.signedUrl ?? null);
    })();
    return () => {
      active = false;
    };
  }, [path]);

  if (!url) {
    return <Skeleton className="aspect-[3/4] w-full rounded-md" />;
  }

  return (
    <button
      type="button"
      onClick={() => onZoom(url)}
      className="overflow-hidden rounded-md border transition-opacity hover:opacity-90"
    >
      <img src={url} alt="Payment screenshot thumbnail" className="aspect-[3/4] w-full object-cover" />
    </button>
  );
}
