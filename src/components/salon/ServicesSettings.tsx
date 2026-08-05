import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { currency } from "@/lib/subscription";

const serviceSchema = z.object({
  service_name: z.string().trim().min(2, "Enter a service name").max(80),
  price: z.number().min(0).max(1_000_000),
  duration_minutes: z.number().int().min(30).max(480),
});

export function ServicesSettings({ salonId, readOnly }: { salonId: string; readOnly: boolean }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("30");

  const { data: services } = useQuery({
    queryKey: ["salon", "services", salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, service_name, price, duration_minutes, is_active")
        .eq("salon_id", salonId)
        .order("service_name");
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["salon", "services", salonId] });

  const addService = useMutation({
    mutationFn: async () => {
      const parsed = serviceSchema.safeParse({
        service_name: name,
        price: Number(price),
        duration_minutes: Number(duration),
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the service details");
      const { error } = await supabase.from("services").insert({ salon_id: salonId, ...parsed.data });
      if (error) throw new Error("Could not add the service");
    },
    onSuccess: () => {
      toast.success("Service added");
      setName("");
      setPrice("");
      setDuration("30");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleService = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("services").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
  });

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
    onError: () => toast.error("This service has bookings — switch it off instead."),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Services</CardTitle>
        <CardDescription>Durations are in 30-minute blocks; longer services take consecutive slots.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!readOnly && (
          <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="service-name">Service</Label>
              <Input
                id="service-name"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder="Haircut & styling"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="service-price">Price</Label>
              <Input
                id="service-price"
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="service-duration">Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger id="service-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[30, 60, 90, 120, 150, 180].map((minutes) => (
                    <SelectItem key={minutes} value={String(minutes)}>
                      {minutes} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-4">
              <Button onClick={() => addService.mutate()} disabled={addService.isPending}>
                Add service
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {(services ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No services yet.</p>
          ) : (
            (services ?? []).map((service) => (
              <div key={service.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{service.service_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {currency(service.price)} · {service.duration_minutes} min
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={Boolean(service.is_active)}
                    disabled={readOnly}
                    aria-label="Service available"
                    onCheckedChange={(checked) => toggleService.mutate({ id: service.id, is_active: checked })}
                  />
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete service"
                      onClick={() => deleteService.mutate(service.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
