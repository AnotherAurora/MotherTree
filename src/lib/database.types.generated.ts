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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      awakener: {
        Row: {
          aliemus_regen: number | null
          atk: number | null
          con: number | null
          created_at: string | null
          crit_dmg: number | null
          crit_rate: number | null
          damage_amp: number | null
          death_resist: number | null
          def: number | null
          id: number
          name: string | null
          realm: Database["public"]["Enums"]["realm"] | null
          realm_mastery: number | null
          sigil_yield: number | null
          skey: number | null
          updated_at: string | null
        }
        Insert: {
          aliemus_regen?: number | null
          atk?: number | null
          con?: number | null
          created_at?: string | null
          crit_dmg?: number | null
          crit_rate?: number | null
          damage_amp?: number | null
          death_resist?: number | null
          def?: number | null
          id?: number
          name?: string | null
          realm?: Database["public"]["Enums"]["realm"] | null
          realm_mastery?: number | null
          sigil_yield?: number | null
          skey?: number | null
          updated_at?: string | null
        }
        Update: {
          aliemus_regen?: number | null
          atk?: number | null
          con?: number | null
          created_at?: string | null
          crit_dmg?: number | null
          crit_rate?: number | null
          damage_amp?: number | null
          death_resist?: number | null
          def?: number | null
          id?: number
          name?: string | null
          realm?: Database["public"]["Enums"]["realm"] | null
          realm_mastery?: number | null
          sigil_yield?: number | null
          skey?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      awakener_tag_manifestation: {
        Row: {
          awakener_id: number
          base_graded_value: number | null
          base_hits: number | null
          created_at: string | null
          deleted_at: string | null
          grading_logic: string | null
          id: number
          required_e: number | null
          required_realm: Database["public"]["Enums"]["realm"] | null
          source_type: Database["public"]["Enums"]["source_type"] | null
          stat_modifier: number | null
          tag_id: number
          updated_at: string | null
        }
        Insert: {
          awakener_id: number
          base_graded_value?: number | null
          base_hits?: number | null
          created_at?: string | null
          deleted_at?: string | null
          grading_logic?: string | null
          id?: number
          required_e?: number | null
          required_realm?: Database["public"]["Enums"]["realm"] | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          stat_modifier?: number | null
          tag_id: number
          updated_at?: string | null
        }
        Update: {
          awakener_id?: number
          base_graded_value?: number | null
          base_hits?: number | null
          created_at?: string | null
          deleted_at?: string | null
          grading_logic?: string | null
          id?: number
          required_e?: number | null
          required_realm?: Database["public"]["Enums"]["realm"] | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          stat_modifier?: number | null
          tag_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "awakener_tag_manifestation_awakener_id_fkey"
            columns: ["awakener_id"]
            isOneToOne: false
            referencedRelation: "awakener"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "awakener_tag_manifestation_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tag"
            referencedColumns: ["id"]
          },
        ]
      }
      desire: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: number
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: number
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: number
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      desire_demand: {
        Row: {
          base_priority_weight: number | null
          created_at: string | null
          curve: Database["public"]["Enums"]["curve_type"] | null
          decay_rate: number | null
          deleted_at: string | null
          desire_id: number
          id: number
          tag_id: number
          target_value: number | null
          updated_at: string | null
        }
        Insert: {
          base_priority_weight?: number | null
          created_at?: string | null
          curve?: Database["public"]["Enums"]["curve_type"] | null
          decay_rate?: number | null
          deleted_at?: string | null
          desire_id: number
          id?: number
          tag_id: number
          target_value?: number | null
          updated_at?: string | null
        }
        Update: {
          base_priority_weight?: number | null
          created_at?: string | null
          curve?: Database["public"]["Enums"]["curve_type"] | null
          decay_rate?: number | null
          deleted_at?: string | null
          desire_id?: number
          id?: number
          tag_id?: number
          target_value?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "desire_demand_desire_id_fkey"
            columns: ["desire_id"]
            isOneToOne: false
            referencedRelation: "desire"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desire_demand_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tag"
            referencedColumns: ["id"]
          },
        ]
      }
      manifestation_interaction_override: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: number
          is_disabled: boolean | null
          manifestation_id: number | null
          modifier_tag_id: number | null
          override_multiplier: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: number
          is_disabled?: boolean | null
          manifestation_id?: number | null
          modifier_tag_id?: number | null
          override_multiplier?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: number
          is_disabled?: boolean | null
          manifestation_id?: number | null
          modifier_tag_id?: number | null
          override_multiplier?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manifestation_interaction_override_manifestation_id_fkey"
            columns: ["manifestation_id"]
            isOneToOne: false
            referencedRelation: "awakener_tag_manifestation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manifestation_interaction_override_modifier_tag_id_fkey"
            columns: ["modifier_tag_id"]
            isOneToOne: false
            referencedRelation: "tag"
            referencedColumns: ["id"]
          },
        ]
      }
      path: {
        Row: {
          awakener_id: number
          desire_id: number
          id: number
        }
        Insert: {
          awakener_id: number
          desire_id: number
          id?: number
        }
        Update: {
          awakener_id?: number
          desire_id?: number
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "path_awakener_id_fkey"
            columns: ["awakener_id"]
            isOneToOne: false
            referencedRelation: "awakener"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "path_desire_id_fkey"
            columns: ["desire_id"]
            isOneToOne: false
            referencedRelation: "desire"
            referencedColumns: ["id"]
          },
        ]
      }
      tag: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: number
          tag_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: number
          tag_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: number
          tag_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tag_default_interaction: {
        Row: {
          created_at: string | null
          default_factor: number | null
          deleted_at: string | null
          exclusion_suffix: number | null
          id: number
          math_operation: Database["public"]["Enums"]["operation_type"]
          modifier_tag_id: number | null
          source_type: Database["public"]["Enums"]["source_type"] | null
          target_tag_id: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_factor?: number | null
          deleted_at?: string | null
          exclusion_suffix?: number | null
          id?: number
          math_operation?: Database["public"]["Enums"]["operation_type"]
          modifier_tag_id?: number | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          target_tag_id?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_factor?: number | null
          deleted_at?: string | null
          exclusion_suffix?: number | null
          id?: number
          math_operation?: Database["public"]["Enums"]["operation_type"]
          modifier_tag_id?: number | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          target_tag_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tag_default_interaction_exclusion_suffix_fkey"
            columns: ["exclusion_suffix"]
            isOneToOne: false
            referencedRelation: "tag"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_default_interaction_modifier_tag_id_fkey"
            columns: ["modifier_tag_id"]
            isOneToOne: false
            referencedRelation: "tag"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_default_interaction_target_tag_id_fkey"
            columns: ["target_tag_id"]
            isOneToOne: false
            referencedRelation: "tag"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      curve_type: "linear" | "exponential" | "logarithmic"
      operation_type:
        | "add_to_base_value"
        | "add_to_multiplier"
        | "compound_multiplier"
        | "add_hits"
      realm:
        | "chaos"
        | "caro"
        | "propagation caro"
        | "aequor"
        | "divine aequor"
        | "ultra"
        | "singularity ultra"
      source_type: "card" | "exalt" | "tentacle"
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
    Enums: {
      curve_type: ["linear", "exponential", "logarithmic"],
      operation_type: [
        "add_to_base_value",
        "add_to_multiplier",
        "compound_multiplier",
        "add_hits",
      ],
      realm: [
        "chaos",
        "caro",
        "propagation caro",
        "aequor",
        "divine aequor",
        "ultra",
        "singularity ultra",
      ],
      source_type: ["card", "exalt", "tentacle"],
    },
  },
} as const
