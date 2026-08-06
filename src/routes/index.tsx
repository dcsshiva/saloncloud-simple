import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, ShieldCheck, Smartphone, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SalonBook — Booking Software for Salons" },
      {
        name: "description",
        content:
          "Multi-tenant salon booking platform: manage services, staff and 30-minute appointment slots. Customers book with a mobile OTP, no account needed.",
      },
      { property: "og:title", content: "SalonBook — Booking Software for Salons" },
      {
        property: "og:description",
        content:
          "Multi-tenant salon booking platform: manage services, staff and 30-minute appointment slots. Customers book with a mobile OTP, no account needed.",
      },
    ],
  }),
  component: Index,
});

const features = [
  {
    icon: Store,
    title: "Every salon its own space",
    body: "Services, staff, working hours and holidays stay private to each salon.",
  },
  {
    icon: CalendarCheck,
    title: "30-minute slot booking",
    body: "Customers pick a service and slot; your team approves or declines it.",
  },
  {
    icon: Smartphone,
    title: "OTP, not passwords",
    body: "Customers verify with a mobile OTP — no account, no friction.",
  },
  {
    icon: ShieldCheck,
    title: "Approved by the platform",
    body: "Salons go live only after the platform team reviews their payment proof.",
  },
];

function Index() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <span className="font-display text-xl font-semibold tracking-tight">SalonBook</span>
        <Button asChild variant="ghost" size="sm">
          <Link to="/login">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-16 pt-6 sm:pt-14">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Salon appointment platform
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
          Bookings your salon can actually keep up with.
        </h1>
        <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
          SalonBook gives each salon a public booking page, slot-based scheduling and an approval
          queue — while the platform team keeps subscriptions and salon onboarding under control.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/signup">List your salon</Link>
          </Button>
        </div>
      </section>

      <section className="border-t bg-card">
        <div className="mx-auto grid max-w-6xl gap-4 px-5 py-14 sm:grid-cols-2">
          {features.map((feature) => (
            <Card key={feature.title} className="border-border/70 shadow-none">
              <CardContent className="flex gap-4 p-6">
                <feature.icon className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
                <div>
                  <h2 className="text-base font-semibold">{feature.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{feature.body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 py-10 text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} SalonBook
      </footer>
    </main>
  );
}
