import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign In — SalonBook" },
      { name: "description", content: "Sign in to SalonBook to manage your salon's appointments, services and staff." },
      { property: "og:title", content: "Sign In — SalonBook" },
      { property: "og:description", content: "Sign in to SalonBook." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
      if (error) throw error;
      const userId = data.user.id;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "super_admin");
      if (roles && roles.length > 0) {
        void navigate({ to: "/admin" });
        return;
      }

      const { data: staff } = await supabase
        .from("salon_staff")
        .select("id, salon_id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();

      if (staff) {
        const { data: salon } = await supabase
          .from("salons")
          .select("status")
          .eq("id", staff.salon_id)
          .maybeSingle();
        if (salon?.status === "pending_approval") {
          setPending(true);
          return;
        }
        void navigate({ to: "/app" });
        return;
      }

      await supabase.auth.signOut();
      toast.error("This account isn't linked to any salon or admin access");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!z.string().email().safeParse(email).success) {
      toast.error("Enter your email first");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    toast[error ? "error" : "success"](error ? error.message : "Password reset link sent");
  };

  if (pending) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">Pending approval</CardTitle>
            <CardDescription>
              Your salon is under review. You'll be notified once approved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                await supabase.auth.signOut();
                setPending(false);
              }}
            >
              Sign out
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Sign in</CardTitle>
          <CardDescription>Use your SalonBook email and password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <div className="mt-4 flex items-center justify-between text-sm">
            <button type="button" onClick={resetPassword} className="text-muted-foreground hover:underline">
              Forgot password?
            </button>
            <Link to="/signup" className="text-primary underline-offset-4 hover:underline">
              List your salon
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
