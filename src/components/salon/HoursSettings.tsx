import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type HoursRow = {
  weekday: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
  break_start: string;
  break_end: string;
};

const blank = (weekday: number): HoursRow => ({
  weekday,
  is_open: weekday !== 0,
  open_time: "10:00",
  close_time: "20:00",
  break_start: "",
  break_end: "",
});

export function HoursSettings({ salonId, readOnly }: { salonId: string; readOnly: boolean }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<HoursRow[]>(() => WEEKDAYS.map((_, i) => blank(i)));
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["salon", "hours", salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_hours")
        .select("weekday, is_open, open_time, close_time, break_start, break_end")
        .eq("salon_id", salonId);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!data) return;
    setRows(
      WEEKDAYS.map((_, weekday) => {
        const row = data.find((r) => r.weekday === weekday);
        if (!row) return blank(weekday);
        return {
          weekday,
          is_open: row.is_open ?? true,
          open_time: (row.open_time ?? "10:00:00").slice(0, 5),
          close_time: (row.close_time ?? "20:00:00").slice(0, 5),
          break_start: row.break_start ? row.break_start.slice(0, 5) : "",
          break_end: row.break_end ? row.break_end.slice(0, 5) : "",
        };
      }),
    );
  }, [data]);

  const save = async () => {
    for (const row of rows) {
      if (row.is_open && row.close_time <= row.open_time) {
        toast.error(`${WEEKDAYS[row.weekday]}: closing time must be after opening time`);
        return;
      }
      if (row.break_start && row.break_end && row.break_end <= row.break_start) {
        toast.error(`${WEEKDAYS[row.weekday]}: break end must be after break start`);
        return;
      }
    }
    setSaving(true);
    const { error: deleteError } = await supabase.from("business_hours").delete().eq("salon_id", salonId);
    if (!deleteError) {
      const { error } = await supabase.from("business_hours").insert(
        rows.map((row) => ({
          salon_id: salonId,
          weekday: row.weekday,
          is_open: row.is_open,
          open_time: `${row.open_time}:00`,
          close_time: `${row.close_time}:00`,
          break_start: row.break_start ? `${row.break_start}:00` : null,
          break_end: row.break_end ? `${row.break_end}:00` : null,
        })),
      );
      if (error) {
        setSaving(false);
        toast.error("Could not save your business hours");
        return;
      }
    }
    setSaving(false);
    toast.success("Business hours saved");
    void queryClient.invalidateQueries({ queryKey: ["salon", "hours", salonId] });
  };

  const update = (weekday: number, patch: Partial<HoursRow>) =>
    setRows((current) => current.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row)));

  if (isLoading) return <Skeleton className="h-72 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Business hours</CardTitle>
        <CardDescription>
          Set opening times per day and an optional break window customers cannot book.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row) => (
          <div key={row.weekday} className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">{WEEKDAYS[row.weekday]}</p>
              <div className="flex items-center gap-2">
                <Switch
                  id={`open-${row.weekday}`}
                  checked={row.is_open}
                  disabled={readOnly}
                  onCheckedChange={(checked) => update(row.weekday, { is_open: checked })}
                />
                <Label htmlFor={`open-${row.weekday}`} className="text-sm text-muted-foreground">
                  {row.is_open ? "Open" : "Closed"}
                </Label>
              </div>
            </div>
            {row.is_open && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <TimeField
                  id={`open-time-${row.weekday}`}
                  label="Opens"
                  value={row.open_time}
                  disabled={readOnly}
                  onChange={(value) => update(row.weekday, { open_time: value })}
                />
                <TimeField
                  id={`close-time-${row.weekday}`}
                  label="Closes"
                  value={row.close_time}
                  disabled={readOnly}
                  onChange={(value) => update(row.weekday, { close_time: value })}
                />
                <TimeField
                  id={`break-start-${row.weekday}`}
                  label="Break from"
                  value={row.break_start}
                  disabled={readOnly}
                  onChange={(value) => update(row.weekday, { break_start: value })}
                />
                <TimeField
                  id={`break-end-${row.weekday}`}
                  label="Break to"
                  value={row.break_end}
                  disabled={readOnly}
                  onChange={(value) => update(row.weekday, { break_end: value })}
                />
              </div>
            )}
          </div>
        ))}
        {!readOnly && (
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save business hours"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function TimeField({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input id={id} type="time" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
