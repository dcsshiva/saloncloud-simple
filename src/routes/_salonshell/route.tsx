import { useEffect } from "react";
import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Bell, CalendarDays, LogOut, Settings } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { alertUser, readPrefs } from "@/lib/ringtone";
import { useSalon } from "@/lib/use-salon";


export const Route = createFileRoute("/_salonshell")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  component: SalonShell,
});

function SalonShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: context } = useSalon();
  const salonId = context?.salon.id;

  const { data: unread } = useQuery({
    queryKey: ["salon", "notifications", "unread", salonId],
    enabled: Boolean(salonId),
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("salon_id", salonId!)
        .eq("is_read", false);
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!salonId) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }

    const channel = supabase
      .channel(`salon-${salonId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "appointments", filter: `salon_id=eq.${salonId}` },
        (payload) => {
          const row = payload.new as { customer_name?: string };
          const who = row.customer_name ?? "A customer";
          toast.info(`New booking request from ${who}`, { duration: 10000 });
          // Ringtone + OS banner. Sound needs the one-time unlock in Settings → Alerts.
          alertUser("New booking request", `${who} requested an appointment`, readPrefs());
          void queryClient.invalidateQueries({ queryKey: ["salon"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "appointments", filter: `salon_id=eq.${salonId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["salon"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [salonId, queryClient]);



  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/login", replace: true });
  };

  const pending = context?.salon.status !== "active";

  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-0">
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold">
              {context?.salon.salon_name ?? "SalonBook"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {context?.staff.role === "owner" ? "Owner" : "Executive"} · {context?.staff.full_name}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <div className="relative">
              <Bell className="size-5 text-muted-foreground" />
              {(unread ?? 0) > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
                  {unread}
                </span>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
        {pending && context && (
          <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
            <Badge variant="secondary" className="mr-2">
              {context.salon.status === "rejected" ? "Rejected" : "Pending approval"}
            </Badge>
            {context.salon.status === "rejected"
              ? "Your submission was rejected. Upload a new payment proof from Settings."
              : "Your salon is under review. You'll be notified once approved."}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-card sm:hidden">
        <Link
          to="/app"
          activeOptions={{ exact: true }}
          className="flex flex-1 flex-col items-center gap-1 py-2 text-xs text-muted-foreground"
          activeProps={{ className: "text-primary" }}
        >
          <CalendarDays className="size-5" /> Today
        </Link>
        <Link
          to="/app/settings"
          className="flex flex-1 flex-col items-center gap-1 py-2 text-xs text-muted-foreground"
          activeProps={{ className: "text-primary" }}
        >
          <Settings className="size-5" /> Settings
        </Link>
      </nav>

      <nav className="fixed left-1/2 top-3 z-30 hidden -translate-x-1/2 gap-2 sm:flex">
        <Link
          to="/app"
          activeOptions={{ exact: true }}
          className="rounded-full bg-card px-4 py-1.5 text-sm shadow-sm"
          activeProps={{ className: "bg-primary text-primary-foreground" }}
        >
          Today
        </Link>
        <Link
          to="/app/settings"
          className="rounded-full bg-card px-4 py-1.5 text-sm shadow-sm"
          activeProps={{ className: "bg-primary text-primary-foreground" }}
        >
          Settings
        </Link>
      </nav>
    </div>
  );
}
