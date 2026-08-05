import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  salonId: string;
  latitude: number | null;
  longitude: number | null;
  readOnly: boolean;
};

const DEFAULT_POSITION: [number, number] = [12.9716, 77.5946];

export function LocationSettings({ salonId, latitude, longitude, readOnly }: Props) {
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<[number, number]>([
    latitude ?? DEFAULT_POSITION[0],
    longitude ?? DEFAULT_POSITION[1],
  ]);

  useEffect(() => {
    let cleanup = () => {};
    let cancelled = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current).setView(position, 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: '<div style="width:18px;height:18px;border-radius:9999px;background:hsl(0 72% 51%);border:3px solid white;box-shadow:0 1px 6px rgba(0,0,0,.4)"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const marker = L.marker(position, { draggable: !readOnly, icon }).addTo(map);

      marker.on("dragend", () => {
        const next = marker.getLatLng();
        setPosition([next.lat, next.lng]);
      });
      if (!readOnly) {
        map.on("click", (event: { latlng: { lat: number; lng: number } }) => {
          marker.setLatLng(event.latlng);
          setPosition([event.latlng.lat, event.latlng.lng]);
        });
      }

      window.setTimeout(() => map.invalidateSize(), 200);
      cleanup = () => map.remove();
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
    // The map is created once; position updates are driven through the marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("salons")
        .update({ latitude: position[0], longitude: position[1] })
        .eq("id", salonId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Location pin saved");
      void queryClient.invalidateQueries({ queryKey: ["salon"] });
    },
    onError: () => toast.error("Could not save the location"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Shop location</CardTitle>
        <CardDescription>
          Drag the pin (or tap the map) to your exact shop entrance. Customers get a Get directions link from
          this pin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div ref={containerRef} className="h-72 w-full overflow-hidden rounded-lg border" />
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-4" /> {position[0].toFixed(5)}, {position[1].toFixed(5)}
          </span>
          {!readOnly && (
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              Save pin
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
