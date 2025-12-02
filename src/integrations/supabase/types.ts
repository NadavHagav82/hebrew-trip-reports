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
      accounting_comments: {
        Row: {
          comment_text: string
          created_at: string | null
          created_by: string
          id: string
          is_resolved: boolean | null
          report_id: string
          resolved_at: string | null
        }
        Insert: {
          comment_text: string
          created_at?: string | null
          created_by: string
          id?: string
          is_resolved?: boolean | null
          report_id: string
          resolved_at?: string | null
        }
        Update: {
          comment_text?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_resolved?: boolean | null
          report_id?: string
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_comments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_comments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      bootstrap_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          is_used: boolean
          notes: string | null
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          is_used?: boolean
          notes?: string | null
          token: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          notes?: string | null
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      expense_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          id: string
          is_active: boolean | null
          threshold_amount: number | null
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          threshold_amount?: number | null
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          threshold_amount?: number | null
          user_id?: string
        }
        Relationships: []
      }
      expense_templates: {
        Row: {
          amount: number | null
          category: Database["public"]["Enums"]["expense_category"]
          country: string | null
          created_at: string
          created_by: string
          currency: Database["public"]["Enums"]["expense_currency"]
          description: string
          id: string
          is_active: boolean
          notes: string | null
          template_name: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          category: Database["public"]["Enums"]["expense_category"]
          country?: string | null
          created_at?: string
          created_by: string
          currency?: Database["public"]["Enums"]["expense_currency"]
          description: string
          id?: string
          is_active?: boolean
          notes?: string | null
          template_name: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          category?: Database["public"]["Enums"]["expense_category"]
          country?: string | null
          created_at?: string
          created_by?: string
          currency?: Database["public"]["Enums"]["expense_currency"]
          description?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          template_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          amount_in_ils: number
          approval_status:
            | Database["public"]["Enums"]["expense_approval_status"]
            | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          currency: Database["public"]["Enums"]["expense_currency"]
          description: string
          expense_date: string
          id: string
          manager_comment: string | null
          notes: string | null
          report_id: string
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          amount: number
          amount_in_ils: number
          approval_status?:
            | Database["public"]["Enums"]["expense_approval_status"]
            | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency: Database["public"]["Enums"]["expense_currency"]
          description: string
          expense_date: string
          id?: string
          manager_comment?: string | null
          notes?: string | null
          report_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          amount?: number
          amount_in_ils?: number
          approval_status?:
            | Database["public"]["Enums"]["expense_approval_status"]
            | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency?: Database["public"]["Enums"]["expense_currency"]
          description?: string
          expense_date?: string
          id?: string
          manager_comment?: string | null
          notes?: string | null
          report_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_comment_attachments: {
        Row: {
          expense_id: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          uploaded_at: string | null
          uploaded_by: string
        }
        Insert: {
          expense_id: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          uploaded_at?: string | null
          uploaded_by: string
        }
        Update: {
          expense_id?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          uploaded_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_comment_attachments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_comment_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accounting_manager_email: string | null
          created_at: string
          department: string
          email: string | null
          employee_id: string | null
          full_name: string
          id: string
          is_manager: boolean
          manager_id: string | null
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          username: string
        }
        Insert: {
          accounting_manager_email?: string | null
          created_at?: string
          department: string
          email?: string | null
          employee_id?: string | null
          full_name: string
          id: string
          is_manager?: boolean
          manager_id?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          username: string
        }
        Update: {
          accounting_manager_email?: string | null
          created_at?: string
          department?: string
          email?: string | null
          employee_id?: string | null
          full_name?: string
          id?: string
          is_manager?: boolean
          manager_id?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      recipient_lists: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          list_name: string
          recipient_emails: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          list_name: string
          recipient_emails: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          list_name?: string
          recipient_emails?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipient_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      report_preferences: {
        Row: {
          created_at: string | null
          filters: Json
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          filters?: Json
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          filters?: Json
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          daily_allowance: number | null
          id: string
          manager_approval_requested_at: string | null
          manager_approval_token: string | null
          manager_general_comment: string | null
          notes: string | null
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
          daily_allowance?: number | null
          id?: string
          manager_approval_requested_at?: string | null
          manager_approval_token?: string | null
          manager_general_comment?: string | null
          notes?: string | null
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
          daily_allowance?: number | null
          id?: string
          manager_approval_requested_at?: string | null
          manager_approval_token?: string | null
          manager_general_comment?: string | null
          notes?: string | null
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
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      accounting_manager_exists: { Args: never; Returns: boolean }
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "user"
        | "accounting_manager"
        | "org_admin"
      expense_approval_status: "pending" | "approved" | "rejected"
      expense_category:
        | "flights"
        | "accommodation"
        | "food"
        | "transportation"
        | "miscellaneous"
      expense_currency:
        | "USD"
        | "EUR"
        | "ILS"
        | "PLN"
        | "GBP"
        | "BGN"
        | "CZK"
        | "HUF"
        | "RON"
        | "SEK"
        | "NOK"
        | "DKK"
        | "CHF"
        | "JPY"
        | "CNY"
        | "ISK"
        | "HRK"
        | "RSD"
        | "UAH"
        | "TRY"
        | "CAD"
        | "MXN"
        | "BRL"
        | "ARS"
        | "CLP"
        | "COP"
        | "PEN"
        | "UYU"
        | "KRW"
        | "HKD"
        | "SGD"
        | "THB"
        | "MYR"
        | "IDR"
        | "PHP"
        | "VND"
        | "TWD"
        | "INR"
        | "ZAR"
        | "EGP"
        | "MAD"
        | "TND"
        | "KES"
        | "NGN"
        | "GHS"
        | "AUD"
        | "NZD"
        | "AED"
        | "SAR"
        | "QAR"
        | "KWD"
        | "JOD"
      expense_status: "draft" | "open" | "closed" | "pending_approval"
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
      app_role: ["admin", "manager", "user", "accounting_manager", "org_admin"],
      expense_approval_status: ["pending", "approved", "rejected"],
      expense_category: [
        "flights",
        "accommodation",
        "food",
        "transportation",
        "miscellaneous",
      ],
      expense_currency: [
        "USD",
        "EUR",
        "ILS",
        "PLN",
        "GBP",
        "BGN",
        "CZK",
        "HUF",
        "RON",
        "SEK",
        "NOK",
        "DKK",
        "CHF",
        "JPY",
        "CNY",
        "ISK",
        "HRK",
        "RSD",
        "UAH",
        "TRY",
        "CAD",
        "MXN",
        "BRL",
        "ARS",
        "CLP",
        "COP",
        "PEN",
        "UYU",
        "KRW",
        "HKD",
        "SGD",
        "THB",
        "MYR",
        "IDR",
        "PHP",
        "VND",
        "TWD",
        "INR",
        "ZAR",
        "EGP",
        "MAD",
        "TND",
        "KES",
        "NGN",
        "GHS",
        "AUD",
        "NZD",
        "AED",
        "SAR",
        "QAR",
        "KWD",
        "JOD",
      ],
      expense_status: ["draft", "open", "closed", "pending_approval"],
      file_type_enum: ["image", "pdf"],
      report_action: ["created", "submitted", "approved", "rejected", "edited"],
    },
  },
} as const
