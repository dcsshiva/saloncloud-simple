export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          customer_mobile: string
          customer_name: string
          decline_reason: string | null
          id: string
          otp_verified: boolean | null
          salon_id: string
          service_id: string
          slot_end_time: string
          slot_start_time: string
          status: string
        }
        Insert: {
          appointment_date: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          customer_mobile: string
          customer_name: string
          decline_reason?: string | null
          id?: string
          otp_verified?: boolean | null
          salon_id: string
          service_id: string
          slot_end_time: string
          slot_start_time: string
          status?: string
        }
        Update: {
          appointment_date?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          customer_mobile?: string
          customer_name?: string
          decline_reason?: string | null
          id?: string
          otp_verified?: boolean | null
          salon_id?: string
          service_id?: string
          slot_end_time?: string
          slot_start_time?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "salon_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          break_end: string | null
          break_start: string | null
          close_time: string | null
          id: string
          is_open: boolean | null
          open_time: string | null
          salon_id: string
          weekday: number
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          close_time?: string | null
          id?: string
          is_open?: boolean | null
          open_time?: string | null
          salon_id: string
          weekday: number
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          close_time?: string | null
          id?: string
          is_open?: boolean | null
          open_time?: string | null
          salon_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          appointment_id: string | null
          body: string
          created_at: string | null
          id: string
          is_read: boolean | null
          salon_id: string
          title: string
        }
        Insert: {
          appointment_id?: string | null
          body: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          salon_id: string
          title: string
        }
        Update: {
          appointment_id?: string | null
          body?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          salon_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_verifications: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          is_verified: boolean | null
          mobile_number: string
          otp_code: string
          purpose: string
          reference_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          is_verified?: boolean | null
          mobile_number: string
          otp_code: string
          purpose?: string
          reference_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          is_verified?: boolean | null
          mobile_number?: string
          otp_code?: string
          purpose?: string
          reference_id?: string | null
        }
        Relationships: []
      }
      salon_holidays: {
        Row: {
          holiday_date: string
          id: string
          reason: string | null
          salon_id: string
        }
        Insert: {
          holiday_date: string
          id?: string
          reason?: string | null
          salon_id: string
        }
        Update: {
          holiday_date?: string
          id?: string
          reason?: string | null
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_holidays_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_staff: {
        Row: {
          created_at: string | null
          full_name: string
          id: string
          is_active: boolean | null
          mobile_number: string
          role: string
          salon_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          mobile_number: string
          role?: string
          salon_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          mobile_number?: string
          role?: string
          salon_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_staff_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_subscriptions: {
        Row: {
          amount_paid: number | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          cycle_override_days: number | null
          end_date: string | null
          id: string
          payment_screenshot_url: string
          plan_id: string
          rejection_reason: string | null
          salon_id: string
          start_date: string | null
        }
        Insert: {
          amount_paid?: number | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          cycle_override_days?: number | null
          end_date?: string | null
          id?: string
          payment_screenshot_url: string
          plan_id: string
          rejection_reason?: string | null
          salon_id: string
          start_date?: string | null
        }
        Update: {
          amount_paid?: number | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          cycle_override_days?: number | null
          end_date?: string | null
          id?: string
          payment_screenshot_url?: string
          plan_id?: string
          rejection_reason?: string | null
          salon_id?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salon_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_subscriptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salons: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          mobile_number: string
          owner_name: string
          owner_user_id: string
          salon_name: string
          status: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          mobile_number: string
          owner_name: string
          owner_user_id: string
          salon_name: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          mobile_number?: string
          owner_name?: string
          owner_user_id?: string
          salon_name?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string | null
          duration_minutes: number
          id: string
          is_active: boolean | null
          price: number | null
          salon_id: string
          service_name: string
        }
        Insert: {
          created_at?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          price?: number | null
          salon_id: string
          service_name: string
        }
        Update: {
          created_at?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          price?: number | null
          salon_id?: string
          service_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          billing_cycle: string
          created_at: string | null
          duration_days: number | null
          id: string
          is_active: boolean | null
          plan_name: string
          price: number
        }
        Insert: {
          billing_cycle: string
          created_at?: string | null
          duration_days?: number | null
          id?: string
          is_active?: boolean | null
          plan_name: string
          price: number
        }
        Update: {
          billing_cycle?: string
          created_at?: string | null
          duration_days?: number | null
          id?: string
          is_active?: boolean | null
          plan_name?: string
          price?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
