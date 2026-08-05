import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { inviteExecutive } from "@/lib/salon.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function StaffSettings({ salonId, isOwner }: { salonId: string; isOwner: boolean }) {
  const queryClient = useQueryClient();
  const invite = useServerFn(inviteExecutive);
  const [form, setForm] = useState({ fullName: "", email: "", mobile: "" });
  const [canManageSettings, setCanManageSettings] = useState(false);

  const { data: staff } = useQuery({
    queryKey: ["salon", "staff", salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salon_staff")
        .select("id, full_name, mobile_number, role, is_active, can_manage_settings")
        .eq("salon_id", salonId)
        .order("role");
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["salon", "staff", salonId] });

  const sendInvite = useMutation({
    mutationFn: async () => {
      await invite({
        data: {
          salonId,
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          mobile: form.mobile.trim(),
          canManageSettings,
        },
      });
    },
    onSuccess: () => {
      toast.success("Invitation sent — they'll receive an email to set their password");
      setForm({ fullName: "", email: "", mobile: "" });
      setCanManageSettings(false);
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateStaff = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { can_manage_settings?: boolean; is_active?: boolean };
    }) => {
      const { error } = await supabase.from("salon_staff").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
    onError: () => toast.error("Could not update this team member"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Team</CardTitle>
        <CardDescription>
          Executives handle day-to-day bookings. Give settings access only when you want them to change services,
          hours or staff.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isOwner && (
          <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="staff-name">Full name</Label>
              <Input
                id="staff-name"
                value={form.fullName}
                maxLength={80}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-email">Email</Label>
              <Input
                id="staff-email"
                type="email"
                value={form.email}
                maxLength={255}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-mobile">Mobile</Label>
              <Input
                id="staff-mobile"
                inputMode="tel"
                value={form.mobile}
                maxLength={16}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch id="staff-settings" checked={canManageSettings} onCheckedChange={setCanManageSettings} />
              <Label htmlFor="staff-settings" className="text-sm text-muted-foreground">
                Allow this executive to change salon settings
              </Label>
            </div>
            <div className="sm:col-span-3">
              <Button onClick={() => sendInvite.mutate()} disabled={sendInvite.isPending}>
                {sendInvite.isPending ? "Inviting…" : "Invite executive"}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {(staff ?? []).map((member) => (
            <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
              <div>
                <p className="font-medium">
                  {member.full_name} <Badge variant="secondary">{member.role}</Badge>
                </p>
                <p className="text-sm text-muted-foreground">{member.mobile_number}</p>
              </div>
              {isOwner && member.role !== "owner" && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={member.can_manage_settings}
                      aria-label="Can manage settings"
                      onCheckedChange={(checked) =>
                        updateStaff.mutate({ id: member.id, patch: { can_manage_settings: checked } })
                      }
                    />
                    <span className="text-xs text-muted-foreground">Settings access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={Boolean(member.is_active)}
                      aria-label="Active"
                      onCheckedChange={(checked) =>
                        updateStaff.mutate({ id: member.id, patch: { is_active: checked } })
                      }
                    />
                    <span className="text-xs text-muted-foreground">Active</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
