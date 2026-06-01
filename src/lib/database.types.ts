export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      awakener: {
        Row: {
          aliemus_regen: number | null;
          atk: number | null;
          con: number | null;
          created_at: string | null;
          crit_dmg: number | null;
          crit_rate: number | null;
          damage_amp: number | null;
          death_resist: number | null;
          def: number | null;
          id: number;
          name: string | null;
          realm: Database["public"]["Enums"]["realm"] | null;
          realm_mastery: number | null;
          sigil_yield: number | null;
          skey: number | null;
          updated_at: string | null;
        };
        Insert: {
          aliemus_regen?: number | null;
          atk?: number | null;
          con?: number | null;
          created_at?: string | null;
          crit_dmg?: number | null;
          crit_rate?: number | null;
          damage_amp?: number | null;
          death_resist?: number | null;
          def?: number | null;
          id: number;
          name?: string | null;
          realm?: Database["public"]["Enums"]["realm"] | null;
          realm_mastery?: number | null;
          sigil_yield?: number | null;
          skey?: number | null;
          updated_at?: string | null;
        };
        Update: {
          aliemus_regen?: number | null;
          atk?: number | null;
          con?: number | null;
          created_at?: string | null;
          crit_dmg?: number | null;
          crit_rate?: number | null;
          damage_amp?: number | null;
          death_resist?: number | null;
          def?: number | null;
          id?: number;
          name?: string | null;
          realm?: Database["public"]["Enums"]["realm"] | null;
          realm_mastery?: number | null;
          sigil_yield?: number | null;
          skey?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      awakener_tag_manifestation: {
        Row: {
          awakener_id: number;
          base_graded_value: number | null;
          base_hits: number | null;
          created_at: string | null;
          deleted_at: string | null;
          grading_logic: string | null;
          id: number;
          required_e: number | null;
          required_realm: Database["public"]["Enums"]["realm"] | null;
          stat_modifier: number | null;
          tag_id: number;
          updated_at: string | null;
        };
        Insert: {
          awakener_id: number;
          base_graded_value?: number | null;
          base_hits?: number | null;
          created_at?: string | null;
          deleted_at?: string | null;
          grading_logic?: string | null;
          id: number;
          required_e?: number | null;
          required_realm?: Database["public"]["Enums"]["realm"] | null;
          stat_modifier?: number | null;
          tag_id: number;
          updated_at?: string | null;
        };
        Update: {
          awakener_id?: number;
          base_graded_value?: number | null;
          base_hits?: number | null;
          created_at?: string | null;
          deleted_at?: string | null;
          grading_logic?: string | null;
          id?: number;
          required_e?: number | null;
          required_realm?: Database["public"]["Enums"]["realm"] | null;
          stat_modifier?: number | null;
          tag_id?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "awakener_tag_manifestation_awakener_id_fkey";
            columns: ["awakener_id"];
            isOneToOne: false;
            referencedRelation: "awakener";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "awakener_tag_manifestation_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tag";
            referencedColumns: ["id"];
          },
        ];
      };
      desire: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          id: number;
          name: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          id: number;
          name?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          id?: number;
          name?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      desire_demand: {
        Row: {
          base_priority_weight: number | null;
          created_at: string | null;
          curve: Database["public"]["Enums"]["curve_type"] | null;
          decay_rate: number | null;
          deleted_at: string | null;
          desire_id: number;
          id: number;
          tag_id: number;
          target_value: number | null;
          updated_at: string | null;
        };
        Insert: {
          base_priority_weight?: number | null;
          created_at?: string | null;
          curve?: Database["public"]["Enums"]["curve_type"] | null;
          decay_rate?: number | null;
          deleted_at?: string | null;
          desire_id: number;
          id: number;
          tag_id: number;
          target_value?: number | null;
          updated_at?: string | null;
        };
        Update: {
          base_priority_weight?: number | null;
          created_at?: string | null;
          curve?: Database["public"]["Enums"]["curve_type"] | null;
          decay_rate?: number | null;
          deleted_at?: string | null;
          desire_id?: number;
          id?: number;
          tag_id?: number;
          target_value?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "desire_demand_desire_id_fkey";
            columns: ["desire_id"];
            isOneToOne: false;
            referencedRelation: "desire";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "desire_demand_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tag";
            referencedColumns: ["id"];
          },
        ];
      };
      manifestation_interaction_override: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          id: number;
          is_disabled: boolean | null;
          manifestation_id: number | null;
          modifier_tag_id: number | null;
          override_multiplier: number | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          id: number;
          is_disabled?: boolean | null;
          manifestation_id?: number | null;
          modifier_tag_id?: number | null;
          override_multiplier?: number | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          id?: number;
          is_disabled?: boolean | null;
          manifestation_id?: number | null;
          modifier_tag_id?: number | null;
          override_multiplier?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "manifestation_interaction_override_manifestation_id_fkey";
            columns: ["manifestation_id"];
            isOneToOne: false;
            referencedRelation: "awakener_tag_manifestation";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "manifestation_interaction_override_modifier_tag_id_fkey";
            columns: ["modifier_tag_id"];
            isOneToOne: false;
            referencedRelation: "tag";
            referencedColumns: ["id"];
          },
        ];
      };
      path: {
        Row: {
          awakener_id: number;
          desire_id: number;
          id: number;
        };
        Insert: {
          awakener_id: number;
          desire_id: number;
          id: number;
        };
        Update: {
          awakener_id?: number;
          desire_id?: number;
          id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "path_awakener_id_fkey";
            columns: ["awakener_id"];
            isOneToOne: false;
            referencedRelation: "awakener";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "path_desire_id_fkey";
            columns: ["desire_id"];
            isOneToOne: false;
            referencedRelation: "desire";
            referencedColumns: ["id"];
          },
        ];
      };
      tag: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          id: number;
          tag_name: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          id: number;
          tag_name?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          id?: number;
          tag_name?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      tag_default_interaction: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          id: number;
          interaction_type: Database["public"]["Enums"]["interaction"] | null;
          interaction_value: number | null;
          modifier_tag_id: number | null;
          target_tag_id: number | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          id: number;
          interaction_type?: Database["public"]["Enums"]["interaction"] | null;
          interaction_value?: number | null;
          modifier_tag_id?: number | null;
          target_tag_id?: number | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          id?: number;
          interaction_type?: Database["public"]["Enums"]["interaction"] | null;
          interaction_value?: number | null;
          modifier_tag_id?: number | null;
          target_tag_id?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tag_default_interaction_modifier_tag_id_fkey";
            columns: ["modifier_tag_id"];
            isOneToOne: false;
            referencedRelation: "tag";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tag_default_interaction_target_tag_id_fkey";
            columns: ["target_tag_id"];
            isOneToOne: false;
            referencedRelation: "tag";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      curve_type: "linear" | "exponential" | "logarithmic";
      interaction: "multiplier" | "add_hits" | "add_flat";
      realm:
        | "chaos"
        | "caro"
        | "propagation caro"
        | "aequor"
        | "divine aequor"
        | "ultra"
        | "singularity ultra";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type TableName = keyof Database["public"]["Tables"];

export type TableRow<T extends TableName> = Database["public"]["Tables"][T]["Row"];

export type EnumName = keyof Database["public"]["Enums"];

export const ENUM_VALUES: Record<EnumName, readonly string[]> = {
  curve_type: ["linear", "exponential", "logarithmic"],
  interaction: ["multiplier", "add_hits", "add_flat"],
  realm: [
    "chaos",
    "caro",
    "propagation caro",
    "aequor",
    "divine aequor",
    "ultra",
    "singularity ultra",
  ],
} as const;
