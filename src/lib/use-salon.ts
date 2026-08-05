import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SalonContext = {
  salon: {
    id: string;
    salon_name: string;
    owner_name: string;
    mobile_number: string;
    email: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    slug: string;
    status: string;
    timezone: string;
  };
  staff: { id: string; role: string; full_name: string; can_manage_settings: boolean };
};

/** Loads the signed-in staff member's salon, or null when they have none yet. */
export function useSalon() {
  return useQuery({
    queryKey: ["salon", "context"],
    queryFn: async (): Promise<SalonContext | null> => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return null;

      const { data: staff, error } = await supabase
        .from("salon_staff")
        .select("id, role, full_name, can_manage_settings, salon_id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      if (!staff) return null;

      const { data: salon, error: salonError } = await supabase
        .from("salons")
        .select(
          "id, salon_name, owner_name, mobile_number, email, address, latitude, longitude, slug, status, timezone",
        )
        .eq("id", staff.salon_id)
        .maybeSingle();
      if (salonError || !salon) return null;

      return {
        salon: salon as SalonContext["salon"],
        staff: {
          id: staff.id,
          role: staff.role,
          full_name: staff.full_name,
          can_manage_settings: staff.can_manage_settings,
        },
      };
    },
  });
}
