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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      awakener: {
        Row: {
          aliemus_regen: number | null
          atk: number | null
          base_aliemus: number | null
          con: number | null
          created_at: string | null
          crit_dmg: number | null
          crit_rate: number | null
          damage_amp: number | null
          death_resist: number | null
          def: number | null
          deleted_at: string | null
          enlightenment: number | null
          id: number
          keyflare_regen: number | null
          name: string | null
          realm: number | null
          realm_mastery: number | null
          sigil_yield: number | null
          updated_at: string | null
        }
        Insert: {
          aliemus_regen?: number | null
          atk?: number | null
          base_aliemus?: number | null
          con?: number | null
          created_at?: string | null
          crit_dmg?: number | null
          crit_rate?: number | null
          damage_amp?: number | null
          death_resist?: number | null
          def?: number | null
          deleted_at?: string | null
          enlightenment?: number | null
          id?: number
          keyflare_regen?: number | null
          name?: string | null
          realm?: number | null
          realm_mastery?: number | null
          sigil_yield?: number | null
          updated_at?: string | null
        }
        Update: {
          aliemus_regen?: number | null
          atk?: number | null
          base_aliemus?: number | null
          con?: number | null
          created_at?: string | null
          crit_dmg?: number | null
          crit_rate?: number | null
          damage_amp?: number | null
          death_resist?: number | null
          def?: number | null
          deleted_at?: string | null
          enlightenment?: number | null
          id?: number
          keyflare_regen?: number | null
          name?: string | null
          realm?: number | null
          realm_mastery?: number | null
          sigil_yield?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "awakener_realm_fkey"
            columns: ["realm"]
            isOneToOne: false
            referencedRelation: "realm"
            referencedColumns: ["id"]
          },
        ]
      }
      awakener_tag_manifestation: {
        Row: {
          awakener_id: number
          base_hits: number | null
          buff_target_type_restriction:
            | Database["public"]["Enums"]["source_type"]
            | null
          created_at: string | null
          deleted_at: string | null
          dependency_stat: Database["public"]["Enums"]["all_stats"] | null
          id: number
          is_accumulating: boolean
          is_permanent: boolean | null
          metadata: string | null
          replaces_manifestation_id: number | null
          required_enlightenment: number | null
          required_realm: number | null
          source_type: Database["public"]["Enums"]["source_type"] | null
          tag_id: number
          target_type: Database["public"]["Enums"]["target_type"] | null
          trigger_condition: number | null
          updated_at: string | null
          value_scalar: number | null
        }
        Insert: {
          awakener_id: number
          base_hits?: number | null
          buff_target_type_restriction?:
            | Database["public"]["Enums"]["source_type"]
            | null
          created_at?: string | null
          deleted_at?: string | null
          dependency_stat?: Database["public"]["Enums"]["all_stats"] | null
          id?: number
          is_accumulating?: boolean
          is_permanent?: boolean | null
          metadata?: string | null
          replaces_manifestation_id?: number | null
          required_enlightenment?: number | null
          required_realm?: number | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          tag_id: number
          target_type?: Database["public"]["Enums"]["target_type"] | null
          trigger_condition?: number | null
          updated_at?: string | null
          value_scalar?: number | null
        }
        Update: {
          awakener_id?: number
          base_hits?: number | null
          buff_target_type_restriction?:
            | Database["public"]["Enums"]["source_type"]
            | null
          created_at?: string | null
          deleted_at?: string | null
          dependency_stat?: Database["public"]["Enums"]["all_stats"] | null
          id?: number
          is_accumulating?: boolean
          is_permanent?: boolean | null
          metadata?: string | null
          replaces_manifestation_id?: number | null
          required_enlightenment?: number | null
          required_realm?: number | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          tag_id?: number
          target_type?: Database["public"]["Enums"]["target_type"] | null
          trigger_condition?: number | null
          updated_at?: string | null
          value_scalar?: number | null
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
            foreignKeyName: "awakener_tag_manifestation_replaces_manifestation_id_fkey"
            columns: ["replaces_manifestation_id"]
            isOneToOne: false
            referencedRelation: "awakener_tag_manifestation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "awakener_tag_manifestation_required_realm_fkey"
            columns: ["required_realm"]
            isOneToOne: false
            referencedRelation: "realm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "awakener_tag_manifestation_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tag"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "awakener_tag_manifestation_trigger_condition_fkey"
            columns: ["trigger_condition"]
            isOneToOne: false
            referencedRelation: "tag"
            referencedColumns: ["id"]
          },
        ]
      }
      covenant: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: number
          name: string
          stat: Database["public"]["Enums"]["all_stats"] | null
          stat_amount: number | null
          team_unique: boolean
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: number
          name: string
          stat?: Database["public"]["Enums"]["all_stats"] | null
          stat_amount?: number | null
          team_unique?: boolean
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: number
          name?: string
          stat?: Database["public"]["Enums"]["all_stats"] | null
          stat_amount?: number | null
          team_unique?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      covenant_tag_manifestation: {
        Row: {
          buff_target_type_restriction:
            | Database["public"]["Enums"]["source_type"]
            | null
          covenant_id: number | null
          created_at: string | null
          deleted_at: string | null
          dependency_stat: Database["public"]["Enums"]["all_stats"] | null
          id: number
          is_accumulating: boolean
          is_permanent: boolean | null
          metadata: string | null
          replaces_manifestation_id: number | null
          required_realm1: number | null
          required_realm2: number | null
          tag_id: number | null
          target_type: Database["public"]["Enums"]["target_type"] | null
          trigger_condition: number | null
          updated_at: string | null
          value_scalar: number | null
        }
        Insert: {
          buff_target_type_restriction?:
            | Database["public"]["Enums"]["source_type"]
            | null
          covenant_id?: number | null
          created_at?: string | null
          deleted_at?: string | null
          dependency_stat?: Database["public"]["Enums"]["all_stats"] | null
          id?: number
          is_accumulating?: boolean
          is_permanent?: boolean | null
          metadata?: string | null
          replaces_manifestation_id?: number | null
          required_realm1?: number | null
          required_realm2?: number | null
          tag_id?: number | null
          target_type?: Database["public"]["Enums"]["target_type"] | null
          trigger_condition?: number | null
          updated_at?: string | null
          value_scalar?: number | null
        }
        Update: {
          buff_target_type_restriction?:
            | Database["public"]["Enums"]["source_type"]
            | null
          covenant_id?: number | null
          created_at?: string | null
          deleted_at?: string | null
          dependency_stat?: Database["public"]["Enums"]["all_stats"] | null
          id?: number
          is_accumulating?: boolean
          is_permanent?: boolean | null
          metadata?: string | null
          replaces_manifestation_id?: number | null
          required_realm1?: number | null
          required_realm2?: number | null
          tag_id?: number | null
          target_type?: Database["public"]["Enums"]["target_type"] | null
          trigger_condition?: number | null
          updated_at?: string | null
          value_scalar?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "covenant_tag_manifestation_covenant_id_fkey"
            columns: ["covenant_id"]
            isOneToOne: false
            referencedRelation: "covenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "covenant_tag_manifestation_replaces_manifestation_id_fkey"
            columns: ["replaces_manifestation_id"]
            isOneToOne: false
            referencedRelation: "covenant_tag_manifestation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "covenant_tag_manifestation_required_realm1_fkey"
            columns: ["required_realm1"]
            isOneToOne: false
            referencedRelation: "realm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "covenant_tag_manifestation_required_realm2_fkey"
            columns: ["required_realm2"]
            isOneToOne: false
            referencedRelation: "realm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "covenant_tag_manifestation_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tag"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "covenant_tag_manifestation_trigger_condition_fkey"
            columns: ["trigger_condition"]
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
          description: string | null
          desire_type: Database["public"]["Enums"]["desire_type"] | null
          id: number
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          desire_type?: Database["public"]["Enums"]["desire_type"] | null
          id?: number
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          desire_type?: Database["public"]["Enums"]["desire_type"] | null
          id?: number
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      desire_anchored_awakener: {
        Row: {
          awakener_id: number
          created_at: string | null
          deleted_at: string | null
          desire_id: number
          id: number
          is_damage_dealer: boolean
          updated_at: string | null
        }
        Insert: {
          awakener_id: number
          created_at?: string | null
          deleted_at?: string | null
          desire_id: number
          id?: number
          is_damage_dealer?: boolean
          updated_at?: string | null
        }
        Update: {
          awakener_id?: number
          created_at?: string | null
          deleted_at?: string | null
          desire_id?: number
          id?: number
          is_damage_dealer?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "desire_anchored_awakener_awakener_id_fkey"
            columns: ["awakener_id"]
            isOneToOne: false
            referencedRelation: "awakener"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desire_anchored_awakener_desire_id_fkey"
            columns: ["desire_id"]
            isOneToOne: false
            referencedRelation: "desire"
            referencedColumns: ["id"]
          },
        ]
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
      desire_template: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          desire_id: number
          id: number
          posse_id: number | null
          slot1_awakener_id: number | null
          slot1_covenant_id: number | null
          slot1_wheel1_id: number | null
          slot1_wheel2_id: number | null
          slot2_awakener_id: number | null
          slot2_covenant_id: number | null
          slot2_wheel1_id: number | null
          slot2_wheel2_id: number | null
          slot3_awakener_id: number | null
          slot3_covenant_id: number | null
          slot3_wheel1_id: number | null
          slot3_wheel2_id: number | null
          slot4_awakener_id: number | null
          slot4_covenant_id: number | null
          slot4_wheel1_id: number | null
          slot4_wheel2_id: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          desire_id: number
          id?: number
          posse_id?: number | null
          slot1_awakener_id?: number | null
          slot1_covenant_id?: number | null
          slot1_wheel1_id?: number | null
          slot1_wheel2_id?: number | null
          slot2_awakener_id?: number | null
          slot2_covenant_id?: number | null
          slot2_wheel1_id?: number | null
          slot2_wheel2_id?: number | null
          slot3_awakener_id?: number | null
          slot3_covenant_id?: number | null
          slot3_wheel1_id?: number | null
          slot3_wheel2_id?: number | null
          slot4_awakener_id?: number | null
          slot4_covenant_id?: number | null
          slot4_wheel1_id?: number | null
          slot4_wheel2_id?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          desire_id?: number
          id?: number
          posse_id?: number | null
          slot1_awakener_id?: number | null
          slot1_covenant_id?: number | null
          slot1_wheel1_id?: number | null
          slot1_wheel2_id?: number | null
          slot2_awakener_id?: number | null
          slot2_covenant_id?: number | null
          slot2_wheel1_id?: number | null
          slot2_wheel2_id?: number | null
          slot3_awakener_id?: number | null
          slot3_covenant_id?: number | null
          slot3_wheel1_id?: number | null
          slot3_wheel2_id?: number | null
          slot4_awakener_id?: number | null
          slot4_covenant_id?: number | null
          slot4_wheel1_id?: number | null
          slot4_wheel2_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "desire_template_desire_id_fkey"
            columns: ["desire_id"]
            isOneToOne: true
            referencedRelation: "desire"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desire_template_posse_id_fkey"
            columns: ["posse_id"]
            isOneToOne: false
            referencedRelation: "posse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desire_template_slot1_awakener_id_fkey"
            columns: ["slot1_awakener_id"]
            isOneToOne: false
            referencedRelation: "awakener"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desire_template_slot1_covenant_id_fkey"
            columns: ["slot1_covenant_id"]
            isOneToOne: false
            referencedRelation: "covenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desire_template_slot1_wheel1_id_fkey"
            columns: ["slot1_wheel1_id"]
            isOneToOne: false
            referencedRelation: "wheel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desire_template_slot1_wheel2_id_fkey"
            columns: ["slot1_wheel2_id"]
            isOneToOne: false
            referencedRelation: "wheel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desire_template_slot2_awakener_id_fkey"
            columns: ["slot2_awakener_id"]
            isOneToOne: false
            referencedRelation: "awakener"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desire_template_slot2_covenant_id_fkey"
            columns: ["slot2_covenant_id"]
            isOneToOne: false
            referencedRelation: "covenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desire_template_slot2_wheel1_id_fkey"
            columns: ["slot2_wheel1_id"]
            isOneToOne: false
            referencedRelation: "wheel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desire_template_slot2_wheel2_id_fkey"
            columns: ["slot2_wheel2_id"]
            isOneToOne: false
            referencedRelation: "wheel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desire_template_slot3_awakener_id_fkey"
            columns: ["slot3_awakener_id"]
            isOneToOne: false
            referencedRelation: "awakener"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desire_template_slot3_covenant_id_fkey"
            columns: ["slot3_covenant_id"]
            isOneToOne: false
            referencedRelation: "covenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desire_template_slot3_wheel1_id_fkey"
            columns: ["slot3_wheel1_id"]
            isOneToOne: false
            referencedRelation: "wheel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desire_template_slot3_wheel2_id_fkey"
            columns: ["slot3_wheel2_id"]
            isOneToOne: false
            referencedRelation: "wheel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desire_template_slot4_awakener_id_fkey"
            columns: ["slot4_awakener_id"]
            isOneToOne: false
            referencedRelation: "awakener"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desire_template_slot4_covenant_id_fkey"
            columns: ["slot4_covenant_id"]
            isOneToOne: false
            referencedRelation: "covenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desire_template_slot4_wheel1_id_fkey"
            columns: ["slot4_wheel1_id"]
            isOneToOne: false
            referencedRelation: "wheel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desire_template_slot4_wheel2_id_fkey"
            columns: ["slot4_wheel2_id"]
            isOneToOne: false
            referencedRelation: "wheel"
            referencedColumns: ["id"]
          },
        ]
      }
      manifestation_interaction_override: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          dependency_stat: Database["public"]["Enums"]["all_stats"] | null
          id: number
          is_disabled: boolean | null
          manifestation_id: number | null
          math_operation: Database["public"]["Enums"]["operation_type"] | null
          modifier_tag_id: number | null
          target_type: Database["public"]["Enums"]["target_type"] | null
          updated_at: string | null
          value_scalar: number | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          dependency_stat?: Database["public"]["Enums"]["all_stats"] | null
          id?: number
          is_disabled?: boolean | null
          manifestation_id?: number | null
          math_operation?: Database["public"]["Enums"]["operation_type"] | null
          modifier_tag_id?: number | null
          target_type?: Database["public"]["Enums"]["target_type"] | null
          updated_at?: string | null
          value_scalar?: number | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          dependency_stat?: Database["public"]["Enums"]["all_stats"] | null
          id?: number
          is_disabled?: boolean | null
          manifestation_id?: number | null
          math_operation?: Database["public"]["Enums"]["operation_type"] | null
          modifier_tag_id?: number | null
          target_type?: Database["public"]["Enums"]["target_type"] | null
          updated_at?: string | null
          value_scalar?: number | null
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
      posse: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: number
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      posse_tag_manifestation: {
        Row: {
          buff_target_type_restriction:
            | Database["public"]["Enums"]["source_type"]
            | null
          created_at: string | null
          deleted_at: string | null
          dependency_stat: Database["public"]["Enums"]["all_stats"] | null
          group_key: string
          id: number
          is_accumulating: boolean
          is_permanent: boolean | null
          metadata: string | null
          posse_id: number | null
          required_awakener: number | null
          required_realm: number | null
          tag_id: number | null
          target_type: Database["public"]["Enums"]["target_type"] | null
          updated_at: string | null
          value_scalar: number | null
        }
        Insert: {
          buff_target_type_restriction?:
            | Database["public"]["Enums"]["source_type"]
            | null
          created_at?: string | null
          deleted_at?: string | null
          dependency_stat?: Database["public"]["Enums"]["all_stats"] | null
          group_key?: string
          id?: number
          is_accumulating?: boolean
          is_permanent?: boolean | null
          metadata?: string | null
          posse_id?: number | null
          required_awakener?: number | null
          required_realm?: number | null
          tag_id?: number | null
          target_type?: Database["public"]["Enums"]["target_type"] | null
          updated_at?: string | null
          value_scalar?: number | null
        }
        Update: {
          buff_target_type_restriction?:
            | Database["public"]["Enums"]["source_type"]
            | null
          created_at?: string | null
          deleted_at?: string | null
          dependency_stat?: Database["public"]["Enums"]["all_stats"] | null
          group_key?: string
          id?: number
          is_accumulating?: boolean
          is_permanent?: boolean | null
          metadata?: string | null
          posse_id?: number | null
          required_awakener?: number | null
          required_realm?: number | null
          tag_id?: number | null
          target_type?: Database["public"]["Enums"]["target_type"] | null
          updated_at?: string | null
          value_scalar?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "posse_tag_manifestation_posse_id_fkey"
            columns: ["posse_id"]
            isOneToOne: false
            referencedRelation: "posse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posse_tag_manifestation_required_awakener_fkey"
            columns: ["required_awakener"]
            isOneToOne: false
            referencedRelation: "awakener"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posse_tag_manifestation_required_realm_fkey"
            columns: ["required_realm"]
            isOneToOne: false
            referencedRelation: "realm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posse_tag_manifestation_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tag"
            referencedColumns: ["id"]
          },
        ]
      }
      realm: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: number
          name: string
          replace: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: number
          name: string
          replace?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: number
          name?: string
          replace?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "realm_replace_fkey"
            columns: ["replace"]
            isOneToOne: false
            referencedRelation: "realm"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_tag_manifestation: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: number
          is_accumulating: boolean
          is_permanent: boolean | null
          metadata: string | null
          realm_id: number
          required_realm_mode: Database["public"]["Enums"]["realm_match_mode"]
          tag_id: number
          updated_at: string | null
          value_scalar: number | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: number
          is_accumulating?: boolean
          is_permanent?: boolean | null
          metadata?: string | null
          realm_id: number
          required_realm_mode?: Database["public"]["Enums"]["realm_match_mode"]
          tag_id: number
          updated_at?: string | null
          value_scalar?: number | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: number
          is_accumulating?: boolean
          is_permanent?: boolean | null
          metadata?: string | null
          realm_id?: number
          required_realm_mode?: Database["public"]["Enums"]["realm_match_mode"]
          tag_id?: number
          updated_at?: string | null
          value_scalar?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "realm_tag_manifestation_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_tag_manifestation_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tag"
            referencedColumns: ["id"]
          },
        ]
      }
      tag: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: number
          is_additive: boolean
          is_percent: boolean
          layer: Database["public"]["Enums"]["layer"] | null
          tag_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: number
          is_additive?: boolean
          is_percent?: boolean
          layer?: Database["public"]["Enums"]["layer"] | null
          tag_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: number
          is_additive?: boolean
          is_percent?: boolean
          layer?: Database["public"]["Enums"]["layer"] | null
          tag_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tag_default_interaction: {
        Row: {
          buff_target_type_restriction:
            | Database["public"]["Enums"]["source_type"]
            | null
          created_at: string | null
          default_factor: number | null
          deleted_at: string | null
          exclusion_suffix: number | null
          id: number
          math_operation: Database["public"]["Enums"]["operation_type"]
          modifier_tag_id: number | null
          once_per_base: boolean
          substitute: boolean
          target_tag_id: number | null
          updated_at: string | null
        }
        Insert: {
          buff_target_type_restriction?:
            | Database["public"]["Enums"]["source_type"]
            | null
          created_at?: string | null
          default_factor?: number | null
          deleted_at?: string | null
          exclusion_suffix?: number | null
          id?: number
          math_operation?: Database["public"]["Enums"]["operation_type"]
          modifier_tag_id?: number | null
          once_per_base?: boolean
          substitute?: boolean
          target_tag_id?: number | null
          updated_at?: string | null
        }
        Update: {
          buff_target_type_restriction?:
            | Database["public"]["Enums"]["source_type"]
            | null
          created_at?: string | null
          default_factor?: number | null
          deleted_at?: string | null
          exclusion_suffix?: number | null
          id?: number
          math_operation?: Database["public"]["Enums"]["operation_type"]
          modifier_tag_id?: number | null
          once_per_base?: boolean
          substitute?: boolean
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
      wheel: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          enlightenment: number | null
          id: number
          name: string
          rarity: Database["public"]["Enums"]["rarity"] | null
          stat: Database["public"]["Enums"]["all_stats"] | null
          stat_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          enlightenment?: number | null
          id?: number
          name: string
          rarity?: Database["public"]["Enums"]["rarity"] | null
          stat?: Database["public"]["Enums"]["all_stats"] | null
          stat_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          enlightenment?: number | null
          id?: number
          name?: string
          rarity?: Database["public"]["Enums"]["rarity"] | null
          stat?: Database["public"]["Enums"]["all_stats"] | null
          stat_amount?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      wheel_tag_manifestation: {
        Row: {
          buff_target_type_restriction:
            | Database["public"]["Enums"]["source_type"]
            | null
          created_at: string | null
          deleted_at: string | null
          dependency_stat: Database["public"]["Enums"]["all_stats"] | null
          id: number
          is_accumulating: boolean
          is_permanent: boolean | null
          metadata: string | null
          required_realm: number | null
          tag_id: number | null
          target_type: Database["public"]["Enums"]["target_type"] | null
          trigger_condition: number | null
          updated_at: string | null
          value_scalar: number | null
          wheel_id: number | null
        }
        Insert: {
          buff_target_type_restriction?:
            | Database["public"]["Enums"]["source_type"]
            | null
          created_at?: string | null
          deleted_at?: string | null
          dependency_stat?: Database["public"]["Enums"]["all_stats"] | null
          id?: number
          is_accumulating?: boolean
          is_permanent?: boolean | null
          metadata?: string | null
          required_realm?: number | null
          tag_id?: number | null
          target_type?: Database["public"]["Enums"]["target_type"] | null
          trigger_condition?: number | null
          updated_at?: string | null
          value_scalar?: number | null
          wheel_id?: number | null
        }
        Update: {
          buff_target_type_restriction?:
            | Database["public"]["Enums"]["source_type"]
            | null
          created_at?: string | null
          deleted_at?: string | null
          dependency_stat?: Database["public"]["Enums"]["all_stats"] | null
          id?: number
          is_accumulating?: boolean
          is_permanent?: boolean | null
          metadata?: string | null
          required_realm?: number | null
          tag_id?: number | null
          target_type?: Database["public"]["Enums"]["target_type"] | null
          trigger_condition?: number | null
          updated_at?: string | null
          value_scalar?: number | null
          wheel_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wheel_tag_manifestation_required_realm_fkey"
            columns: ["required_realm"]
            isOneToOne: false
            referencedRelation: "realm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wheel_tag_manifestation_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tag"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wheel_tag_manifestation_trigger_condition_fkey"
            columns: ["trigger_condition"]
            isOneToOne: false
            referencedRelation: "tag"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wheel_tag_manifestation_wheel_id_fkey"
            columns: ["wheel_id"]
            isOneToOne: false
            referencedRelation: "wheel"
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
      all_stats:
        | "con"
        | "atk"
        | "def"
        | "keyflare_regen"
        | "damage_amp"
        | "crit_rate"
        | "crit_dmg"
        | "realm_mastery"
        | "aliemus_regen"
        | "sigil_yield"
        | "death_resist"
        | "team_max_hp"
        | "enemy_max_hp"
        | "base_aliemus"
      curve_type: "linear" | "exponential" | "logarithmic"
      desire_type: "general" | "specific"
      layer: "x" | "y" | "z" | "f"
      operation_type:
        | "presence_multiply"
        | "add_scaled"
        | "multiply_one_plus"
        | "multiply"
      rarity: "SSR" | "SR" | "R" | "N"
      realm_enum_obsolete:
        | "chaos"
        | "caro"
        | "propagation caro"
        | "aequor"
        | "divine aequor"
        | "ultra"
        | "singularity ultra"
      realm_match_mode: "present" | "exclusive"
      source_type: "command card" | "exalt" | "tentacle" | "rouse" | "talent"
      target_type: "self" | "single" | "aoe"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      all_stats: [
        "con",
        "atk",
        "def",
        "keyflare_regen",
        "damage_amp",
        "crit_rate",
        "crit_dmg",
        "realm_mastery",
        "aliemus_regen",
        "sigil_yield",
        "death_resist",
        "team_max_hp",
        "enemy_max_hp",
        "base_aliemus",
      ],
      curve_type: ["linear", "exponential", "logarithmic"],
      desire_type: ["general", "specific"],
      layer: ["x", "y", "z", "f"],
      operation_type: [
        "presence_multiply",
        "add_scaled",
        "multiply_one_plus",
        "multiply",
      ],
      rarity: ["SSR", "SR", "R", "N"],
      realm_enum_obsolete: [
        "chaos",
        "caro",
        "propagation caro",
        "aequor",
        "divine aequor",
        "ultra",
        "singularity ultra",
      ],
      realm_match_mode: ["present", "exclusive"],
      source_type: ["command card", "exalt", "tentacle", "rouse", "talent"],
      target_type: ["self", "single", "aoe"],
    },
  },
} as const
