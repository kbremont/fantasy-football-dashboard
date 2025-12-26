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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      draft_media: {
        Row: {
          caption: string | null
          created_at: string | null
          display_order: number | null
          id: number
          media_type: string | null
          storage_path: string
          updated_at: string | null
          year: number
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: number
          media_type?: string | null
          storage_path: string
          updated_at?: string | null
          year: number
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: number
          media_type?: string | null
          storage_path?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      matchups: {
        Row: {
          created_at: string | null
          custom_points: number | null
          id: number
          matchup_id: number
          players: string[]
          players_points: Json | null
          points: number | null
          roster_id: number
          season_id: number
          starters: string[]
          updated_at: string | null
          week: number
        }
        Insert: {
          created_at?: string | null
          custom_points?: number | null
          id?: number
          matchup_id: number
          players: string[]
          players_points?: Json | null
          points?: number | null
          roster_id: number
          season_id: number
          starters: string[]
          updated_at?: string | null
          week: number
        }
        Update: {
          created_at?: string | null
          custom_points?: number | null
          id?: number
          matchup_id?: number
          players?: string[]
          players_points?: Json | null
          points?: number | null
          roster_id?: number
          season_id?: number
          starters?: string[]
          updated_at?: string | null
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "matchups_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      nfl_players: {
        Row: {
          age: number | null
          college: string | null
          created_at: string | null
          full_name: string
          player_id: string
          position: string | null
          team: string | null
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          age?: number | null
          college?: string | null
          created_at?: string | null
          full_name: string
          player_id: string
          position?: string | null
          team?: string | null
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          age?: number | null
          college?: string | null
          created_at?: string | null
          full_name?: string
          player_id?: string
          position?: string | null
          team?: string | null
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      player_team_history: {
        Row: {
          created_at: string | null
          effective_date: string
          id: number
          player_id: string
          source: string
          team: string | null
        }
        Insert: {
          created_at?: string | null
          effective_date: string
          id?: number
          player_id: string
          source: string
          team?: string | null
        }
        Update: {
          created_at?: string | null
          effective_date?: string
          id?: number
          player_id?: string
          source?: string
          team?: string | null
        }
        Relationships: []
      }
      rosters: {
        Row: {
          created_at: string | null
          owner_id: string
          roster_id: number
          team_name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          owner_id: string
          roster_id: number
          team_name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          owner_id?: string
          roster_id?: number
          team_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      seasons: {
        Row: {
          created_at: string | null
          id: number
          is_current: boolean | null
          season_year: number
          sleeper_league_id: string
          total_weeks: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          is_current?: boolean | null
          season_year: number
          sleeper_league_id: string
          total_weeks?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          is_current?: boolean | null
          season_year?: number
          sleeper_league_id?: string
          total_weeks?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          adds: Json | null
          created_at: string | null
          created_at_sleeper: number | null
          creator_id: string | null
          draft_picks: Json | null
          drops: Json | null
          id: number
          roster_ids: number[] | null
          season_id: number
          settings: Json | null
          status: Database["public"]["Enums"]["transaction_status"]
          transaction_id: string
          type: Database["public"]["Enums"]["transaction_type"]
          waiver_budget: Json | null
          week: number
        }
        Insert: {
          adds?: Json | null
          created_at?: string | null
          created_at_sleeper?: number | null
          creator_id?: string | null
          draft_picks?: Json | null
          drops?: Json | null
          id?: number
          roster_ids?: number[] | null
          season_id: number
          settings?: Json | null
          status: Database["public"]["Enums"]["transaction_status"]
          transaction_id: string
          type: Database["public"]["Enums"]["transaction_type"]
          waiver_budget?: Json | null
          week: number
        }
        Update: {
          adds?: Json | null
          created_at?: string | null
          created_at_sleeper?: number | null
          creator_id?: string | null
          draft_picks?: Json | null
          drops?: Json | null
          id?: number
          roster_ids?: number[] | null
          season_id?: number
          settings?: Json | null
          status?: Database["public"]["Enums"]["transaction_status"]
          transaction_id?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          waiver_budget?: Json | null
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_rosters: {
        Row: {
          created_at: string | null
          id: number
          player_ids: string[]
          roster_id: number
          season_id: number
          week: number
        }
        Insert: {
          created_at?: string | null
          id?: number
          player_ids: string[]
          roster_id: number
          season_id: number
          week: number
        }
        Update: {
          created_at?: string | null
          id?: number
          player_ids?: string[]
          roster_id?: number
          season_id?: number
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_rosters_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      invoke_sync_league_rosters: { Args: never; Returns: undefined }
      invoke_sync_nfl_players: { Args: never; Returns: undefined }
      invoke_sync_weekly_matchups: { Args: never; Returns: undefined }
      invoke_sync_weekly_transactions: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      transaction_status: "complete" | "failed" | "pending"
      transaction_type: "trade" | "free_agent" | "waiver" | "commissioner"
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
      transaction_status: ["complete", "failed", "pending"],
      transaction_type: ["trade", "free_agent", "waiver", "commissioner"],
    },
  },
} as const
