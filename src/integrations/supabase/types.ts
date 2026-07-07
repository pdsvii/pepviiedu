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
      admin_allowlist: {
        Row: {
          created_at: string
          email: string
          note: string | null
        }
        Insert: {
          created_at?: string
          email: string
          note?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          note?: string | null
        }
        Relationships: []
      }
      assignment_questions: {
        Row: {
          assignment_id: string
          position: number
          question_id: string
        }
        Insert: {
          assignment_id: string
          position?: number
          question_id: string
        }
        Update: {
          assignment_id?: string
          position?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_questions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          class_id: string
          created_at: string
          due_at: string | null
          id: string
          teacher_id: string
          title: string
        }
        Insert: {
          class_id: string
          created_at?: string
          due_at?: string | null
          id?: string
          teacher_id: string
          title: string
        }
        Update: {
          class_id?: string
          created_at?: string
          due_at?: string | null
          id?: string
          teacher_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_answers: {
        Row: {
          ai_feedback: string | null
          attempt_id: string
          correct: boolean | null
          created_at: string
          id: string
          question_id: string
          response: Json | null
          score: number | null
          teacher_override: number | null
        }
        Insert: {
          ai_feedback?: string | null
          attempt_id: string
          correct?: boolean | null
          created_at?: string
          id?: string
          question_id: string
          response?: Json | null
          score?: number | null
          teacher_override?: number | null
        }
        Update: {
          ai_feedback?: string | null
          attempt_id?: string
          correct?: boolean | null
          created_at?: string
          id?: string
          question_id?: string
          response?: Json | null
          score?: number | null
          teacher_override?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attempt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          assignment_id: string | null
          band: Database["public"]["Enums"]["proficiency_band"] | null
          component: Database["public"]["Enums"]["pep_component"] | null
          finished_at: string | null
          grade: number | null
          id: string
          score: number | null
          started_at: string
          student_id: string
          subject: Database["public"]["Enums"]["subject"] | null
        }
        Insert: {
          assignment_id?: string | null
          band?: Database["public"]["Enums"]["proficiency_band"] | null
          component?: Database["public"]["Enums"]["pep_component"] | null
          finished_at?: string | null
          grade?: number | null
          id?: string
          score?: number | null
          started_at?: string
          student_id: string
          subject?: Database["public"]["Enums"]["subject"] | null
        }
        Update: {
          assignment_id?: string | null
          band?: Database["public"]["Enums"]["proficiency_band"] | null
          component?: Database["public"]["Enums"]["pep_component"] | null
          finished_at?: string | null
          grade?: number | null
          id?: string
          score?: number | null
          started_at?: string
          student_id?: string
          subject?: Database["public"]["Enums"]["subject"] | null
        }
        Relationships: [
          {
            foreignKeyName: "attempts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      class_members: {
        Row: {
          class_id: string
          joined_at: string
          student_id: string
        }
        Insert: {
          class_id: string
          joined_at?: string
          student_id: string
        }
        Update: {
          class_id?: string
          joined_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          grade: number
          id: string
          join_code: string
          name: string
          school_id: string | null
          teacher_id: string
        }
        Insert: {
          created_at?: string
          grade: number
          id?: string
          join_code?: string
          name: string
          school_id?: string | null
          teacher_id: string
        }
        Update: {
          created_at?: string
          grade?: number
          id?: string
          join_code?: string
          name?: string
          school_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_blueprints: {
        Row: {
          band_cuts: Json
          component: Database["public"]["Enums"]["pep_component"]
          created_at: string
          duration_minutes: number
          grade: number
          id: string
          is_default: boolean
          item_count: number
          item_mix: Json
          notes: string | null
          subject: Database["public"]["Enums"]["subject"] | null
          updated_at: string
        }
        Insert: {
          band_cuts?: Json
          component: Database["public"]["Enums"]["pep_component"]
          created_at?: string
          duration_minutes?: number
          grade: number
          id?: string
          is_default?: boolean
          item_count?: number
          item_mix?: Json
          notes?: string | null
          subject?: Database["public"]["Enums"]["subject"] | null
          updated_at?: string
        }
        Update: {
          band_cuts?: Json
          component?: Database["public"]["Enums"]["pep_component"]
          created_at?: string
          duration_minutes?: number
          grade?: number
          id?: string
          is_default?: boolean
          item_count?: number
          item_mix?: Json
          notes?: string | null
          subject?: Database["public"]["Enums"]["subject"] | null
          updated_at?: string
        }
        Relationships: []
      }
      exam_results: {
        Row: {
          created_at: string
          id: string
          overall_band: Database["public"]["Enums"]["proficiency_band"]
          overall_pct: number
          per_strand: Json
          per_subject: Json
          session_id: string
          time_used_seconds: number
        }
        Insert: {
          created_at?: string
          id?: string
          overall_band?: Database["public"]["Enums"]["proficiency_band"]
          overall_pct?: number
          per_strand?: Json
          per_subject?: Json
          session_id: string
          time_used_seconds?: number
        }
        Update: {
          created_at?: string
          id?: string
          overall_band?: Database["public"]["Enums"]["proficiency_band"]
          overall_pct?: number
          per_strand?: Json
          per_subject?: Json
          session_id?: string
          time_used_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "exam_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_session_items: {
        Row: {
          ai_feedback: Json | null
          created_at: string
          flagged: boolean
          id: string
          is_correct: boolean | null
          order_index: number
          points_awarded: number | null
          points_max: number
          question_id: string
          session_id: string
          strand: string | null
          student_answer: Json | null
          subject: Database["public"]["Enums"]["subject"] | null
          updated_at: string
        }
        Insert: {
          ai_feedback?: Json | null
          created_at?: string
          flagged?: boolean
          id?: string
          is_correct?: boolean | null
          order_index: number
          points_awarded?: number | null
          points_max?: number
          question_id: string
          session_id: string
          strand?: string | null
          student_answer?: Json | null
          subject?: Database["public"]["Enums"]["subject"] | null
          updated_at?: string
        }
        Update: {
          ai_feedback?: Json | null
          created_at?: string
          flagged?: boolean
          id?: string
          is_correct?: boolean | null
          order_index?: number
          points_awarded?: number | null
          points_max?: number
          question_id?: string
          session_id?: string
          strand?: string | null
          student_answer?: Json | null
          subject?: Database["public"]["Enums"]["subject"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_session_items_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_session_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "exam_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_sessions: {
        Row: {
          blueprint_id: string
          component: Database["public"]["Enums"]["pep_component"]
          created_at: string
          grade: number
          id: string
          overall_band: Database["public"]["Enums"]["proficiency_band"] | null
          overall_pct: number | null
          remaining_seconds: number
          started_at: string
          status: string
          student_id: string
          subject: Database["public"]["Enums"]["subject"] | null
          submitted_at: string | null
          time_limit_seconds: number
          updated_at: string
        }
        Insert: {
          blueprint_id: string
          component: Database["public"]["Enums"]["pep_component"]
          created_at?: string
          grade: number
          id?: string
          overall_band?: Database["public"]["Enums"]["proficiency_band"] | null
          overall_pct?: number | null
          remaining_seconds: number
          started_at?: string
          status?: string
          student_id: string
          subject?: Database["public"]["Enums"]["subject"] | null
          submitted_at?: string | null
          time_limit_seconds: number
          updated_at?: string
        }
        Update: {
          blueprint_id?: string
          component?: Database["public"]["Enums"]["pep_component"]
          created_at?: string
          grade?: number
          id?: string
          overall_band?: Database["public"]["Enums"]["proficiency_band"] | null
          overall_pct?: number | null
          remaining_seconds?: number
          started_at?: string
          status?: string
          student_id?: string
          subject?: Database["public"]["Enums"]["subject"] | null
          submitted_at?: string | null
          time_limit_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_sessions_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "exam_blueprints"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_settings: {
        Row: {
          notes: string | null
          performance_task_enabled: boolean
          updated_at: string
          year: number
        }
        Insert: {
          notes?: string | null
          performance_task_enabled?: boolean
          updated_at?: string
          year: number
        }
        Update: {
          notes?: string | null
          performance_task_enabled?: boolean
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      parent_child: {
        Row: {
          child_id: string
          created_at: string
          parent_id: string
        }
        Insert: {
          child_id: string
          created_at?: string
          parent_id: string
        }
        Update: {
          child_id?: string
          created_at?: string
          parent_id?: string
        }
        Relationships: []
      }
      passages: {
        Row: {
          body: string
          grade: number | null
          id: string
          subject: Database["public"]["Enums"]["subject"] | null
          title: string | null
        }
        Insert: {
          body: string
          grade?: number | null
          id?: string
          subject?: Database["public"]["Enums"]["subject"] | null
          title?: string | null
        }
        Update: {
          body?: string
          grade?: number | null
          id?: string
          subject?: Database["public"]["Enums"]["subject"] | null
          title?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string | null
          created_at: string
          full_name: string | null
          grade: number | null
          id: string
          is_disabled: boolean
          updated_at: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          full_name?: string | null
          grade?: number | null
          id: string
          is_disabled?: boolean
          updated_at?: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          full_name?: string | null
          grade?: number | null
          id?: string
          is_disabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          answer_key: Json | null
          created_at: string
          difficulty: number
          explanation: string | null
          id: string
          media: string | null
          needs_review: boolean
          options: Json | null
          passage_id: string | null
          rubric: Json | null
          source: string
          source_ref: string | null
          stem: string
          topic_id: string | null
          type: Database["public"]["Enums"]["question_type"]
        }
        Insert: {
          answer_key?: Json | null
          created_at?: string
          difficulty?: number
          explanation?: string | null
          id?: string
          media?: string | null
          needs_review?: boolean
          options?: Json | null
          passage_id?: string | null
          rubric?: Json | null
          source?: string
          source_ref?: string | null
          stem: string
          topic_id?: string | null
          type: Database["public"]["Enums"]["question_type"]
        }
        Update: {
          answer_key?: Json | null
          created_at?: string
          difficulty?: number
          explanation?: string | null
          id?: string
          media?: string | null
          needs_review?: boolean
          options?: Json | null
          passage_id?: string | null
          rubric?: Json | null
          source?: string
          source_ref?: string | null
          stem?: string
          topic_id?: string | null
          type?: Database["public"]["Enums"]["question_type"]
        }
        Relationships: [
          {
            foreignKeyName: "questions_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "passages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          earned_at: string
          id: string
          kind: string
          label: string | null
          student_id: string
        }
        Insert: {
          earned_at?: string
          id?: string
          kind: string
          label?: string | null
          student_id: string
        }
        Update: {
          earned_at?: string
          id?: string
          kind?: string
          label?: string | null
          student_id?: string
        }
        Relationships: []
      }
      schools: {
        Row: {
          created_at: string
          id: string
          name: string
          parish: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parish?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parish?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          component: Database["public"]["Enums"]["pep_component"]
          grade: number
          id: string
          name: string
          strand: string | null
          subject: Database["public"]["Enums"]["subject"]
        }
        Insert: {
          component: Database["public"]["Enums"]["pep_component"]
          grade: number
          id?: string
          name: string
          strand?: string | null
          subject: Database["public"]["Enums"]["subject"]
        }
        Update: {
          component?: Database["public"]["Enums"]["pep_component"]
          grade?: number
          id?: string
          name?: string
          strand?: string | null
          subject?: Database["public"]["Enums"]["subject"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_parent_of: {
        Args: { _child: string; _parent: string }
        Returns: boolean
      }
      is_teacher_of_student: {
        Args: { _student: string; _teacher: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "parent" | "teacher" | "admin"
      pep_component: "AT" | "CBT" | "PT"
      proficiency_band:
        | "beginning"
        | "developing"
        | "proficient"
        | "highly_proficient"
      question_type:
        | "mc"
        | "multi"
        | "tf"
        | "numeric"
        | "matching"
        | "ordering"
        | "short_text"
        | "pt_scenario"
      subject: "mathematics" | "language_arts" | "science" | "social_studies"
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
      app_role: ["student", "parent", "teacher", "admin"],
      pep_component: ["AT", "CBT", "PT"],
      proficiency_band: [
        "beginning",
        "developing",
        "proficient",
        "highly_proficient",
      ],
      question_type: [
        "mc",
        "multi",
        "tf",
        "numeric",
        "matching",
        "ordering",
        "short_text",
        "pt_scenario",
      ],
      subject: ["mathematics", "language_arts", "science", "social_studies"],
    },
  },
} as const
