import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/salons")({
  head: () => ({
    meta: [
      { title: "Find a salon and book a slot | SalonBook" },
      {
        name: "description",
        content:
          "Browse salons taking online bookings, pick a service and a 30-minute slot, and confirm with a quick mobile OTP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Find a salon and book a slot | SalonBook" },
      {
        property: "og:description",
        content: "Browse salons taking online bookings and reserve a 30-minute slot in seconds.",
      },
    ],
  }),
  component: SalonDirectory,
});

type PublicSalon = {
  id: string;
  salon_name: string;
  slug: string;
  address: string | null;
  logo_url: string | null;
};

function SalonDirectory() {
  const [term, setTerm] = useState("");

  const { data: salons, isLoading } = useQuery({
    queryKey: ["public-salons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salons")
        .select("id, salon_name, slug, address, logo_url")
        .eq("status", "active")
        .order("salon_name");
      if (error) throw error;
      return (data ?? []) as PublicSalon[];
    },
  });

  const filtered = useMemo(() => {
    const query = term.trim().toLowerCase();
    if (!query) return salons ?? [];
    return (salons ?? []).filter(
      (s) =>
        s.salon_name.toLowerCase().includes(query) ||
        (s.address ?? "").toLowerCase().includes(query),
    );
  }, [salons, term]);

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold">Book a salon</h1>
        <p className="text-sm text-muted-foreground">
          Pick a salon, choose a service and a 30-minute slot. No account needed — just a mobile OTP.
        </p>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          className="pl-9"
          placeholder="Search by salon name or area"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          aria-label="Search salons"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {salons && salons.length > 0
              ? "No salons match your search."
              : "No salons are taking online bookings yet. Please check back soon."}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((salon) => (
            <li key={salon.id}>
              <Card className="transition-colors hover:bg-accent/40">
                <CardContent className="flex items-center gap-4 p-4">
                  {salon.logo_url ? (
                    <img
                      src={salon.logo_url}
                      alt={`${salon.salon_name} logo`}
                      loading="lazy"
                      className="size-14 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div
                      className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-display text-lg font-semibold text-primary"
                      aria-hidden
                    >
                      {salon.salon_name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold">{salon.salon_name}</h2>
                    {salon.address && (
                      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        <span className="line-clamp-2">{salon.address}</span>
                      </p>
                    )}
                  </div>
                  <Button asChild size="sm">
                    <Link to="/book/$salonSlug" params={{ salonSlug: salon.slug }}>
                      Book
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Button asChild variant="ghost" className="w-full">
        <Link to="/booking-status">Check an existing booking</Link>
      </Button>
    </main>
  );
}
