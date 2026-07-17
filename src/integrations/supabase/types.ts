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
      ai_measurement_runs: {
        Row: {
          company_id: string | null
          correction_measurement_id: string | null
          created_at: string
          id: string
          imagery_date: Json | null
          imagery_quality: string | null
          job_id: string | null
          notes: string | null
          predominant_pitch: string | null
          property_id: string | null
          provider: string
          raw_response: Json
          requested_lat: number
          requested_lng: number
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          segment_count: number
          segments: Json
          status: string
          total_actual_sqft: number
          total_plan_sqft: number
          training_example_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          correction_measurement_id?: string | null
          created_at?: string
          id?: string
          imagery_date?: Json | null
          imagery_quality?: string | null
          job_id?: string | null
          notes?: string | null
          predominant_pitch?: string | null
          property_id?: string | null
          provider?: string
          raw_response?: Json
          requested_lat: number
          requested_lng: number
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          segment_count?: number
          segments?: Json
          status?: string
          total_actual_sqft?: number
          total_plan_sqft?: number
          training_example_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          correction_measurement_id?: string | null
          created_at?: string
          id?: string
          imagery_date?: Json | null
          imagery_quality?: string | null
          job_id?: string | null
          notes?: string | null
          predominant_pitch?: string | null
          property_id?: string | null
          provider?: string
          raw_response?: Json
          requested_lat?: number
          requested_lng?: number
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          segment_count?: number
          segments?: Json
          status?: string
          total_actual_sqft?: number
          total_plan_sqft?: number
          training_example_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_training_sessions: {
        Row: {
          answer: string | null
          context: Json | null
          created_at: string | null
          feedback: string | null
          id: string
          question: string | null
          user_id: string | null
        }
        Insert: {
          answer?: string | null
          context?: Json | null
          created_at?: string | null
          feedback?: string | null
          id?: string
          question?: string | null
          user_id?: string | null
        }
        Update: {
          answer?: string | null
          context?: Json | null
          created_at?: string | null
          feedback?: string | null
          id?: string
          question?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience_company_id: string | null
          body: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          severity: string
          title: string
        }
        Insert: {
          audience_company_id?: string | null
          body: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          severity?: string
          title: string
        }
        Update: {
          audience_company_id?: string | null
          body?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_audience_company_id_fkey"
            columns: ["audience_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      assembly_imports: {
        Row: {
          applied_at: string | null
          company_id: string | null
          created_at: string
          filename: string | null
          id: string
          parsed: Json
          source_path: string | null
          status: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          applied_at?: string | null
          company_id?: string | null
          created_at?: string
          filename?: string | null
          id?: string
          parsed?: Json
          source_path?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          applied_at?: string | null
          company_id?: string | null
          created_at?: string
          filename?: string | null
          id?: string
          parsed?: Json
          source_path?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      assistant_messages: {
        Row: {
          created_at: string
          id: string
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parts?: Json
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "assistant_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_threads: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      badges: {
        Row: {
          category: string
          code: string
          created_at: string | null
          criteria_type: string
          criteria_value: number | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_hidden: boolean | null
          name: string
          points_awarded: number | null
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          category: string
          code: string
          created_at?: string | null
          criteria_type: string
          criteria_value?: number | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_hidden?: boolean | null
          name: string
          points_awarded?: number | null
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          code?: string
          created_at?: string | null
          criteria_type?: string
          criteria_value?: number | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_hidden?: boolean | null
          name?: string
          points_awarded?: number | null
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      challenge_participants: {
        Row: {
          challenge_id: string
          completed: boolean | null
          completed_at: string | null
          id: string
          joined_at: string | null
          progress: number | null
          reward_claimed: boolean | null
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          joined_at?: string | null
          progress?: number | null
          reward_claimed?: boolean | null
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          joined_at?: string | null
          progress?: number | null
          reward_claimed?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          badge_reward_id: string | null
          bonus_payout_percent: number | null
          challenge_type: string
          created_at: string | null
          created_by: string | null
          description: string | null
          ends_at: string
          id: string
          is_active: boolean | null
          name: string
          points_reward: number | null
          starts_at: string
          target_metric: string
          target_value: number
          updated_at: string | null
        }
        Insert: {
          badge_reward_id?: string | null
          bonus_payout_percent?: number | null
          challenge_type: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          ends_at: string
          id?: string
          is_active?: boolean | null
          name: string
          points_reward?: number | null
          starts_at: string
          target_metric: string
          target_value: number
          updated_at?: string | null
        }
        Update: {
          badge_reward_id?: string | null
          bonus_payout_percent?: number | null
          challenge_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          ends_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          points_reward?: number | null
          starts_at?: string
          target_metric?: string
          target_value?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenges_badge_reward_id_fkey"
            columns: ["badge_reward_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
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
          auto_add_photo_suggestions: boolean
          bank_instructions: Json | null
          created_at: string
          default_market_id: string | null
          default_markup: number
          default_markup_pct: number
          default_overhead_pct: number
          default_profit_pct: number
          default_tax_rate: number
          email: string | null
          financing_blurb: string | null
          id: string
          include_fl_code_package: boolean
          is_roof_king: boolean
          license_numbers: string[]
          logo_url: string | null
          name: string
          phone: string | null
          trades: Database["public"]["Enums"]["trade_type"][]
          updated_at: string
          warranty_blurb: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          auto_add_photo_suggestions?: boolean
          bank_instructions?: Json | null
          created_at?: string
          default_market_id?: string | null
          default_markup?: number
          default_markup_pct?: number
          default_overhead_pct?: number
          default_profit_pct?: number
          default_tax_rate?: number
          email?: string | null
          financing_blurb?: string | null
          id?: string
          include_fl_code_package?: boolean
          is_roof_king?: boolean
          license_numbers?: string[]
          logo_url?: string | null
          name: string
          phone?: string | null
          trades?: Database["public"]["Enums"]["trade_type"][]
          updated_at?: string
          warranty_blurb?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          auto_add_photo_suggestions?: boolean
          bank_instructions?: Json | null
          created_at?: string
          default_market_id?: string | null
          default_markup?: number
          default_markup_pct?: number
          default_overhead_pct?: number
          default_profit_pct?: number
          default_tax_rate?: number
          email?: string | null
          financing_blurb?: string | null
          id?: string
          include_fl_code_package?: boolean
          is_roof_king?: boolean
          license_numbers?: string[]
          logo_url?: string | null
          name?: string
          phone?: string | null
          trades?: Database["public"]["Enums"]["trade_type"][]
          updated_at?: string
          warranty_blurb?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_default_market_id_fkey"
            columns: ["default_market_id"]
            isOneToOne: false
            referencedRelation: "price_books"
            referencedColumns: ["id"]
          },
        ]
      }
      companion_rules: {
        Row: {
          company_id: string
          created_at: string
          id: string
          jurisdiction: string | null
          notes: string | null
          rule_type: Database["public"]["Enums"]["companion_rule_type"]
          suggested_codes: string[]
          trigger_category: string
          trigger_trade: Database["public"]["Enums"]["trade_type"] | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          jurisdiction?: string | null
          notes?: string | null
          rule_type?: Database["public"]["Enums"]["companion_rule_type"]
          suggested_codes?: string[]
          trigger_category: string
          trigger_trade?: Database["public"]["Enums"]["trade_type"] | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          jurisdiction?: string | null
          notes?: string | null
          rule_type?: Database["public"]["Enums"]["companion_rule_type"]
          suggested_codes?: string[]
          trigger_category?: string
          trigger_trade?: Database["public"]["Enums"]["trade_type"] | null
          updated_at?: string
        }
        Relationships: []
      }
      company_invites: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_join_requests: {
        Row: {
          company_id: string
          decided_at: string | null
          decided_by: string | null
          id: string
          note: string | null
          requested_at: string
          status: Database["public"]["Enums"]["join_request_status"]
          user_id: string
        }
        Insert: {
          company_id: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          note?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["join_request_status"]
          user_id: string
        }
        Update: {
          company_id?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          note?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["join_request_status"]
          user_id?: string
        }
        Relationships: []
      }
      company_labor_rates: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          notes: string | null
          rate: number
          sort_order: number
          task: string
          uom: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          rate?: number
          sort_order?: number
          task: string
          uom: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          rate?: number
          sort_order?: number
          task?: string
          uom?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_macro_pricing: {
        Row: {
          company_id: string
          id: string
          line_item_master_id: string
          macro_id: string
          notes: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          company_id: string
          id?: string
          line_item_master_id: string
          macro_id: string
          notes?: string | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          id?: string
          line_item_master_id?: string
          macro_id?: string
          notes?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_macro_pricing_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_macro_pricing_line_item_master_id_fkey"
            columns: ["line_item_master_id"]
            isOneToOne: false
            referencedRelation: "line_item_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_macro_pricing_macro_id_fkey"
            columns: ["macro_id"]
            isOneToOne: false
            referencedRelation: "master_macros"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          contract_type: string
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          document_id: string
          id: string
          job_id: string | null
          pdf_url: string | null
          property_address: string | null
          raw_data: Json
          rep_user_id: string | null
          signed_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          contract_type: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          document_id: string
          id?: string
          job_id?: string | null
          pdf_url?: string | null
          property_address?: string | null
          raw_data?: Json
          rep_user_id?: string | null
          signed_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          contract_type?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          document_id?: string
          id?: string
          job_id?: string | null
          pdf_url?: string | null
          property_address?: string | null
          raw_data?: Json
          rep_user_id?: string | null
          signed_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_rep_user_id_fkey"
            columns: ["rep_user_id"]
            isOneToOne: false
            referencedRelation: "tenant_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      d2d_chat_messages: {
        Row: {
          author_id: string
          body: string
          company_id: string | null
          created_at: string
          id: string
          scope: string
          session_id: string | null
        }
        Insert: {
          author_id: string
          body: string
          company_id?: string | null
          created_at?: string
          id?: string
          scope: string
          session_id?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          company_id?: string | null
          created_at?: string
          id?: string
          scope?: string
          session_id?: string | null
        }
        Relationships: []
      }
      door_knocks: {
        Row: {
          address: string | null
          appointment_date: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          disposition: Database["public"]["Enums"]["door_disposition"]
          dwell_time_seconds: number
          id: string
          lat: number
          lng: number
          notes: string | null
          points_awarded: number
          property_id: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          address?: string | null
          appointment_date?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          disposition: Database["public"]["Enums"]["door_disposition"]
          dwell_time_seconds?: number
          id?: string
          lat: number
          lng: number
          notes?: string | null
          points_awarded?: number
          property_id?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          address?: string | null
          appointment_date?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          disposition?: Database["public"]["Enums"]["door_disposition"]
          dwell_time_seconds?: number
          id?: string
          lat?: number
          lng?: number
          notes?: string | null
          points_awarded?: number
          property_id?: string | null
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "door_knocks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "field_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      door_session_goals: {
        Row: {
          completed: boolean | null
          created_at: string | null
          current_value: number | null
          goal_type: string | null
          goals_doors: number | null
          goals_leads: number | null
          id: string
          session_id: string
          target_value: number | null
          user_id: string
          video_duration_seconds: number | null
          video_url: string | null
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          current_value?: number | null
          goal_type?: string | null
          goals_doors?: number | null
          goals_leads?: number | null
          id?: string
          session_id: string
          target_value?: number | null
          user_id: string
          video_duration_seconds?: number | null
          video_url?: string | null
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          current_value?: number | null
          goal_type?: string | null
          goals_doors?: number | null
          goals_leads?: number | null
          id?: string
          session_id?: string
          target_value?: number | null
          user_id?: string
          video_duration_seconds?: number | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "door_session_goals_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "field_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      door_to_door_stats: {
        Row: {
          current_streak_days: number
          last_session_at: string | null
          longest_streak_days: number
          total_appointments: number
          total_contracts: number
          total_doors: number
          total_points: number
          total_sessions: number
          total_verifications: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          current_streak_days?: number
          last_session_at?: string | null
          longest_streak_days?: number
          total_appointments?: number
          total_contracts?: number
          total_doors?: number
          total_points?: number
          total_sessions?: number
          total_verifications?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          current_streak_days?: number
          last_session_at?: string | null
          longest_streak_days?: number
          total_appointments?: number
          total_contracts?: number
          total_doors?: number
          total_points?: number
          total_sessions?: number
          total_verifications?: number
          updated_at?: string | null
          user_id?: string
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
          source: string
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
          source?: string
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
          source?: string
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
          hide_pricing: boolean
          id: string
          job_id: string
          manual_total: number | null
          markup_pct: number
          name: string
          notes: string | null
          overhead_pct: number
          profit_pct: number
          status: Database["public"]["Enums"]["estimate_doc_status"]
          subtotal: number
          tax: number
          tax_pct: number
          tier: string
          total: number
          updated_at: string
          use_manual_total: boolean
        }
        Insert: {
          company_id: string
          created_at?: string
          hide_pricing?: boolean
          id?: string
          job_id: string
          manual_total?: number | null
          markup_pct?: number
          name: string
          notes?: string | null
          overhead_pct?: number
          profit_pct?: number
          status?: Database["public"]["Enums"]["estimate_doc_status"]
          subtotal?: number
          tax?: number
          tax_pct?: number
          tier?: string
          total?: number
          updated_at?: string
          use_manual_total?: boolean
        }
        Update: {
          company_id?: string
          created_at?: string
          hide_pricing?: boolean
          id?: string
          job_id?: string
          manual_total?: number | null
          markup_pct?: number
          name?: string
          notes?: string | null
          overhead_pct?: number
          profit_pct?: number
          status?: Database["public"]["Enums"]["estimate_doc_status"]
          subtotal?: number
          tax?: number
          tax_pct?: number
          tier?: string
          total?: number
          updated_at?: string
          use_manual_total?: boolean
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
      feed_post_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          author_id: string
          body: string | null
          comment_count: number
          company_id: string | null
          created_at: string
          id: string
          like_count: number
          media: Json
          updated_at: string
          visibility: string
        }
        Insert: {
          author_id: string
          body?: string | null
          comment_count?: number
          company_id?: string | null
          created_at?: string
          id?: string
          like_count?: number
          media?: Json
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_id?: string
          body?: string | null
          comment_count?: number
          company_id?: string | null
          created_at?: string
          id?: string
          like_count?: number
          media?: Json
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      field_sessions: {
        Row: {
          company_id: string | null
          created_at: string | null
          end_location: Json | null
          ended_at: string | null
          goals_doors: number | null
          goals_leads: number | null
          id: string
          is_active: boolean
          notes: string | null
          pre_session_goal: string | null
          pre_session_video_url: string | null
          route_geojson: Json
          start_location: Json | null
          started_at: string
          status: string
          total_distance_meters: number | null
          total_doors: number
          total_doors_knocked: number | null
          total_points: number
          total_points_earned: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          end_location?: Json | null
          ended_at?: string | null
          goals_doors?: number | null
          goals_leads?: number | null
          id?: string
          is_active?: boolean
          notes?: string | null
          pre_session_goal?: string | null
          pre_session_video_url?: string | null
          route_geojson?: Json
          start_location?: Json | null
          started_at?: string
          status?: string
          total_distance_meters?: number | null
          total_doors?: number
          total_doors_knocked?: number | null
          total_points?: number
          total_points_earned?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          end_location?: Json | null
          ended_at?: string | null
          goals_doors?: number | null
          goals_leads?: number | null
          id?: string
          is_active?: boolean
          notes?: string | null
          pre_session_goal?: string | null
          pre_session_video_url?: string | null
          route_geojson?: Json
          start_location?: Json | null
          started_at?: string
          status?: string
          total_distance_meters?: number | null
          total_doors?: number
          total_doors_knocked?: number | null
          total_points?: number
          total_points_earned?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      generated_reports: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          estimate_id: string | null
          hide_pricing: boolean
          id: string
          job_id: string
          pdf_path: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          estimate_id?: string | null
          hide_pricing?: boolean
          id?: string
          job_id: string
          pdf_path: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          estimate_id?: string | null
          hide_pricing?: boolean
          id?: string
          job_id?: string
          pdf_path?: string
        }
        Relationships: []
      }
      hail_events: {
        Row: {
          event_time: string
          geom: unknown
          hail_size_in: number
          id: string
          ingested_at: string | null
          lat: number
          lon: number
          mesh_product: string
          source: string
        }
        Insert: {
          event_time: string
          geom: unknown
          hail_size_in: number
          id?: string
          ingested_at?: string | null
          lat: number
          lon: number
          mesh_product: string
          source?: string
        }
        Update: {
          event_time?: string
          geom?: unknown
          hail_size_in?: number
          id?: string
          ingested_at?: string | null
          lat?: number
          lon?: number
          mesh_product?: string
          source?: string
        }
        Relationships: []
      }
      ingest_runs: {
        Row: {
          cells_found: number | null
          detail: string | null
          grid_valid_time: string | null
          id: string
          job: string
          ran_at: string | null
          rows_upserted: number | null
          source_url: string | null
          status: string
        }
        Insert: {
          cells_found?: number | null
          detail?: string | null
          grid_valid_time?: string | null
          id?: string
          job: string
          ran_at?: string | null
          rows_upserted?: number | null
          source_url?: string | null
          status: string
        }
        Update: {
          cells_found?: number | null
          detail?: string | null
          grid_valid_time?: string | null
          id?: string
          job?: string
          ran_at?: string | null
          rows_upserted?: number | null
          source_url?: string | null
          status?: string
        }
        Relationships: []
      }
      invoice_line_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          invoice_id: string
          kind: Database["public"]["Enums"]["invoice_line_kind"]
          line_item_master_id: string | null
          name: string
          qty: number
          sort_order: number
          total: number
          unit: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          invoice_id: string
          kind?: Database["public"]["Enums"]["invoice_line_kind"]
          line_item_master_id?: string | null
          name: string
          qty?: number
          sort_order?: number
          total?: number
          unit?: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          invoice_id?: string
          kind?: Database["public"]["Enums"]["invoice_line_kind"]
          line_item_master_id?: string | null
          name?: string
          qty?: number
          sort_order?: number
          total?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_number_sequences: {
        Row: {
          company_id: string
          next_value: number
          year: number
        }
        Insert: {
          company_id: string
          next_value?: number
          year: number
        }
        Update: {
          company_id?: string
          next_value?: number
          year?: number
        }
        Relationships: []
      }
      invoice_payment_intents: {
        Row: {
          amount: number
          company_id: string
          created_at: string | null
          environment: string
          id: string
          invoice_id: string
          provider: string
          provider_session_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string | null
          environment?: string
          id?: string
          invoice_id: string
          provider: string
          provider_session_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string | null
          environment?: string
          id?: string
          invoice_id?: string
          provider?: string
          provider_session_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payment_intents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payment_intents_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          currency: string
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["invoice_payment_method"]
          paid_at: string
          provider_id: string | null
          provider_meta: Json
          recorded_by: string | null
          reference: string | null
          status: Database["public"]["Enums"]["invoice_payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          currency?: string
          id?: string
          invoice_id: string
          method: Database["public"]["Enums"]["invoice_payment_method"]
          paid_at?: string
          provider_id?: string | null
          provider_meta?: Json
          recorded_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["invoice_payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["invoice_payment_method"]
          paid_at?: string
          provider_id?: string | null
          provider_meta?: Json
          recorded_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["invoice_payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_templates: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          kind: Database["public"]["Enums"]["invoice_template_kind"]
          layout: Json
          name: string
          preview_url: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          kind?: Database["public"]["Enums"]["invoice_template_kind"]
          layout?: Json
          name: string
          preview_url?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          kind?: Database["public"]["Enums"]["invoice_template_kind"]
          layout?: Json
          name?: string
          preview_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_due: number
          amount_paid: number
          client_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          discount: number
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          job_id: string | null
          notes: string | null
          pdf_path: string | null
          public_pay_token: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax: number
          tax_pct: number
          template_id: string | null
          terms: string | null
          total: number
          updated_at: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          client_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          job_id?: string | null
          notes?: string | null
          pdf_path?: string | null
          public_pay_token?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          tax_pct?: number
          template_id?: string | null
          terms?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          job_id?: string | null
          notes?: string | null
          pdf_path?: string | null
          public_pay_token?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          tax_pct?: number
          template_id?: string | null
          terms?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "invoice_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      job_documents: {
        Row: {
          bucket: string
          company_id: string
          created_at: string
          created_by: string | null
          file_size: number | null
          id: string
          job_id: string
          kind: string
          mime_type: string | null
          source_id: string | null
          source_table: string | null
          storage_path: string
          title: string
        }
        Insert: {
          bucket: string
          company_id: string
          created_at?: string
          created_by?: string | null
          file_size?: number | null
          id?: string
          job_id: string
          kind: string
          mime_type?: string | null
          source_id?: string | null
          source_table?: string | null
          storage_path: string
          title: string
        }
        Update: {
          bucket?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          file_size?: number | null
          id?: string
          job_id?: string
          kind?: string
          mime_type?: string | null
          source_id?: string | null
          source_table?: string | null
          storage_path?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_documents_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_order_drafts: {
        Row: {
          company_id: string
          created_at: string
          dump_cost: number
          extra_costs: Json
          id: string
          inputs: Json
          job_id: string
          labor_overrides: Json
          manual_input_keys: string[]
          markup_pct: number
          material_overrides: Json
          notes: string | null
          permit_cost: number
          sales_tax_pct: number
          template_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          dump_cost?: number
          extra_costs?: Json
          id?: string
          inputs?: Json
          job_id: string
          labor_overrides?: Json
          manual_input_keys?: string[]
          markup_pct?: number
          material_overrides?: Json
          notes?: string | null
          permit_cost?: number
          sales_tax_pct?: number
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          dump_cost?: number
          extra_costs?: Json
          id?: string
          inputs?: Json
          job_id?: string
          labor_overrides?: Json
          manual_input_keys?: string[]
          markup_pct?: number
          material_overrides?: Json
          notes?: string | null
          permit_cost?: number
          sales_tax_pct?: number
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_order_drafts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_order_drafts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "roof_system_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      job_order_history: {
        Row: {
          action: string
          actor: string | null
          company_id: string
          created_at: string
          id: string
          job_id: string
          payload: Json
          snapshot_id: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          company_id: string
          created_at?: string
          id?: string
          job_id: string
          payload?: Json
          snapshot_id?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          company_id?: string
          created_at?: string
          id?: string
          job_id?: string
          payload?: Json
          snapshot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_order_history_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "job_order_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      job_order_snapshots: {
        Row: {
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          company_id: string
          cost_per_sq: number
          created_at: string
          created_by: string | null
          dump_cost: number
          extra_costs: Json
          id: string
          inputs: Json
          job_id: string
          labor: Json
          materials: Json
          per_sq_price: number
          permit_cost: number
          snapshot_date: string
          status: Database["public"]["Enums"]["order_snapshot_status"]
          submitted_at: string | null
          template_label: string | null
          total_squares: number
          totals: Json
          version_number: number | null
        }
        Insert: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          cost_per_sq?: number
          created_at?: string
          created_by?: string | null
          dump_cost?: number
          extra_costs?: Json
          id?: string
          inputs?: Json
          job_id: string
          labor?: Json
          materials?: Json
          per_sq_price?: number
          permit_cost?: number
          snapshot_date?: string
          status?: Database["public"]["Enums"]["order_snapshot_status"]
          submitted_at?: string | null
          template_label?: string | null
          total_squares?: number
          totals?: Json
          version_number?: number | null
        }
        Update: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          cost_per_sq?: number
          created_at?: string
          created_by?: string | null
          dump_cost?: number
          extra_costs?: Json
          id?: string
          inputs?: Json
          job_id?: string
          labor?: Json
          materials?: Json
          per_sq_price?: number
          permit_cost?: number
          snapshot_date?: string
          status?: Database["public"]["Enums"]["order_snapshot_status"]
          submitted_at?: string | null
          template_label?: string | null
          total_squares?: number
          totals?: Json
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_order_snapshots_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_photos: {
        Row: {
          ai_analysis: Json
          caption: string | null
          company_id: string
          created_at: string
          exif_gps: Json | null
          id: string
          job_id: string
          matched_line_items: Json
          status: string
          storage_path: string
          tag: string | null
          taken_at: string | null
          trade_hint: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          ai_analysis?: Json
          caption?: string | null
          company_id: string
          created_at?: string
          exif_gps?: Json | null
          id?: string
          job_id: string
          matched_line_items?: Json
          status?: string
          storage_path: string
          tag?: string | null
          taken_at?: string | null
          trade_hint?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          ai_analysis?: Json
          caption?: string | null
          company_id?: string
          created_at?: string
          exif_gps?: Json | null
          id?: string
          job_id?: string
          matched_line_items?: Json
          status?: string
          storage_path?: string
          tag?: string | null
          taken_at?: string | null
          trade_hint?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_property_analyses: {
        Row: {
          analysis: Json
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          job_id: string
          photo_count: number
        }
        Insert: {
          analysis?: Json
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          job_id: string
          photo_count?: number
        }
        Update: {
          analysis?: Json
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string
          photo_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_property_analyses_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_reports: {
        Row: {
          company_id: string
          cover_settings: Json
          created_at: string
          id: string
          job_id: string
          rep_user_id: string | null
          sections: Json
          template_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          cover_settings?: Json
          created_at?: string
          id?: string
          job_id: string
          rep_user_id?: string | null
          sections?: Json
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          cover_settings?: Json
          created_at?: string
          id?: string
          job_id?: string
          rep_user_id?: string | null
          sections?: Json
          template_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          assigned_to: string | null
          claim_number: string | null
          client_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          insurance_carrier: string | null
          job_number: string | null
          job_type: string | null
          jurisdiction: string | null
          name: string
          notes: string | null
          price_book_id: string | null
          primary_trade: Database["public"]["Enums"]["trade_type"] | null
          property_address: string | null
          property_id: string | null
          roof_system: string | null
          status: Database["public"]["Enums"]["job_status"]
          total_estimate: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          claim_number?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          insurance_carrier?: string | null
          job_number?: string | null
          job_type?: string | null
          jurisdiction?: string | null
          name: string
          notes?: string | null
          price_book_id?: string | null
          primary_trade?: Database["public"]["Enums"]["trade_type"] | null
          property_address?: string | null
          property_id?: string | null
          roof_system?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          total_estimate?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          claim_number?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          insurance_carrier?: string | null
          job_number?: string | null
          job_type?: string | null
          jurisdiction?: string | null
          name?: string
          notes?: string | null
          price_book_id?: string | null
          primary_trade?: Database["public"]["Enums"]["trade_type"] | null
          property_address?: string | null
          property_id?: string | null
          roof_system?: string | null
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
      lead_activities: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          note: string | null
          type: Database["public"]["Enums"]["lead_activity_type"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          note?: string | null
          type: Database["public"]["Enums"]["lead_activity_type"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          note?: string | null
          type?: Database["public"]["Enums"]["lead_activity_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_contact_emails: {
        Row: {
          contact_id: string
          email: string
          id: string
        }
        Insert: {
          contact_id: string
          email: string
          id?: string
        }
        Update: {
          contact_id?: string
          email?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_contact_emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "lead_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_contact_phones: {
        Row: {
          contact_id: string
          id: string
          phone: string
          phone_type: string
        }
        Insert: {
          contact_id: string
          id?: string
          phone: string
          phone_type?: string
        }
        Update: {
          contact_id?: string
          id?: string
          phone?: string
          phone_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_contact_phones_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "lead_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_contacts: {
        Row: {
          company: string | null
          created_at: string
          id: string
          lead_id: string
          name: string
          sort_order: number
          title: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          id?: string
          lead_id: string
          name: string
          sort_order?: number
          title?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          name?: string
          sort_order?: number
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_documents: {
        Row: {
          company_id: string
          created_at: string
          id: string
          kind: string
          lead_id: string
          mime_type: string | null
          name: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          kind?: string
          lead_id: string
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          kind?: string
          lead_id?: string
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      lead_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          lead_id: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lead_id: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lead_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_reports: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          inputs: Json
          kind: string
          lead_id: string
          name: string
          pdf_path: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          inputs?: Json
          kind?: string
          lead_id: string
          name: string
          pdf_path: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          inputs?: Json
          kind?: string
          lead_id?: string
          name?: string
          pdf_path?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          address: string
          ai_report: Json
          assigned_to: string | null
          city: string | null
          company_id: string
          created_at: string
          created_by: string | null
          estimated_value: number | null
          id: string
          import_date: string
          lat: number | null
          lng: number | null
          owner: string | null
          property_type: string | null
          reported_owner: string | null
          roof_type: string | null
          sale_amount: string | null
          sqft: number | null
          state: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          year_built: string | null
          zip: string | null
        }
        Insert: {
          address: string
          ai_report?: Json
          assigned_to?: string | null
          city?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          estimated_value?: number | null
          id?: string
          import_date?: string
          lat?: number | null
          lng?: number | null
          owner?: string | null
          property_type?: string | null
          reported_owner?: string | null
          roof_type?: string | null
          sale_amount?: string | null
          sqft?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          year_built?: string | null
          zip?: string | null
        }
        Update: {
          address?: string
          ai_report?: Json
          assigned_to?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          estimated_value?: number | null
          id?: string
          import_date?: string
          lat?: number | null
          lng?: number | null
          owner?: string | null
          property_type?: string | null
          reported_owner?: string | null
          roof_type?: string | null
          sale_amount?: string | null
          sqft?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          year_built?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      line_item_master: {
        Row: {
          category: string | null
          code: string
          company_id: string | null
          created_at: string
          default_price: number
          description: string | null
          domain: string | null
          hours: number | null
          id: string
          material_cost: number | null
          name: string
          price_book_code: string | null
          remove_price: number | null
          replace_price: number | null
          status: Database["public"]["Enums"]["catalog_status"]
          subgroup: string | null
          tags: string[]
          trade: Database["public"]["Enums"]["trade_type"]
          trade_name: string | null
          unit: string
          updated_at: string
          waste_pct: number
          xactimate_prefix: string | null
        }
        Insert: {
          category?: string | null
          code: string
          company_id?: string | null
          created_at?: string
          default_price?: number
          description?: string | null
          domain?: string | null
          hours?: number | null
          id?: string
          material_cost?: number | null
          name: string
          price_book_code?: string | null
          remove_price?: number | null
          replace_price?: number | null
          status?: Database["public"]["Enums"]["catalog_status"]
          subgroup?: string | null
          tags?: string[]
          trade: Database["public"]["Enums"]["trade_type"]
          trade_name?: string | null
          unit?: string
          updated_at?: string
          waste_pct?: number
          xactimate_prefix?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          company_id?: string | null
          created_at?: string
          default_price?: number
          description?: string | null
          domain?: string | null
          hours?: number | null
          id?: string
          material_cost?: number | null
          name?: string
          price_book_code?: string | null
          remove_price?: number | null
          replace_price?: number | null
          status?: Database["public"]["Enums"]["catalog_status"]
          subgroup?: string | null
          tags?: string[]
          trade?: Database["public"]["Enums"]["trade_type"]
          trade_name?: string | null
          unit?: string
          updated_at?: string
          waste_pct?: number
          xactimate_prefix?: string | null
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
      line_item_prices: {
        Row: {
          created_at: string
          equipment_cost: number | null
          equipment_pct: number | null
          id: string
          labor_cost: number | null
          labor_pct: number | null
          line_item_master_id: string
          material_cost: number | null
          material_pct: number | null
          misc_cost: number | null
          overhead_pct: number | null
          price_book_id: string
          remove_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          equipment_cost?: number | null
          equipment_pct?: number | null
          id?: string
          labor_cost?: number | null
          labor_pct?: number | null
          line_item_master_id: string
          material_cost?: number | null
          material_pct?: number | null
          misc_cost?: number | null
          overhead_pct?: number | null
          price_book_id: string
          remove_price?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          equipment_cost?: number | null
          equipment_pct?: number | null
          id?: string
          labor_cost?: number | null
          labor_pct?: number | null
          line_item_master_id?: string
          material_cost?: number | null
          material_pct?: number | null
          misc_cost?: number | null
          overhead_pct?: number | null
          price_book_id?: string
          remove_price?: number
          unit_price?: number
        }
        Relationships: []
      }
      master_macro_items: {
        Row: {
          created_at: string
          id: string
          is_optional: boolean
          item_notes: string | null
          line_item_master_id: string
          macro_id: string
          qty: number
          qty_mode: string
          sort_order: number
          unit: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_optional?: boolean
          item_notes?: string | null
          line_item_master_id: string
          macro_id: string
          qty?: number
          qty_mode?: string
          sort_order?: number
          unit?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_optional?: boolean
          item_notes?: string | null
          line_item_master_id?: string
          macro_id?: string
          qty?: number
          qty_mode?: string
          sort_order?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_macro_items_line_item_master_id_fkey"
            columns: ["line_item_master_id"]
            isOneToOne: false
            referencedRelation: "line_item_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_macro_items_macro_id_fkey"
            columns: ["macro_id"]
            isOneToOne: false
            referencedRelation: "master_macros"
            referencedColumns: ["id"]
          },
        ]
      }
      master_macros: {
        Row: {
          asset_type: string | null
          category: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_addon: boolean
          is_default: boolean
          kind: string
          name: string
          trade: Database["public"]["Enums"]["trade_type"] | null
          updated_at: string
        }
        Insert: {
          asset_type?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_addon?: boolean
          is_default?: boolean
          kind?: string
          name: string
          trade?: Database["public"]["Enums"]["trade_type"] | null
          updated_at?: string
        }
        Update: {
          asset_type?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_addon?: boolean
          is_default?: boolean
          kind?: string
          name?: string
          trade?: Database["public"]["Enums"]["trade_type"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_macros_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      material_catalog: {
        Row: {
          active: boolean
          brand: string | null
          category_id: string
          company_id: string | null
          coverage: Json | null
          coverage_base: string | null
          coverage_sq: number | null
          created_at: string
          effective_date: string | null
          id: string
          name: string
          notes: string | null
          slug: string | null
          supplier_id: string | null
          unit_price: number
          uom: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand?: string | null
          category_id: string
          company_id?: string | null
          coverage?: Json | null
          coverage_base?: string | null
          coverage_sq?: number | null
          created_at?: string
          effective_date?: string | null
          id?: string
          name: string
          notes?: string | null
          slug?: string | null
          supplier_id?: string | null
          unit_price?: number
          uom: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand?: string | null
          category_id?: string
          company_id?: string | null
          coverage?: Json | null
          coverage_base?: string | null
          coverage_sq?: number | null
          created_at?: string
          effective_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          slug?: string | null
          supplier_id?: string | null
          unit_price?: number
          uom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_catalog_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "material_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_catalog_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_catalog_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "material_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      material_categories: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          label: string
          slug: string
          sort_order: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          label: string
          slug: string
          sort_order?: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          label?: string
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      material_suppliers: {
        Row: {
          active: boolean
          branch: string | null
          company_id: string | null
          created_at: string
          id: string
          name: string
          rep_email: string | null
          rep_name: string | null
          rep_phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          name: string
          rep_email?: string | null
          rep_name?: string | null
          rep_phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          name?: string
          rep_email?: string | null
          rep_name?: string | null
          rep_phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_suggestion_decisions: {
        Row: {
          ai_confidence: string | null
          ai_description: string | null
          asset_type: string | null
          company_id: string
          decided_at: string
          decided_by: string | null
          decision: string
          estimate_id: string | null
          final_code: string | null
          final_qty: number | null
          final_unit: string | null
          id: string
          job_id: string
          photo_id: string | null
          reviewed_at: string | null
          reviewed_by_admin: string | null
          source_photo_ids: string[]
          suggested_code: string
          suggested_qty: number | null
          suggested_unit: string | null
          trade: string | null
        }
        Insert: {
          ai_confidence?: string | null
          ai_description?: string | null
          asset_type?: string | null
          company_id: string
          decided_at?: string
          decided_by?: string | null
          decision: string
          estimate_id?: string | null
          final_code?: string | null
          final_qty?: number | null
          final_unit?: string | null
          id?: string
          job_id: string
          photo_id?: string | null
          reviewed_at?: string | null
          reviewed_by_admin?: string | null
          source_photo_ids?: string[]
          suggested_code: string
          suggested_qty?: number | null
          suggested_unit?: string | null
          trade?: string | null
        }
        Update: {
          ai_confidence?: string | null
          ai_description?: string | null
          asset_type?: string | null
          company_id?: string
          decided_at?: string
          decided_by?: string | null
          decision?: string
          estimate_id?: string | null
          final_code?: string | null
          final_qty?: number | null
          final_unit?: string | null
          id?: string
          job_id?: string
          photo_id?: string | null
          reviewed_at?: string | null
          reviewed_by_admin?: string | null
          source_photo_ids?: string[]
          suggested_code?: string
          suggested_qty?: number | null
          suggested_unit?: string | null
          trade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photo_suggestion_decisions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_suggestion_decisions_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_suggestion_decisions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_suggestion_decisions_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "job_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_preferences: {
        Row: {
          id: string
          selected_sections: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          selected_sections?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          selected_sections?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      price_books: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          effective_month: string | null
          id: string
          is_active: boolean
          is_default: boolean
          item_count: number
          jurisdiction: string | null
          name: string
          notes: string | null
          pricing_type: Database["public"]["Enums"]["price_book_pricing_type"]
          region: string | null
          region_name: string | null
          source: string | null
          source_file_url: string | null
          status: Database["public"]["Enums"]["price_book_status"]
          updated_at: string
          zip_codes: string[]
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          effective_month?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          item_count?: number
          jurisdiction?: string | null
          name: string
          notes?: string | null
          pricing_type?: Database["public"]["Enums"]["price_book_pricing_type"]
          region?: string | null
          region_name?: string | null
          source?: string | null
          source_file_url?: string | null
          status?: Database["public"]["Enums"]["price_book_status"]
          updated_at?: string
          zip_codes?: string[]
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          effective_month?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          item_count?: number
          jurisdiction?: string | null
          name?: string
          notes?: string | null
          pricing_type?: Database["public"]["Enums"]["price_book_pricing_type"]
          region?: string | null
          region_name?: string | null
          source?: string | null
          source_file_url?: string | null
          status?: Database["public"]["Enums"]["price_book_status"]
          updated_at?: string
          zip_codes?: string[]
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
          avatar_url: string | null
          bio: string | null
          card_published: boolean
          card_slug: string | null
          company_id: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          mobile_phone: string | null
          office_phone: string | null
          onboarding_completed_at: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          title: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          card_published?: boolean
          card_slug?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          mobile_phone?: string | null
          office_phone?: string | null
          onboarding_completed_at?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          card_published?: boolean
          card_slug?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          mobile_phone?: string | null
          office_phone?: string | null
          onboarding_completed_at?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          title?: string | null
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
      properties: {
        Row: {
          address: string
          city: string | null
          client_id: string
          company_id: string
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          notes: string | null
          property_type: string | null
          roof_type: string | null
          state: string | null
          updated_at: string
          year_built: number | null
          zip: string | null
        }
        Insert: {
          address: string
          city?: string | null
          client_id: string
          company_id: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          property_type?: string | null
          roof_type?: string | null
          state?: string | null
          updated_at?: string
          year_built?: number | null
          zip?: string | null
        }
        Update: {
          address?: string
          city?: string | null
          client_id?: string
          company_id?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          property_type?: string | null
          roof_type?: string | null
          state?: string | null
          updated_at?: string
          year_built?: number | null
          zip?: string | null
        }
        Relationships: []
      }
      property_dispositions: {
        Row: {
          address: string | null
          converted_at: string | null
          converted_job_id: string | null
          created_at: string | null
          current_disposition:
            | Database["public"]["Enums"]["door_disposition"]
            | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          disposition: Database["public"]["Enums"]["door_disposition"] | null
          id: string
          insurance_claim: boolean | null
          last_knocked_at: string | null
          lat: number | null
          lat_lng_hash: string
          latitude: number | null
          lng: number | null
          longitude: number | null
          measurement: Json | null
          metadata: Json | null
          notes: string | null
          priority: string | null
          roof_condition: string | null
          roof_type: string | null
          selected_quote: Json | null
          selected_system_type: string | null
          selected_tier: string | null
          status: Database["public"]["Enums"]["property_status"] | null
          storm_date: string | null
          tags: string[] | null
          total_knocks: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          converted_at?: string | null
          converted_job_id?: string | null
          created_at?: string | null
          current_disposition?:
            | Database["public"]["Enums"]["door_disposition"]
            | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          disposition?: Database["public"]["Enums"]["door_disposition"] | null
          id?: string
          insurance_claim?: boolean | null
          last_knocked_at?: string | null
          lat?: number | null
          lat_lng_hash: string
          latitude?: number | null
          lng?: number | null
          longitude?: number | null
          measurement?: Json | null
          metadata?: Json | null
          notes?: string | null
          priority?: string | null
          roof_condition?: string | null
          roof_type?: string | null
          selected_quote?: Json | null
          selected_system_type?: string | null
          selected_tier?: string | null
          status?: Database["public"]["Enums"]["property_status"] | null
          storm_date?: string | null
          tags?: string[] | null
          total_knocks?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          converted_at?: string | null
          converted_job_id?: string | null
          created_at?: string | null
          current_disposition?:
            | Database["public"]["Enums"]["door_disposition"]
            | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          disposition?: Database["public"]["Enums"]["door_disposition"] | null
          id?: string
          insurance_claim?: boolean | null
          last_knocked_at?: string | null
          lat?: number | null
          lat_lng_hash?: string
          latitude?: number | null
          lng?: number | null
          longitude?: number | null
          measurement?: Json | null
          metadata?: Json | null
          notes?: string | null
          priority?: string | null
          roof_condition?: string | null
          roof_type?: string | null
          selected_quote?: Json | null
          selected_system_type?: string | null
          selected_tier?: string | null
          status?: Database["public"]["Enums"]["property_status"] | null
          storm_date?: string | null
          tags?: string[] | null
          total_knocks?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_dispositions_converted_job_id_fkey"
            columns: ["converted_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      property_intelligence: {
        Row: {
          county: string | null
          flood_risk_zone: string | null
          geom: unknown
          hail_hits: number | null
          id: string
          last_storm_date: string | null
          property_id: string | null
          property_value: number | null
          risk_score: number | null
          roof_age: number | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          county?: string | null
          flood_risk_zone?: string | null
          geom?: unknown
          hail_hits?: number | null
          id?: string
          last_storm_date?: string | null
          property_id?: string | null
          property_value?: number | null
          risk_score?: number | null
          roof_age?: number | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          county?: string | null
          flood_risk_zone?: string | null
          geom?: unknown
          hail_hits?: number | null
          id?: string
          last_storm_date?: string | null
          property_id?: string | null
          property_value?: number | null
          risk_score?: number | null
          roof_age?: number | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      property_notes: {
        Row: {
          created_at: string
          id: string
          note: string
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note: string
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_notes_property_disposition_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_dispositions"
            referencedColumns: ["id"]
          },
        ]
      }
      property_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          photo_type: string
          photo_url: string
          property_id: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          photo_type?: string
          photo_url: string
          property_id: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          photo_type?: string
          photo_url?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_dispositions"
            referencedColumns: ["id"]
          },
        ]
      }
      property_residents: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string | null
          phone: string | null
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string | null
          phone?: string | null
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string | null
          phone?: string | null
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_residents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property_dispositions"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_card_blocks: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          is_visible: boolean
          kind: string
          sort_order: number
          storage_path: string | null
          subtitle: string | null
          thumb_url: string | null
          title: string | null
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_visible?: boolean
          kind: string
          sort_order?: number
          storage_path?: string | null
          subtitle?: string | null
          thumb_url?: string | null
          title?: string | null
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_visible?: boolean
          kind?: string
          sort_order?: number
          storage_path?: string | null
          subtitle?: string | null
          thumb_url?: string | null
          title?: string | null
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_card_blocks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      report_assets: {
        Row: {
          bucket: string
          company_id: string
          created_at: string
          created_by: string | null
          file_size: number | null
          id: string
          job_id: string | null
          kind: string
          meta: Json
          mime_type: string | null
          storage_path: string
        }
        Insert: {
          bucket?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          file_size?: number | null
          id?: string
          job_id?: string | null
          kind: string
          meta?: Json
          mime_type?: string | null
          storage_path: string
        }
        Update: {
          bucket?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          file_size?: number | null
          id?: string
          job_id?: string | null
          kind?: string
          meta?: Json
          mime_type?: string | null
          storage_path?: string
        }
        Relationships: []
      }
      report_templates: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          name: string
          sections: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name: string
          sections?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name?: string
          sections?: Json
          updated_at?: string
        }
        Relationships: []
      }
      reward_redemptions: {
        Row: {
          expires_at: string | null
          id: string
          points_spent: number
          redeemed_at: string | null
          reward_id: string
          status: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          id?: string
          points_spent: number
          redeemed_at?: string | null
          reward_id: string
          status?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          expires_at?: string | null
          id?: string
          points_spent?: number
          redeemed_at?: string | null
          reward_id?: string
          status?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards_catalog: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_available: boolean | null
          name: string
          points_cost: number
          quantity_available: number | null
          reward_type: string
          reward_value: string | null
          updated_at: string | null
          valid_days: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_available?: boolean | null
          name: string
          points_cost: number
          quantity_available?: number | null
          reward_type: string
          reward_value?: string | null
          updated_at?: string | null
          valid_days?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_available?: boolean | null
          name?: string
          points_cost?: number
          quantity_available?: number | null
          reward_type?: string
          reward_value?: string | null
          updated_at?: string | null
          valid_days?: number | null
        }
        Relationships: []
      }
      rk_accounts: {
        Row: {
          city: string | null
          company_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          primary_contact: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          primary_contact?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          primary_contact?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rk_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      rk_form_templates: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          fields: Json
          id: string
          is_custom: boolean
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json
          id?: string
          is_custom?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json
          id?: string
          is_custom?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rk_form_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      rk_properties: {
        Row: {
          account_id: string
          address: string | null
          city: string | null
          company_id: string
          created_at: string
          id: string
          name: string
          roof_type: string | null
          state: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          account_id: string
          address?: string | null
          city?: string | null
          company_id: string
          created_at?: string
          id?: string
          name: string
          roof_type?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          account_id?: string
          address?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          roof_type?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rk_properties_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "rk_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rk_properties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      rk_tickets: {
        Row: {
          account_id: string
          assigned_to: string | null
          company_id: string
          completed: boolean
          contact: string | null
          created_at: string
          created_by: string | null
          field_notes_raw: string | null
          id: string
          invoice: Json | null
          labor: Json
          materials: Json
          phone: string | null
          price: number | null
          property_id: string
          purpose: string[]
          report_polished: string | null
          reported_concern: string | null
          roof_type: string | null
          service_date: string | null
          status: string
          updated_at: string
          wo_number: number | null
        }
        Insert: {
          account_id: string
          assigned_to?: string | null
          company_id: string
          completed?: boolean
          contact?: string | null
          created_at?: string
          created_by?: string | null
          field_notes_raw?: string | null
          id?: string
          invoice?: Json | null
          labor?: Json
          materials?: Json
          phone?: string | null
          price?: number | null
          property_id: string
          purpose?: string[]
          report_polished?: string | null
          reported_concern?: string | null
          roof_type?: string | null
          service_date?: string | null
          status?: string
          updated_at?: string
          wo_number?: number | null
        }
        Update: {
          account_id?: string
          assigned_to?: string | null
          company_id?: string
          completed?: boolean
          contact?: string | null
          created_at?: string
          created_by?: string | null
          field_notes_raw?: string | null
          id?: string
          invoice?: Json | null
          labor?: Json
          materials?: Json
          phone?: string | null
          price?: number | null
          property_id?: string
          purpose?: string[]
          report_polished?: string | null
          reported_concern?: string | null
          roof_type?: string | null
          service_date?: string | null
          status?: string
          updated_at?: string
          wo_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rk_tickets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "rk_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rk_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rk_tickets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "rk_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      roof_edges: {
        Row: {
          created_at: string
          edge_index: number
          edge_type: Database["public"]["Enums"]["roof_edge_type"]
          id: string
          length_lf: number
          section_id: string
        }
        Insert: {
          created_at?: string
          edge_index: number
          edge_type: Database["public"]["Enums"]["roof_edge_type"]
          id?: string
          length_lf?: number
          section_id: string
        }
        Update: {
          created_at?: string
          edge_index?: number
          edge_type?: Database["public"]["Enums"]["roof_edge_type"]
          id?: string
          length_lf?: number
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roof_edges_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "roof_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      roof_lines: {
        Row: {
          created_at: string
          id: string
          is_perimeter: boolean
          length_lf: number
          line_geojson: Json
          line_type: Database["public"]["Enums"]["roof_edge_type"]
          measurement_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_perimeter?: boolean
          length_lf?: number
          line_geojson: Json
          line_type: Database["public"]["Enums"]["roof_edge_type"]
          measurement_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_perimeter?: boolean
          length_lf?: number
          line_geojson?: Json
          line_type?: Database["public"]["Enums"]["roof_edge_type"]
          measurement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roof_lines_measurement_id_fkey"
            columns: ["measurement_id"]
            isOneToOne: false
            referencedRelation: "roof_measurements"
            referencedColumns: ["id"]
          },
        ]
      }
      roof_measurements: {
        Row: {
          ai_analysis: Json
          company_id: string
          created_at: string
          created_by: string | null
          drip_edge_lf: number
          eaves_lf: number
          gutters_lf: number
          hips_lf: number
          id: string
          notes: string | null
          parapet_wall_lf: number
          predominant_pitch: string | null
          property_id: string
          rakes_lf: number
          ridges_lf: number
          source: Database["public"]["Enums"]["roof_measurement_source"]
          source_file_url: string | null
          squares: number
          step_flashing_lf: number
          total_area_sqft: number
          transition_lf: number
          updated_at: string
          valleys_lf: number
          verified_at: string | null
          verified_by: string | null
          wall_flashing_lf: number
          waste_pct: number
        }
        Insert: {
          ai_analysis?: Json
          company_id: string
          created_at?: string
          created_by?: string | null
          drip_edge_lf?: number
          eaves_lf?: number
          gutters_lf?: number
          hips_lf?: number
          id?: string
          notes?: string | null
          parapet_wall_lf?: number
          predominant_pitch?: string | null
          property_id: string
          rakes_lf?: number
          ridges_lf?: number
          source?: Database["public"]["Enums"]["roof_measurement_source"]
          source_file_url?: string | null
          squares?: number
          step_flashing_lf?: number
          total_area_sqft?: number
          transition_lf?: number
          updated_at?: string
          valleys_lf?: number
          verified_at?: string | null
          verified_by?: string | null
          wall_flashing_lf?: number
          waste_pct?: number
        }
        Update: {
          ai_analysis?: Json
          company_id?: string
          created_at?: string
          created_by?: string | null
          drip_edge_lf?: number
          eaves_lf?: number
          gutters_lf?: number
          hips_lf?: number
          id?: string
          notes?: string | null
          parapet_wall_lf?: number
          predominant_pitch?: string | null
          property_id?: string
          rakes_lf?: number
          ridges_lf?: number
          source?: Database["public"]["Enums"]["roof_measurement_source"]
          source_file_url?: string | null
          squares?: number
          step_flashing_lf?: number
          total_area_sqft?: number
          transition_lf?: number
          updated_at?: string
          valleys_lf?: number
          verified_at?: string | null
          verified_by?: string | null
          wall_flashing_lf?: number
          waste_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "roof_measurements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      roof_sections: {
        Row: {
          actual_area_sqft: number
          color: string
          created_at: string
          id: string
          measurement_id: string
          name: string
          pitch: string
          pitch_multiplier: number
          plan_area_sqft: number
          polygon_geojson: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          actual_area_sqft?: number
          color?: string
          created_at?: string
          id?: string
          measurement_id: string
          name?: string
          pitch?: string
          pitch_multiplier?: number
          plan_area_sqft?: number
          polygon_geojson: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          actual_area_sqft?: number
          color?: string
          created_at?: string
          id?: string
          measurement_id?: string
          name?: string
          pitch?: string
          pitch_multiplier?: number
          plan_area_sqft?: number
          polygon_geojson?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roof_sections_measurement_id_fkey"
            columns: ["measurement_id"]
            isOneToOne: false
            referencedRelation: "roof_measurements"
            referencedColumns: ["id"]
          },
        ]
      }
      roof_system_templates: {
        Row: {
          active: boolean
          company_id: string | null
          created_at: string
          icon: string | null
          id: string
          inputs: Json
          label: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          inputs?: Json
          label: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          inputs?: Json
          label?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roof_system_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      session_feed_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_feed_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "session_feed_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_feed_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "session_feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      session_feed_posts: {
        Row: {
          content: string | null
          created_at: string | null
          doors_knocked: number | null
          goals_doors: number | null
          goals_leads: number | null
          id: string
          image_url: string | null
          leads_gotten: number | null
          media_urls: string[] | null
          points_earned: number | null
          post_type: string | null
          session_id: string | null
          user_id: string
          video_type: string | null
          video_url: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          doors_knocked?: number | null
          goals_doors?: number | null
          goals_leads?: number | null
          id?: string
          image_url?: string | null
          leads_gotten?: number | null
          media_urls?: string[] | null
          points_earned?: number | null
          post_type?: string | null
          session_id?: string | null
          user_id: string
          video_type?: string | null
          video_url?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          doors_knocked?: number | null
          goals_doors?: number | null
          goals_leads?: number | null
          id?: string
          image_url?: string | null
          leads_gotten?: number | null
          media_urls?: string[] | null
          points_earned?: number | null
          post_type?: string | null
          session_id?: string | null
          user_id?: string
          video_type?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_feed_posts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "field_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_feed_reactions: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_feed_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "session_feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      session_progress_videos: {
        Row: {
          caption: string | null
          challenges_mentioned: string | null
          created_at: string | null
          doors_at_recording: number | null
          id: string
          points_at_recording: number | null
          points_awarded: number | null
          points_multiplier: number | null
          session_id: string
          update_number: number | null
          updated_goals_doors: number | null
          updated_goals_leads: number | null
          user_id: string
          video_duration_seconds: number | null
          video_type: string | null
          video_url: string
        }
        Insert: {
          caption?: string | null
          challenges_mentioned?: string | null
          created_at?: string | null
          doors_at_recording?: number | null
          id?: string
          points_at_recording?: number | null
          points_awarded?: number | null
          points_multiplier?: number | null
          session_id: string
          update_number?: number | null
          updated_goals_doors?: number | null
          updated_goals_leads?: number | null
          user_id: string
          video_duration_seconds?: number | null
          video_type?: string | null
          video_url: string
        }
        Update: {
          caption?: string | null
          challenges_mentioned?: string | null
          created_at?: string | null
          doors_at_recording?: number | null
          id?: string
          points_at_recording?: number | null
          points_awarded?: number | null
          points_multiplier?: number | null
          session_id?: string
          update_number?: number | null
          updated_goals_doors?: number | null
          updated_goals_leads?: number | null
          user_id?: string
          video_duration_seconds?: number | null
          video_type?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_progress_videos_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "field_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      spf_calc_settings: {
        Row: {
          default_mode: string
          id: boolean
          updated_at: string
        }
        Insert: {
          default_mode?: string
          id?: boolean
          updated_at?: string
        }
        Update: {
          default_mode?: string
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      spf_details: {
        Row: {
          active: boolean
          created_at: string
          default_qty: number
          id: string
          label: string
          sort_order: number
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_qty?: number
          id?: string
          label: string
          sort_order?: number
          unit: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_qty?: number
          id?: string
          label?: string
          sort_order?: number
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      spf_field_defaults: {
        Row: {
          field_key: string
          group_key: string
          label: string
          simple_mode: boolean
          sort_order: number
          updated_at: string
          value_text: string
        }
        Insert: {
          field_key: string
          group_key: string
          label: string
          simple_mode?: boolean
          sort_order?: number
          updated_at?: string
          value_text: string
        }
        Update: {
          field_key?: string
          group_key?: string
          label?: string
          simple_mode?: boolean
          sort_order?: number
          updated_at?: string
          value_text?: string
        }
        Relationships: []
      }
      spf_products: {
        Row: {
          active: boolean
          cost_per_gal: number
          created_at: string
          default_method: string
          default_mils: number
          id: string
          name: string
          role: string
          solids_pct: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          cost_per_gal: number
          created_at?: string
          default_method: string
          default_mils: number
          id?: string
          name: string
          role: string
          solids_pct: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          cost_per_gal?: number
          created_at?: string
          default_method?: string
          default_mils?: number
          id?: string
          name?: string
          role?: string
          solids_pct?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      spf_stack_layers: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          mils: number
          on_by_default: boolean
          product_id: string
          scope: string
          sort_order: number
          stack_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          method: string
          mils: number
          on_by_default?: boolean
          product_id: string
          scope: string
          sort_order?: number
          stack_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          mils?: number
          on_by_default?: boolean
          product_id?: string
          scope?: string
          sort_order?: number
          stack_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spf_stack_layers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "spf_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spf_stack_layers_stack_id_fkey"
            columns: ["stack_id"]
            isOneToOne: false
            referencedRelation: "spf_stacks"
            referencedColumns: ["id"]
          },
        ]
      }
      spf_stacks: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      storm_events: {
        Row: {
          affected_area: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          severity: string
          storm_date: string
        }
        Insert: {
          affected_area?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          severity?: string
          storm_date: string
        }
        Update: {
          affected_area?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          severity?: string
          storm_date?: string
        }
        Relationships: []
      }
      storm_swaths: {
        Row: {
          band_label: string
          color_hex: string | null
          created_at: string | null
          event_date: string
          geom: unknown
          id: string
          max_size_in: number | null
          mesh_product: string
          min_size_in: number
        }
        Insert: {
          band_label: string
          color_hex?: string | null
          created_at?: string | null
          event_date: string
          geom: unknown
          id?: string
          max_size_in?: number | null
          mesh_product?: string
          min_size_in: number
        }
        Update: {
          band_label?: string
          color_hex?: string | null
          created_at?: string | null
          event_date?: string
          geom?: unknown
          id?: string
          max_size_in?: number | null
          mesh_product?: string
          min_size_in?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          company_id: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          company_id?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          company_id?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      template_labor_lines: {
        Row: {
          created_at: string
          formula: Json
          id: string
          rate: number
          sort_order: number
          task: string
          template_id: string
          uom: string
        }
        Insert: {
          created_at?: string
          formula?: Json
          id?: string
          rate?: number
          sort_order?: number
          task: string
          template_id: string
          uom: string
        }
        Update: {
          created_at?: string
          formula?: Json
          id?: string
          rate?: number
          sort_order?: number
          task?: string
          template_id?: string
          uom?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_labor_lines_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "roof_system_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_material_lines: {
        Row: {
          created_at: string
          default_material_id: string | null
          formula: Json
          id: string
          label: string
          sort_order: number
          template_id: string
        }
        Insert: {
          created_at?: string
          default_material_id?: string | null
          formula?: Json
          id?: string
          label: string
          sort_order?: number
          template_id: string
        }
        Update: {
          created_at?: string
          default_material_id?: string | null
          formula?: Json
          id?: string
          label?: string
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_material_lines_default_material_id_fkey"
            columns: ["default_material_id"]
            isOneToOne: false
            referencedRelation: "material_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_material_lines_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "roof_system_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          rep_email: string | null
          rep_name: string
          rep_phone: string | null
          rep_slug: string
          rep_title: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          rep_email?: string | null
          rep_name: string
          rep_phone?: string | null
          rep_slug: string
          rep_title?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          rep_email?: string | null
          rep_name?: string
          rep_phone?: string | null
          rep_slug?: string
          rep_title?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          accent_color: string
          accent_color_dark: string
          company_address: string | null
          company_email: string | null
          company_id: string | null
          company_name: string
          company_phone: string | null
          company_web: string | null
          created_at: string
          id: string
          is_active: boolean
          jurisdiction_state: string
          legal_addendum_url: string | null
          logo_base64: string | null
          sign_base_url: string | null
          slug: string
        }
        Insert: {
          accent_color?: string
          accent_color_dark?: string
          company_address?: string | null
          company_email?: string | null
          company_id?: string | null
          company_name: string
          company_phone?: string | null
          company_web?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          jurisdiction_state?: string
          legal_addendum_url?: string | null
          logo_base64?: string | null
          sign_base_url?: string | null
          slug: string
        }
        Update: {
          accent_color?: string
          accent_color_dark?: string
          company_address?: string | null
          company_email?: string | null
          company_id?: string | null
          company_name?: string
          company_phone?: string | null
          company_web?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          jurisdiction_state?: string
          legal_addendum_url?: string | null
          logo_base64?: string | null
          sign_base_url?: string | null
          slug?: string
        }
        Relationships: []
      }
      territories: {
        Row: {
          contractor_id: string | null
          county_fips: string | null
          created_at: string | null
          geom: unknown
          id: string
          name: string
          source: string | null
          state: string | null
        }
        Insert: {
          contractor_id?: string | null
          county_fips?: string | null
          created_at?: string | null
          geom: unknown
          id?: string
          name: string
          source?: string | null
          state?: string | null
        }
        Update: {
          contractor_id?: string | null
          county_fips?: string | null
          created_at?: string | null
          geom?: unknown
          id?: string
          name?: string
          source?: string | null
          state?: string | null
        }
        Relationships: []
      }
      training_examples: {
        Row: {
          address: string
          created_at: string
          created_by: string | null
          ground_truth: Json
          id: string
          lat: number | null
          lng: number | null
          notes: string | null
          pdf_storage_path: string | null
          solar_response: Json
          source: string
          source_measurement_id: string | null
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          created_by?: string | null
          ground_truth?: Json
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          pdf_storage_path?: string | null
          solar_response?: Json
          source?: string
          source_measurement_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          created_by?: string | null
          ground_truth?: Json
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          pdf_storage_path?: string | null
          solar_response?: Json
          source?: string
          source_measurement_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          displayed: boolean | null
          earned_at: string | null
          id: string
          notified: boolean | null
          user_id: string
        }
        Insert: {
          badge_id: string
          displayed?: boolean | null
          earned_at?: string | null
          id?: string
          notified?: boolean | null
          user_id: string
        }
        Update: {
          badge_id?: string
          displayed?: boolean | null
          earned_at?: string | null
          id?: string
          notified?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_gamification: {
        Row: {
          available_points: number | null
          created_at: string | null
          current_level: string | null
          current_streak: number | null
          daily_streak: number | null
          id: string
          last_active_at: string | null
          last_streak_action_at: string | null
          longest_streak: number | null
          monthly_points: number | null
          monthly_referrals: number | null
          successful_referrals: number | null
          total_points: number | null
          total_referrals: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          available_points?: number | null
          created_at?: string | null
          current_level?: string | null
          current_streak?: number | null
          daily_streak?: number | null
          id?: string
          last_active_at?: string | null
          last_streak_action_at?: string | null
          longest_streak?: number | null
          monthly_points?: number | null
          monthly_referrals?: number | null
          successful_referrals?: number | null
          total_points?: number | null
          total_referrals?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          available_points?: number | null
          created_at?: string | null
          current_level?: string | null
          current_streak?: number | null
          daily_streak?: number | null
          id?: string
          last_active_at?: string | null
          last_streak_action_at?: string | null
          longest_streak?: number | null
          monthly_points?: number | null
          monthly_referrals?: number | null
          successful_referrals?: number | null
          total_points?: number | null
          total_referrals?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_locations: {
        Row: {
          accuracy: number | null
          id: string
          lat: number
          lng: number
          recorded_at: string | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          id?: string
          lat: number
          lng: number
          recorded_at?: string | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          id?: string
          lat?: number
          lng?: number
          recorded_at?: string | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_locations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "field_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_rewards: {
        Row: {
          earned_at: string
          id: string
          points_spent: number
          redeemed_at: string | null
          reward_id: string | null
          reward_name: string
          user_id: string
        }
        Insert: {
          earned_at?: string
          id?: string
          points_spent?: number
          redeemed_at?: string | null
          reward_id?: string | null
          reward_name: string
          user_id: string
        }
        Update: {
          earned_at?: string
          id?: string
          points_spent?: number
          redeemed_at?: string | null
          reward_id?: string | null
          reward_name?: string
          user_id?: string
        }
        Relationships: []
      }
      video_verifications: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          id: string
          points_awarded: number | null
          session_id: string
          user_id: string
          verification_type: string
          verified: boolean | null
          video_url: string
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          points_awarded?: number | null
          session_id: string
          user_id: string
          verification_type?: string
          verified?: boolean | null
          video_url: string
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          points_awarded?: number | null
          session_id?: string
          user_id?: string
          verification_type?: string
          verified?: boolean | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_verifications_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "field_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      wind_events: {
        Row: {
          dedupe_key: string
          event_time: string
          geom: unknown
          id: string
          ingested_at: string | null
          nws_event_id: string | null
          raw: Json | null
          source: string
          wind_mph: number | null
        }
        Insert: {
          dedupe_key: string
          event_time: string
          geom: unknown
          id?: string
          ingested_at?: string | null
          nws_event_id?: string | null
          raw?: Json | null
          source: string
          wind_mph?: number | null
        }
        Update: {
          dedupe_key?: string
          event_time?: string
          geom?: unknown
          id?: string
          ingested_at?: string | null
          nws_event_id?: string | null
          raw?: Json | null
          source?: string
          wind_mph?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      accept_company_invite: { Args: { _token: string }; Returns: Json }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      approve_join_request: { Args: { _id: string }; Returns: Json }
      approve_order_snapshot: {
        Args: { _id: string; _note?: string }
        Returns: {
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          company_id: string
          cost_per_sq: number
          created_at: string
          created_by: string | null
          dump_cost: number
          extra_costs: Json
          id: string
          inputs: Json
          job_id: string
          labor: Json
          materials: Json
          per_sq_price: number
          permit_cost: number
          snapshot_date: string
          status: Database["public"]["Enums"]["order_snapshot_status"]
          submitted_at: string | null
          template_label: string | null
          total_squares: number
          totals: Json
          version_number: number | null
        }
        SetofOptions: {
          from: "*"
          to: "job_order_snapshots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      auth_company_id: { Args: never; Returns: string }
      auth_tenant_id: { Args: never; Returns: string }
      create_company_as_super_admin: {
        Args: {
          _address?: string
          _email?: string
          _name: string
          _phone?: string
          _website?: string
        }
        Returns: string
      }
      create_company_invite_as_super_admin: {
        Args: {
          _company_id: string
          _email: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: Json
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      generate_storm_swaths: {
        Args: { p_event_date: string; p_product?: string; p_simplify?: number }
        Returns: {
          area_sq_mi: number
          band: string
          cells: number
        }[]
      }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_invite_preview: { Args: { _token: string }; Returns: Json }
      get_public_rep_card: { Args: { _slug: string }; Returns: Json }
      gettransactionid: { Args: never; Returns: unknown }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_card_slug_available: { Args: { _slug: string }; Returns: boolean }
      is_company_admin: { Args: never; Returns: boolean }
      is_roof_king_member: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      list_companies_for_signup: {
        Args: never
        Returns: {
          id: string
          name: string
        }[]
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      recompute_invoice_balance: {
        Args: { _invoice_id: string }
        Returns: undefined
      }
      recompute_invoice_totals: {
        Args: { _invoice_id: string }
        Returns: undefined
      }
      reject_join_request: { Args: { _id: string }; Returns: Json }
      reject_order_snapshot: {
        Args: { _id: string; _note?: string }
        Returns: {
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          company_id: string
          cost_per_sq: number
          created_at: string
          created_by: string | null
          dump_cost: number
          extra_costs: Json
          id: string
          inputs: Json
          job_id: string
          labor: Json
          materials: Json
          per_sq_price: number
          permit_cost: number
          snapshot_date: string
          status: Database["public"]["Enums"]["order_snapshot_status"]
          submitted_at: string | null
          template_label: string | null
          total_squares: number
          totals: Json
          version_number: number | null
        }
        SetofOptions: {
          from: "*"
          to: "job_order_snapshots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_to_join_company: { Args: { _company_id: string }; Returns: Json }
      rk_next_wo: { Args: { _company_id: string }; Returns: number }
      rollback_order_snapshot: {
        Args: { _id: string }
        Returns: {
          company_id: string
          created_at: string
          dump_cost: number
          extra_costs: Json
          id: string
          inputs: Json
          job_id: string
          labor_overrides: Json
          manual_input_keys: string[]
          markup_pct: number
          material_overrides: Json
          notes: string | null
          permit_cost: number
          sales_tax_pct: number
          template_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "job_order_drafts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      submit_order_snapshot: {
        Args: { _id: string }
        Returns: {
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          company_id: string
          cost_per_sq: number
          created_at: string
          created_by: string | null
          dump_cost: number
          extra_costs: Json
          id: string
          inputs: Json
          job_id: string
          labor: Json
          materials: Json
          per_sq_price: number
          permit_cost: number
          snapshot_date: string
          status: Database["public"]["Enums"]["order_snapshot_status"]
          submitted_at: string | null
          template_label: string | null
          total_squares: number
          totals: Json
          version_number: number | null
        }
        SetofOptions: {
          from: "*"
          to: "job_order_snapshots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      swath_dates: {
        Args: never
        Returns: {
          bands: number
          event_date: string
          max_size_in: number
          mesh_product: string
        }[]
      }
      swath_geojson: {
        Args: { p_event_date: string; p_product?: string }
        Returns: Json
      }
      territories_geojson: { Args: never; Returns: Json }
      unlockrows: { Args: { "": string }; Returns: number }
      update_company_invite_email: {
        Args: { _id: string; _new_email: string }
        Returns: Json
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      wind_geojson: { Args: { p_hours?: number }; Returns: Json }
    }
    Enums: {
      app_role: "owner" | "admin" | "estimator" | "member" | "super_admin"
      catalog_status: "active" | "inactive"
      companion_rule_type: "required" | "recommended" | "conditional"
      door_disposition:
        | "not_home"
        | "not_interested"
        | "go_back"
        | "interested"
        | "needs_inspection"
        | "appointment_set"
        | "contract_signed"
        | "need_inspection"
        | "storm_damage"
        | "unqualified"
        | "canvass_lead"
        | "new_roof"
        | "follow_up"
        | "waiting"
        | "already_solar"
        | "opportunity"
        | "commercial"
        | "inspected"
        | "old_roof"
        | "won"
        | "not_contacted"
      estimate_doc_status: "draft" | "sent" | "approved" | "rejected"
      estimate_status: "draft" | "sent" | "approved" | "rejected"
      invoice_line_kind: "catalog" | "custom"
      invoice_payment_method:
        | "stripe"
        | "paypal"
        | "cash"
        | "check"
        | "ach"
        | "other"
      invoice_payment_status: "pending" | "succeeded" | "failed" | "refunded"
      invoice_status: "draft" | "sent" | "partial" | "paid" | "void" | "overdue"
      invoice_template_kind: "preset" | "ai"
      job_status:
        | "lead"
        | "inspected"
        | "estimated"
        | "proposed"
        | "signed"
        | "in_progress"
        | "complete"
      join_request_status: "pending" | "approved" | "rejected"
      lead_activity_type:
        | "call"
        | "email"
        | "text"
        | "note"
        | "status"
        | "ai_analysis"
        | "report_generated"
        | "report_sent"
        | "document_uploaded"
        | "document_deleted"
        | "lead_created"
        | "lead_deleted"
        | "geocoded"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "quoted"
        | "won"
        | "lost"
        | "dnc"
        | "report_sent"
      order_snapshot_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "superseded"
        | "rejected"
      price_book_pricing_type: "default" | "insurance" | "retail"
      price_book_status: "active" | "archived"
      property_status:
        | "not_contacted"
        | "contacted"
        | "interested"
        | "not_interested"
        | "appointment"
        | "customer"
        | "do_not_knock"
      property_type: "residential" | "commercial"
      roof_edge_type:
        | "eave"
        | "rake"
        | "hip"
        | "ridge"
        | "valley"
        | "gutter"
        | "wall_flashing"
        | "step_flashing"
        | "transition"
        | "unlabeled"
        | "parapet_wall"
        | "drip_edge"
      roof_measurement_source:
        | "manual"
        | "mapbox_draw"
        | "google_solar"
        | "third_party_report"
        | "photo_ai"
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
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
      app_role: ["owner", "admin", "estimator", "member", "super_admin"],
      catalog_status: ["active", "inactive"],
      companion_rule_type: ["required", "recommended", "conditional"],
      door_disposition: [
        "not_home",
        "not_interested",
        "go_back",
        "interested",
        "needs_inspection",
        "appointment_set",
        "contract_signed",
        "need_inspection",
        "storm_damage",
        "unqualified",
        "canvass_lead",
        "new_roof",
        "follow_up",
        "waiting",
        "already_solar",
        "opportunity",
        "commercial",
        "inspected",
        "old_roof",
        "won",
        "not_contacted",
      ],
      estimate_doc_status: ["draft", "sent", "approved", "rejected"],
      estimate_status: ["draft", "sent", "approved", "rejected"],
      invoice_line_kind: ["catalog", "custom"],
      invoice_payment_method: [
        "stripe",
        "paypal",
        "cash",
        "check",
        "ach",
        "other",
      ],
      invoice_payment_status: ["pending", "succeeded", "failed", "refunded"],
      invoice_status: ["draft", "sent", "partial", "paid", "void", "overdue"],
      invoice_template_kind: ["preset", "ai"],
      job_status: [
        "lead",
        "inspected",
        "estimated",
        "proposed",
        "signed",
        "in_progress",
        "complete",
      ],
      join_request_status: ["pending", "approved", "rejected"],
      lead_activity_type: [
        "call",
        "email",
        "text",
        "note",
        "status",
        "ai_analysis",
        "report_generated",
        "report_sent",
        "document_uploaded",
        "document_deleted",
        "lead_created",
        "lead_deleted",
        "geocoded",
      ],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "quoted",
        "won",
        "lost",
        "dnc",
        "report_sent",
      ],
      order_snapshot_status: [
        "draft",
        "pending_approval",
        "approved",
        "superseded",
        "rejected",
      ],
      price_book_pricing_type: ["default", "insurance", "retail"],
      price_book_status: ["active", "archived"],
      property_status: [
        "not_contacted",
        "contacted",
        "interested",
        "not_interested",
        "appointment",
        "customer",
        "do_not_knock",
      ],
      property_type: ["residential", "commercial"],
      roof_edge_type: [
        "eave",
        "rake",
        "hip",
        "ridge",
        "valley",
        "gutter",
        "wall_flashing",
        "step_flashing",
        "transition",
        "unlabeled",
        "parapet_wall",
        "drip_edge",
      ],
      roof_measurement_source: [
        "manual",
        "mapbox_draw",
        "google_solar",
        "third_party_report",
        "photo_ai",
      ],
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
