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
          teacher_id: string
        }
        Insert: {
          created_at?: string
          grade: number
          id?: string
          join_code?: string
          name: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          grade?: number
          id?: string
          join_code?: string
          name?: string
          teacher_id?: string
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
          updated_at: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          full_name?: string | null
          grade?: number | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          full_name?: string | null
          grade?: number | null
          id?: string
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
          options: Json | null
          passage_id: string | null
          rubric: Json | null
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
          options?: Json | null
          passage_id?: string | null
          rubric?: Json | null
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
          options?: Json | null
          passage_id?: string | null
          rubric?: Json | null
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
      app_role: "student" | "parent" | "teacher"
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
      app_role: ["student", "parent", "teacher"],
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
