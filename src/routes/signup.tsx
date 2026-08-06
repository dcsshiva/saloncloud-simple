import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { sendSignupOtp, submitSalonSignup, verifySignupOtp } from "@/lib/signup.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/signup")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "List Your Salon — SalonBook" },
      {
        name: "description",
        content:
          "Register your salon on SalonBook in a minute. Your first month is free — no payment needed to get started.",
      },
      { property: "og:title", content: "List Your Salon — SalonBook" },
      { property: "og:description", content: "Register your salon and start taking online bookings. First month free." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignupPage,
});

const formSchema = z.object({
  salonName: z.string().trim().min(2, "Enter your salon name").max(120),
  contactName: z.string().trim().min(2, "Enter the contact name").max(80),
  mobile: z.string().trim().regex(/^\+?[0-9]{10,15}$/, "Enter a valid contact number"),
  email: z.string().trim().email("Enter a valid email").max(255),
});

function SignupPage() {
  const navigate = useNavigate();
  const sendCode = useServerFn(sendSignupOtp);
  const verifyCode = useServerFn(verifySignupOtp);
  const submitSignup = useServerFn(submitSalonSignup);

  const [form, setForm] = useState({ salonName: "", contactName: "", mobile: "", email: "" });
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const { data: plans } = useQuery({
    queryKey: ["public", "plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, plan_name, billing_cycle, price, duration_days")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const planFor = (cycle: string) => plans?.find((p) => p.billing_cycle === cycle) ?? null;

  const requestOtp = async () => {
    const email = form.email.trim();
    if (!z.string().email().safeParse(email).success) {
      toast.error("Enter a valid email first");
      return;
    }
    setBusy(true);
    try {
      await sendCode({
        data: form.salonName.trim() ? { email, salonName: form.salonName.trim() } : { email },
      });
      setOtpSent(true);
      setVerified(false);
      toast.success("We emailed you a 4-digit code");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the code");
    } finally {
      setBusy(false);
    }
  };

  const confirmOtp = async () => {
    if (!/^[0-9]{4}$/.test(otp)) {
      toast.error("Enter the 4-digit code");
      return;
    }
    setBusy(true);
    try {
      await verifyCode({ data: { email: form.email.trim(), code: otp } });
      setVerified(true);
      toast.success("Email verified");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not verify the code");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    if (!verified) {
      toast.error("Verify your email with the 4-digit code first");
      return;
    }
    setBusy(true);
    try {
      await submitSignup({ data: parsed.data });
      setDone(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not register your salon");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-12 text-center">
        <CheckCircle2 className="size-12 text-primary" />
        <h1 className="mt-5 font-display text-2xl font-semibold">Your salon is under review</h1>
        <p className="mt-2 text-muted-foreground">
          You'll be notified once approved. Your first month starts free — no payment needed.
        </p>
        <Button className="mt-8" variant="outline" onClick={() => void navigate({ to: "/" })}>
          Back to home
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-3xl font-semibold">List your salon</h1>
      <p className="mt-2 text-muted-foreground">
        Tell us about your salon, verify your email, and we'll review your listing.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-xl">Salon details</CardTitle>
          <CardDescription>All fields are required.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="salonName">Salon name</Label>
              <Input
                id="salonName"
                value={form.salonName}
                maxLength={120}
                onChange={(e) => setForm({ ...form, salonName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">Contact name</Label>
              <Input
                id="contactName"
                value={form.contactName}
                maxLength={80}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile">Contact number</Label>
              <Input
                id="mobile"
                inputMode="tel"
                placeholder="+919876543210"
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  disabled={verified}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value });
                    setVerified(false);
                    setOtpSent(false);
                  }}
                />
                <Button type="button" variant="outline" onClick={requestOtp} disabled={busy || verified}>
                  {otpSent ? "Resend OTP" : "Send OTP"}
                </Button>
              </div>
            </div>

            {otpSent && !verified && (
              <div className="space-y-2">
                <Label htmlFor="otp">4-digit code</Label>
                <div className="flex gap-2">
                  <Input
                    id="otp"
                    inputMode="numeric"
                    maxLength={4}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    className="max-w-32 tracking-[0.4em]"
                  />
                  <Button type="button" variant="secondary" onClick={confirmOtp} disabled={busy}>
                    Verify
                  </Button>
                </div>
              </div>
            )}

            {verified && (
              <p className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="size-4" /> Email verified
              </p>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : "Submit for review"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already listed?{" "}
            <Link to="/login" className="text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">Pricing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nothing to pay now — every new salon starts on the free trial.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Card className="border-primary/40">
            <CardContent className="space-y-1.5 p-5">
              <Badge>Included</Badge>
              <h3 className="text-lg font-semibold">Free Trial</h3>
              <p className="font-display text-2xl font-semibold">₹0</p>
              <p className="text-sm text-muted-foreground">
                Your first month is completely free. No payment needed to get started.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1.5 p-5">
              <h3 className="text-lg font-semibold">Monthly</h3>
              <p className="font-display text-2xl font-semibold">
                ₹{Number(planFor("monthly")?.price ?? 200)}
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </p>
              <p className="text-sm text-muted-foreground">Pay month to month after your trial ends.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1.5 p-5">
              <h3 className="text-lg font-semibold">Annual</h3>
              <p className="font-display text-2xl font-semibold">
                ₹{Number(planFor("annual")?.price ?? 2000)}
                <span className="text-sm font-normal text-muted-foreground">/year</span>
              </p>
              <p className="text-sm text-muted-foreground">Best value for salons booking all year round.</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
