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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      expenses: {
        Row: {
          amount: number
          amount_in_ils: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          currency: Database["public"]["Enums"]["expense_currency"]
          description: string
          expense_date: string
          id: string
          report_id: string
        }
        Insert: {
          amount: number
          amount_in_ils: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency: Database["public"]["Enums"]["expense_currency"]
          description: string
          expense_date: string
          id?: string
          report_id: string
        }
        Update: {
          amount?: number
          amount_in_ils?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency?: Database["public"]["Enums"]["expense_currency"]
          description?: string
          expense_date?: string
          id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department: string
          employee_id: string
          full_name: string
          id: string
          username: string
        }
        Insert: {
          created_at?: string
          department: string
          employee_id: string
          full_name: string
          id: string
          username: string
        }
        Update: {
          created_at?: string
          department?: string
          employee_id?: string
          full_name?: string
          id?: string
          username?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          expense_id: string
          file_name: string
          file_size: number
          file_type: Database["public"]["Enums"]["file_type_enum"]
          file_url: string
          id: string
          uploaded_at: string
        }
        Insert: {
          expense_id: string
          file_name: string
          file_size: number
          file_type: Database["public"]["Enums"]["file_type_enum"]
          file_url: string
          id?: string
          uploaded_at?: string
        }
        Update: {
          expense_id?: string
          file_name?: string
          file_size?: number
          file_type?: Database["public"]["Enums"]["file_type_enum"]
          file_url?: string
          id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      report_comments: {
        Row: {
          comment_text: string
          created_at: string
          id: string
          report_id: string
          user_id: string
        }
        Insert: {
          comment_text: string
          created_at?: string
          id?: string
          report_id: string
          user_id: string
        }
        Update: {
          comment_text?: string
          created_at?: string
          id?: string
          report_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_comments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_history: {
        Row: {
          action: Database["public"]["Enums"]["report_action"]
          id: string
          notes: string | null
          performed_by: string
          report_id: string
          timestamp: string
        }
        Insert: {
          action: Database["public"]["Enums"]["report_action"]
          id?: string
          notes?: string | null
          performed_by: string
          report_id: string
          timestamp?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["report_action"]
          id?: string
          notes?: string | null
          performed_by?: string
          report_id?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_history_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_history_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["expense_status"]
          submitted_at: string | null
          total_amount_ils: number | null
          trip_destination: string
          trip_end_date: string
          trip_purpose: string
          trip_start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          submitted_at?: string | null
          total_amount_ils?: number | null
          trip_destination: string
          trip_end_date: string
          trip_purpose: string
          trip_start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          submitted_at?: string | null
          total_amount_ils?: number | null
          trip_destination?: string
          trip_end_date?: string
          trip_purpose?: string
          trip_start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      expense_category:
        | "flights"
        | "accommodation"
        | "food"
        | "transportation"
        | "miscellaneous"
      expense_currency: "USD" | "EUR" | "ILS" | "PLN" | "GBP"
      expense_status:
        | "draft"
        | "open"
        | "pending"
        | "approved"
        | "rejected"
        | "closed"
      file_type_enum: "image" | "pdf"
      report_action:
        | "created"
        | "submitted"
        | "approved"
        | "rejected"
        | "edited"
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
      expense_category: [
        "flights",
        "accommodation",
        "food",
        "transportation",
        "miscellaneous",
      ],
      expense_currency: ["USD", "EUR", "ILS", "PLN", "GBP"],
      expense_status: [
        "draft",
        "open",
        "pending",
        "approved",
        "rejected",
        "closed",
      ],
      file_type_enum: ["image", "pdf"],
      report_action: ["created", "submitted", "approved", "rejected", "edited"],
    },
  },
} as const
