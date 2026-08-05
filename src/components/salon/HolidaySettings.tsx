import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function HolidaySettings({ salonId, readOnly }: { salonId: string; readOnly: boolean }) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState<Date | undefined>();
  const [reason, setReason] = useState("");

  const { data: holidays } = useQuery({
    queryKey: ["salon", "holidays", salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salon_holidays")
        .select("id, holiday_date, reason")
        .eq("salon_id", salonId)
        .order("holiday_date");
      if (error) throw error;
      return data;
    },
  });

  const addHoliday = useMutation({
    mutationFn: async () => {
      if (!date) throw new Error("Pick a date on the calendar");
      const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const { error } = await supabase
        .from("salon_holidays")
        .insert({ salon_id: salonId, holiday_date: isoDate, reason: reason.trim() || null });
      if (error) throw new Error("That date is already marked as closed");
    },
    onSuccess: () => {
      toast.success("Holiday added");
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["salon", "holidays", salonId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeHoliday = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("salon_holidays").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["salon", "holidays", salonId] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Holidays</CardTitle>
        <CardDescription>Closed dates are hidden completely from the customer booking page.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            disabled={readOnly ? true : { before: new Date() }}
            className={cn("rounded-md border p-3 pointer-events-auto")}
          />
          <div className="space-y-2">
            <Label htmlFor="holiday-reason">Reason (optional)</Label>
            <Input
              id="holiday-reason"
              value={reason}
              maxLength={120}
              disabled={readOnly}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Diwali"
            />
          </div>
          <Button onClick={() => addHoliday.mutate()} disabled={readOnly || addHoliday.isPending}>
            Mark as closed
          </Button>
        </div>

        <div className="space-y-2">
          {(holidays ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No holidays added yet.</p>
          ) : (
            (holidays ?? []).map((holiday) => (
              <div key={holiday.id} className="flex items-center justify-between rounded-md border p-2.5">
                <div>
                  <p className="text-sm font-medium">
                    {new Date(`${holiday.holiday_date}T12:00:00Z`).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  {holiday.reason && <p className="text-xs text-muted-foreground">{holiday.reason}</p>}
                </div>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove holiday"
                    onClick={() => removeHoliday.mutate(holiday.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
