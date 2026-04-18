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
      clients: {
        Row: {
          address: string | null
          company_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          created_at: string
          default_markup: number
          default_tax_rate: number
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          trades: Database["public"]["Enums"]["trade_type"][]
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          default_markup?: number
          default_tax_rate?: number
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          trades?: Database["public"]["Enums"]["trade_type"][]
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          default_markup?: number
          default_tax_rate?: number
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          trades?: Database["public"]["Enums"]["trade_type"][]
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      estimate_line_items: {
        Row: {
          code: string | null
          created_at: string
          estimate_id: string
          id: string
          line_item_id: string | null
          name: string
          qty: number
          sort_order: number
          total: number
          trade: Database["public"]["Enums"]["trade_type"]
          unit: string
          unit_price: number
        }
        Insert: {
          code?: string | null
          created_at?: string
          estimate_id: string
          id?: string
          line_item_id?: string | null
          name: string
          qty?: number
          sort_order?: number
          total?: number
          trade: Database["public"]["Enums"]["trade_type"]
          unit?: string
          unit_price?: number
        }
        Update: {
          code?: string | null
          created_at?: string
          estimate_id?: string
          id?: string
          line_item_id?: string | null
          name?: string
          qty?: number
          sort_order?: number
          total?: number
          trade?: Database["public"]["Enums"]["trade_type"]
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_line_items_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_line_items_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "line_item_master"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          company_id: string
          created_at: string
          id: string
          job_id: string
          name: string
          status: Database["public"]["Enums"]["estimate_doc_status"]
          subtotal: number
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          job_id: string
          name: string
          status?: Database["public"]["Enums"]["estimate_doc_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          job_id?: string
          name?: string
          status?: Database["public"]["Enums"]["estimate_doc_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          client_id: string | null
          company_id: string
          created_at: string
          id: string
          job_number: string | null
          name: string
          notes: string | null
          primary_trade: Database["public"]["Enums"]["trade_type"] | null
          property_address: string | null
          status: Database["public"]["Enums"]["job_status"]
          total_estimate: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          job_number?: string | null
          name: string
          notes?: string | null
          primary_trade?: Database["public"]["Enums"]["trade_type"] | null
          property_address?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          total_estimate?: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          job_number?: string | null
          name?: string
          notes?: string | null
          primary_trade?: Database["public"]["Enums"]["trade_type"] | null
          property_address?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          total_estimate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      line_item_master: {
        Row: {
          category: string | null
          code: string
          company_id: string
          created_at: string
          default_price: number
          id: string
          name: string
          status: Database["public"]["Enums"]["catalog_status"]
          trade: Database["public"]["Enums"]["trade_type"]
          unit: string
          updated_at: string
          waste_pct: number
        }
        Insert: {
          category?: string | null
          code: string
          company_id: string
          created_at?: string
          default_price?: number
          id?: string
          name: string
          status?: Database["public"]["Enums"]["catalog_status"]
          trade: Database["public"]["Enums"]["trade_type"]
          unit?: string
          updated_at?: string
          waste_pct?: number
        }
        Update: {
          category?: string | null
          code?: string
          company_id?: string
          created_at?: string
          default_price?: number
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["catalog_status"]
          trade?: Database["public"]["Enums"]["trade_type"]
          unit?: string
          updated_at?: string
          waste_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "line_item_master_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      price_books: {
        Row: {
          company_id: string
          created_at: string
          id: string
          item_count: number
          name: string
          region: string | null
          source: string | null
          status: Database["public"]["Enums"]["price_book_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          item_count?: number
          name: string
          region?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["price_book_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          item_count?: number
          name?: string
          region?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["price_book_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_books_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_company_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "admin" | "estimator" | "member"
      catalog_status: "active" | "inactive"
      estimate_doc_status: "draft" | "sent" | "approved" | "rejected"
      estimate_status: "draft" | "sent" | "approved" | "rejected"
      job_status:
        | "lead"
        | "inspected"
        | "estimated"
        | "proposed"
        | "signed"
        | "in_progress"
        | "complete"
      price_book_status: "active" | "archived"
      property_type: "residential" | "commercial"
      trade_type:
        | "roofing"
        | "exterior"
        | "windows"
        | "interior"
        | "hvac"
        | "plumbing"
        | "electrical"
        | "mitigation"
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
      app_role: ["owner", "admin", "estimator", "member"],
      catalog_status: ["active", "inactive"],
      estimate_doc_status: ["draft", "sent", "approved", "rejected"],
      estimate_status: ["draft", "sent", "approved", "rejected"],
      job_status: [
        "lead",
        "inspected",
        "estimated",
        "proposed",
        "signed",
        "in_progress",
        "complete",
      ],
      price_book_status: ["active", "archived"],
      property_type: ["residential", "commercial"],
      trade_type: [
        "roofing",
        "exterior",
        "windows",
        "interior",
        "hvac",
        "plumbing",
        "electrical",
        "mitigation",
      ],
    },
  },
} as const
