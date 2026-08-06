import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { currency } from "@/lib/subscription";

export const Route = createFileRoute("/_adminshell/admin/plans")({
  head: () => ({
    meta: [
      { title: "Subscription Plans — SalonBook Admin" },
      { name: "description", content: "Create and manage salon subscription plans, pricing and billing cycles." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Subscription Plans — SalonBook Admin" },
      { property: "og:description", content: "Create and manage salon subscription plans, pricing and billing cycles." },
    ],
  }),
  component: PlansPage,
});

type Plan = {
  id: string;
  plan_name: string;
  billing_cycle: string;
  price: number;
  duration_days: number | null;
  is_active: boolean | null;
};

const planSchema = z
  .object({
    plan_name: z.string().trim().min(1, "Plan name is required").max(80),
    billing_cycle: z.enum(["trial", "monthly", "annual", "manual"]),
    price: z.number().min(0, "Price cannot be negative").max(10_000_000),
    duration_days: z.number().int().positive().max(3650).nullable(),
  })
  .refine((v) => v.billing_cycle !== "manual" || v.duration_days !== null, {
    message: "Manual plans need a custom duration in days",
    path: ["duration_days"],
  });

const emptyForm = {
  plan_name: "",
  billing_cycle: "monthly" as "trial" | "monthly" | "annual" | "manual",
  price: "",
  duration_days: "",
};

function PlansPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin", "plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, plan_name, billing_cycle, price, duration_days, is_active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Plan[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "plans"] });

  const savePlan = useMutation({
    mutationFn: async () => {
      const isTrial = editing?.billing_cycle === "trial";
      const parsed = planSchema.safeParse({
        plan_name: form.plan_name,
        billing_cycle: isTrial ? "trial" : form.billing_cycle,
        price: isTrial ? 0 : Number(form.price),
        duration_days: isTrial
          ? (editing?.duration_days ?? 30)
          : form.billing_cycle === "manual"
            ? Number(form.duration_days) || null
            : null,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid plan");

      if (editing) {
        const { error } = await supabase.from("subscription_plans").update(parsed.data).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("subscription_plans").insert(parsed.data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Plan updated" : "Plan created");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("subscription_plans").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
    onError: (error: Error) => toast.error(error.message),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subscription_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plan deleted");
      void invalidate();
    },
    onError: () => toast.error("This plan is in use by a salon and cannot be deleted."),
  });

  const startEdit = (plan: Plan) => {
    setEditing(plan);
    setForm({
      plan_name: plan.plan_name,
      billing_cycle: plan.billing_cycle as typeof emptyForm.billing_cycle,
      price: String(plan.price),
      duration_days: plan.duration_days ? String(plan.duration_days) : "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Subscription plans</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Free trial, monthly, annual, or manual plans with any custom period you define.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setForm(emptyForm);
            setOpen(true);
          }}
        >
          <Plus className="size-4" /> New plan
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : plans && plans.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{plan.plan_name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {plan.billing_cycle === "trial"
                        ? `Free trial · ${plan.duration_days ?? 30} days`
                        : plan.billing_cycle === "manual"
                        ? `Manual · ${plan.duration_days} days`
                        : plan.billing_cycle === "annual"
                          ? "Annual · 365 days"
                          : "Monthly · 30 days"}
                    </p>
                  </div>
                  <Badge variant={plan.is_active ? "default" : "secondary"}>
                    {plan.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="font-display text-2xl font-semibold">{currency(plan.price)}</p>
                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`active-${plan.id}`}
                      checked={Boolean(plan.is_active)}
                      onCheckedChange={(checked) =>
                        toggleActive.mutate({ id: plan.id, is_active: checked })
                      }
                    />
                    <Label htmlFor={`active-${plan.id}`} className="text-sm text-muted-foreground">
                      Available to salons
                    </Label>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(plan)} aria-label="Edit plan">
                      <Pencil className="size-4" />
                    </Button>
                    {plan.billing_cycle !== "trial" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deletePlan.mutate(plan.id)}
                        aria-label="Delete plan"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No plans yet. Create your first subscription plan.
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit plan" : "New plan"}</DialogTitle>
            <DialogDescription>
              Manual plans let you set any custom period, for example 45 or 90 days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="plan_name">Plan name</Label>
              <Input
                id="plan_name"
                value={form.plan_name}
                maxLength={80}
                onChange={(e) => setForm({ ...form, plan_name: e.target.value })}
              />
            </div>
            {editing?.billing_cycle === "trial" ? (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                The free trial is the mandatory default for every new salon. Its price is locked at ₹0
                and it cannot be deleted.
              </p>
            ) : (
            <div className="space-y-2">
              <Label htmlFor="billing_cycle">Billing cycle</Label>
              <Select
                value={form.billing_cycle}
                onValueChange={(value) =>
                  setForm({ ...form, billing_cycle: value as typeof emptyForm.billing_cycle })
                }
              >
                <SelectTrigger id="billing_cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="manual">Manual (custom days)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                min="0"
                disabled={editing?.billing_cycle === "trial"}
                value={editing?.billing_cycle === "trial" ? "0" : form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            {editing?.billing_cycle !== "trial" && form.billing_cycle === "manual" && (
              <div className="space-y-2">
                <Label htmlFor="duration_days">Duration (days)</Label>
                <Input
                  id="duration_days"
                  type="number"
                  min="1"
                  value={form.duration_days}
                  onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => savePlan.mutate()} disabled={savePlan.isPending}>
              {savePlan.isPending ? "Saving…" : "Save plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
