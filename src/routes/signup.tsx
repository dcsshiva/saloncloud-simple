import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Upload } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { sendOtp } from "@/lib/otp.functions";
import { registerSalon } from "@/lib/salon.functions";
import { currency } from "@/lib/subscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/signup")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "List Your Salon — SalonBook" },
      {
        name: "description",
        content: "Register your salon on SalonBook, pick a subscription plan and start taking online bookings.",
      },
      { property: "og:title", content: "List Your Salon — SalonBook" },
      { property: "og:description", content: "Register your salon and start taking online bookings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignupPage,
});

const detailsSchema = z.object({
  salonName: z.string().trim().min(2, "Enter your salon name").max(120),
  ownerName: z.string().trim().min(2, "Enter the owner name").max(80),
  mobile: z.string().trim().regex(/^\+?[0-9]{10,15}$/, "Enter a valid mobile with country code"),
  email: z.string().trim().email("Enter a valid email").max(255),
  address: z.string().trim().min(5, "Enter your salon address").max(400),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

function SignupPage() {
  const navigate = useNavigate();
  const send = useServerFn(sendOtp);
  const register = useServerFn(registerSalon);

  const [form, setForm] = useState({
    salonName: "",
    ownerName: "",
    mobile: "",
    email: "",
    address: "",
    password: "",
  });
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [planId, setPlanId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(Boolean(session)));
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data: plans } = useQuery({
    queryKey: ["public", "plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, plan_name, billing_cycle, price, duration_days")
        .eq("is_active", true)
        .order("price");
      if (error) throw error;
      return data;
    },
  });

  const selectedPlan = useMemo(() => plans?.find((p) => p.id === planId) ?? null, [plans, planId]);

  const requestOtp = async () => {
    const mobile = form.mobile.trim();
    if (!/^\+?[0-9]{10,15}$/.test(mobile)) {
      toast.error("Enter a valid mobile number with country code");
      return;
    }
    setBusy(true);
    try {
      const result = await send({ data: { mobile, purpose: "salon_signup" } });
      setOtpSent(true);
      toast.success(
        result.delivered
          ? "Verification code sent by SMS"
          : `SMS provider not connected yet — your code is ${result.previewCode}`,
        { duration: result.delivered ? 4000 : 12000 },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the code");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = detailsSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    if (!/^[0-9]{6}$/.test(otpCode)) {
      toast.error("Verify your mobile number with the 6-digit code");
      return;
    }
    if (!selectedPlan) {
      toast.error("Choose a subscription plan");
      return;
    }
    if (!file) {
      toast.error("Upload your payment screenshot");
      return;
    }

    setBusy(true);
    try {
      let { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: window.location.origin + "/signup" },
        });
        if (signUpError) {
          if (signUpError.message.toLowerCase().includes("already")) {
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email: parsed.data.email,
              password: parsed.data.password,
            });
            if (signInError) throw new Error("This email already has an account. Sign in first.");
          } else {
            throw signUpError;
          }
        }
        if (!signUpData?.session) {
          const { data: retry } = await supabase.auth.getSession();
          if (!retry.session) {
            setNeedsEmailConfirm(true);
            setBusy(false);
            return;
          }
        }
        sessionData = (await supabase.auth.getSession()).data;
      }

      const userId = sessionData.session!.user.id;
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${userId}/${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(path, file, {
        contentType: file.type || "image/png",
      });
      if (uploadError) throw new Error("Could not upload the payment screenshot.");

      await register({
        data: {
          salonName: parsed.data.salonName,
          ownerName: parsed.data.ownerName,
          mobile: parsed.data.mobile,
          email: parsed.data.email,
          address: parsed.data.address,
          planId: selectedPlan.id,
          amountPaid: Number(selectedPlan.price),
          screenshotPath: path,
          otpCode,
        },
      });
      setDone(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not complete your signup");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
        <CheckCircle2 className="size-14 text-primary" />
        <h1 className="mt-6 font-display text-3xl font-semibold">Your salon is under review</h1>
        <p className="mt-3 text-muted-foreground">
          You'll be notified once approved. You can log in anytime to check your status.
        </p>
        <Button className="mt-8" onClick={() => void navigate({ to: "/app" })}>
          Go to my dashboard
        </Button>
      </main>
    );
  }

  if (needsEmailConfirm) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="font-display text-3xl font-semibold">Confirm your email</h1>
        <p className="mt-3 text-muted-foreground">
          We sent a confirmation link to {form.email}. Click it, sign in, then come back to this page to finish your
          registration — your details are one step away.
        </p>
        <Button className="mt-8" variant="outline" onClick={() => setNeedsEmailConfirm(false)}>
          Back to the form
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold">List your salon on SalonBook</h1>
        <p className="mt-2 text-muted-foreground">
          Register, upload your payment proof and go live once our team approves you.
        </p>
        {authed && (
          <Badge variant="secondary" className="mt-3">
            Signed in — finish your salon details below
          </Badge>
        )}
      </header>

      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Salon details</CardTitle>
            <CardDescription>This is what customers will see on your booking page.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field id="salonName" label="Salon name">
              <Input
                id="salonName"
                value={form.salonName}
                maxLength={120}
                onChange={(e) => setForm({ ...form, salonName: e.target.value })}
              />
            </Field>
            <Field id="ownerName" label="Owner name">
              <Input
                id="ownerName"
                value={form.ownerName}
                maxLength={80}
                onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
              />
            </Field>
            <Field id="email" label="Email">
              <Input
                id="email"
                type="email"
                value={form.email}
                maxLength={255}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field id="password" label="Password">
              <Input
                id="password"
                type="password"
                value={form.password}
                maxLength={72}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field id="address" label="Address">
                <Textarea
                  id="address"
                  value={form.address}
                  maxLength={400}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Verify your mobile</CardTitle>
            <CardDescription>We send a 6-digit code, the same way customers verify bookings.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="min-w-52 flex-1">
              <Field id="mobile" label="Mobile number">
                <Input
                  id="mobile"
                  inputMode="tel"
                  placeholder="+919876543210"
                  value={form.mobile}
                  maxLength={16}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                />
              </Field>
            </div>
            <Button type="button" variant="outline" onClick={requestOtp} disabled={busy}>
              {otpSent ? "Resend code" : "Send OTP"}
            </Button>
            {otpSent && (
              <div className="min-w-40">
                <Field id="otp" label="6-digit code">
                  <Input
                    id="otp"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  />
                </Field>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Choose your plan</CardTitle>
            <CardDescription>Pay offline, then upload the payment screenshot below.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {(plans ?? []).map((plan) => (
              <button
                type="button"
                key={plan.id}
                onClick={() => setPlanId(plan.id)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  planId === plan.id ? "border-primary bg-primary/5" : "hover:bg-accent"
                }`}
              >
                <p className="font-semibold">{plan.plan_name}</p>
                <p className="text-sm text-muted-foreground">
                  {plan.billing_cycle === "manual" ? `${plan.duration_days} days` : plan.billing_cycle}
                </p>
                <p className="mt-2 font-display text-2xl font-semibold">{currency(plan.price)}</p>
              </button>
            ))}
            {plans?.length === 0 && (
              <p className="text-sm text-muted-foreground">No plans are published yet. Please check back soon.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment screenshot</CardTitle>
            <CardDescription>Only our platform admins can view this file.</CardDescription>
          </CardHeader>
          <CardContent>
            <Label
              htmlFor="proof"
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-4 text-sm"
            >
              <Upload className="size-5 text-muted-foreground" />
              {file ? file.name : "Choose an image of your payment confirmation"}
            </Label>
            <Input
              id="proof"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Submitting…" : "Submit for approval"}
          </Button>
          <Link to="/login" className="text-sm text-primary underline-offset-4 hover:underline">
            Already registered? Sign in
          </Link>
        </div>
      </form>
    </main>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
