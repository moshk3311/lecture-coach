// Generated from the Supabase schema (supabase gen types). Do not edit by hand.
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
      attempts: {
        Row: {
          accuracy: number | null
          ai_feedback: Json | null
          audio_path: string | null
          azure_raw: Json | null
          completeness: number | null
          created_at: string
          duration_sec: number
          filler_count: number | null
          fluency: number | null
          id: string
          lecture_id: string | null
          long_pause_count: number | null
          metrics: Json | null
          mode: string
          pron_score: number | null
          prosody: number | null
          recognized_text: string | null
          reference_text: string | null
          sentence_id: string | null
          slide_id: string | null
          user_id: string
          wpm: number | null
        }
        Insert: {
          accuracy?: number | null
          ai_feedback?: Json | null
          audio_path?: string | null
          azure_raw?: Json | null
          completeness?: number | null
          created_at?: string
          duration_sec: number
          filler_count?: number | null
          fluency?: number | null
          id?: string
          lecture_id?: string | null
          long_pause_count?: number | null
          metrics?: Json | null
          mode: string
          pron_score?: number | null
          prosody?: number | null
          recognized_text?: string | null
          reference_text?: string | null
          sentence_id?: string | null
          slide_id?: string | null
          user_id?: string
          wpm?: number | null
        }
        Update: {
          accuracy?: number | null
          ai_feedback?: Json | null
          audio_path?: string | null
          azure_raw?: Json | null
          completeness?: number | null
          created_at?: string
          duration_sec?: number
          filler_count?: number | null
          fluency?: number | null
          id?: string
          lecture_id?: string | null
          long_pause_count?: number | null
          metrics?: Json | null
          mode?: string
          pron_score?: number | null
          prosody?: number | null
          recognized_text?: string | null
          reference_text?: string | null
          sentence_id?: string | null
          slide_id?: string | null
          user_id?: string
          wpm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attempts_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_sentence_id_fkey"
            columns: ["sentence_id"]
            isOneToOne: false
            referencedRelation: "sentences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          lecture_id: string
          proposed_edit: Json | null
          role: string
          slide_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lecture_id: string
          proposed_edit?: Json | null
          role: string
          slide_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lecture_id?: string
          proposed_edit?: Json | null
          role?: string
          slide_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
        ]
      }
      lectures: {
        Row: {
          audience: string | null
          created_at: string
          id: string
          pptx_path: string | null
          status: string
          target_minutes: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audience?: string | null
          created_at?: string
          id?: string
          pptx_path?: string | null
          status?: string
          target_minutes?: number | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          audience?: string | null
          created_at?: string
          id?: string
          pptx_path?: string | null
          status?: string
          target_minutes?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sentences: {
        Row: {
          change_notes: Json | null
          id: string
          lecture_id: string
          original_text: string | null
          position: number
          ref_audio_path: string | null
          ref_audio_slow_path: string | null
          ref_voice: string | null
          ref_word_timings: Json | null
          slide_id: string | null
          starts_paragraph: boolean
          text: string
          updated_at: string
        }
        Insert: {
          change_notes?: Json | null
          id?: string
          lecture_id: string
          original_text?: string | null
          position: number
          ref_audio_path?: string | null
          ref_audio_slow_path?: string | null
          ref_voice?: string | null
          ref_word_timings?: Json | null
          slide_id?: string | null
          starts_paragraph?: boolean
          text: string
          updated_at?: string
        }
        Update: {
          change_notes?: Json | null
          id?: string
          lecture_id?: string
          original_text?: string | null
          position?: number
          ref_audio_path?: string | null
          ref_audio_slow_path?: string | null
          ref_voice?: string | null
          ref_word_timings?: Json | null
          slide_id?: string | null
          starts_paragraph?: boolean
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sentences_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sentences_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
        ]
      }
      slides: {
        Row: {
          id: string
          image_path: string | null
          intent_notes: string | null
          keywords: string[] | null
          lecture_id: string
          memo_level: number
          planned_seconds: number | null
          position: number
          source_notes: string | null
          source_text: string | null
          title: string | null
          transition_line: string | null
        }
        Insert: {
          id?: string
          image_path?: string | null
          intent_notes?: string | null
          keywords?: string[] | null
          lecture_id: string
          memo_level?: number
          planned_seconds?: number | null
          position: number
          source_notes?: string | null
          source_text?: string | null
          title?: string | null
          transition_line?: string | null
        }
        Update: {
          id?: string
          image_path?: string | null
          intent_notes?: string | null
          keywords?: string[] | null
          lecture_id?: string
          memo_level?: number
          planned_seconds?: number | null
          position?: number
          source_notes?: string | null
          source_text?: string | null
          title?: string | null
          transition_line?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slides_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          azure_minutes_cap: number
          privacy_ack: boolean
          send_audio_to_llm: boolean
          slow_rate: string
          user_id: string
          voice: string
        }
        Insert: {
          azure_minutes_cap?: number
          privacy_ack?: boolean
          send_audio_to_llm?: boolean
          slow_rate?: string
          user_id?: string
          voice?: string
        }
        Update: {
          azure_minutes_cap?: number
          privacy_ack?: boolean
          send_audio_to_llm?: boolean
          slow_rate?: string
          user_id?: string
          voice?: string
        }
        Relationships: []
      }
      weak_items: {
        Row: {
          avg_accuracy: number | null
          id: string
          kind: string
          last_practiced_at: string | null
          last_seen_at: string | null
          occurrences: number
          recent_scores: number[]
          status: string
          user_id: string
          value: string
        }
        Insert: {
          avg_accuracy?: number | null
          id?: string
          kind: string
          last_practiced_at?: string | null
          last_seen_at?: string | null
          occurrences?: number
          recent_scores?: number[]
          status?: string
          user_id?: string
          value: string
        }
        Update: {
          avg_accuracy?: number | null
          id?: string
          kind?: string
          last_practiced_at?: string | null
          last_seen_at?: string | null
          occurrences?: number
          recent_scores?: number[]
          status?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      word_results: {
        Row: {
          accuracy: number | null
          attempt_id: string
          duration_ms: number | null
          error_type: string | null
          id: number
          offset_ms: number | null
          phonemes: Json | null
          position: number
          word: string
        }
        Insert: {
          accuracy?: number | null
          attempt_id: string
          duration_ms?: number | null
          error_type?: string | null
          id?: never
          offset_ms?: number | null
          phonemes?: Json | null
          position: number
          word: string
        }
        Update: {
          accuracy?: number | null
          attempt_id?: string
          duration_ms?: number | null
          error_type?: string | null
          id?: never
          offset_ms?: number | null
          phonemes?: Json | null
          position?: number
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "word_results_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_daily_progress: {
        Row: {
          accuracy: number | null
          attempts: number | null
          day: string | null
          fluency: number | null
          minutes: number | null
          pron_score: number | null
          prosody: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_month_usage: {
        Row: {
          attempts: number | null
          minutes: number | null
          month_start: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_phoneme_stats: {
        Row: {
          avg_accuracy: number | null
          occurrences: number | null
          phoneme: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      import_slides: {
        Args: { p_lecture_id: string; p_slides: Json }
        Returns: number
      }
      ping: { Args: never; Returns: string }
      save_attempt: { Args: { p: Json }; Returns: string }
      save_slide_script: {
        Args: { p_sentences: Json; p_slide_id: string }
        Returns: {
          change_notes: Json | null
          id: string
          lecture_id: string
          original_text: string | null
          position: number
          ref_audio_path: string | null
          ref_audio_slow_path: string | null
          ref_voice: string | null
          ref_word_timings: Json | null
          slide_id: string | null
          starts_paragraph: boolean
          text: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "sentences"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
