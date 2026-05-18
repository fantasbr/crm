export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      crm_users: {
        Row: { id: string; name: string; role: 'admin' | 'manager' | 'seller'; created_at: string; updated_at: string }
        Insert: { id: string; name: string; role?: 'admin' | 'manager' | 'seller'; created_at?: string; updated_at?: string }
        Update: { id?: string; name?: string; role?: 'admin' | 'manager' | 'seller'; updated_at?: string }
        Relationships: []
      }
      crm_teams: {
        Row: { id: string; name: string; created_at: string; updated_at: string }
        Insert: { id?: string; name: string; created_at?: string; updated_at?: string }
        Update: { id?: string; name?: string; updated_at?: string }
        Relationships: []
      }
      crm_team_members: {
        Row: { team_id: string; user_id: string }
        Insert: { team_id: string; user_id: string }
        Update: { team_id?: string; user_id?: string }
        Relationships: []
      }
      crm_pipelines: {
        Row: { id: string; name: string; created_at: string; updated_at: string }
        Insert: { id?: string; name: string; created_at?: string; updated_at?: string }
        Update: { id?: string; name?: string; updated_at?: string }
        Relationships: []
      }
      crm_team_pipelines: {
        Row: { team_id: string; pipeline_id: string }
        Insert: { team_id: string; pipeline_id: string }
        Update: { team_id?: string; pipeline_id?: string }
        Relationships: []
      }
      crm_stages: {
        Row: { id: string; pipeline_id: string; name: string; color: string; order: number; type: 'initial' | 'won' | 'lost' | 'normal'; created_at: string }
        Insert: { id?: string; pipeline_id: string; name: string; color?: string; order?: number; type?: 'initial' | 'won' | 'lost' | 'normal'; created_at?: string }
        Update: { id?: string; pipeline_id?: string; name?: string; color?: string; order?: number; type?: 'initial' | 'won' | 'lost' | 'normal' }
        Relationships: []
      }
      crm_services: {
        Row: { id: string; name: string; active: boolean; order: number; created_at: string; updated_at: string }
        Insert: { id?: string; name: string; active?: boolean; order?: number; created_at?: string; updated_at?: string }
        Update: { id?: string; name?: string; active?: boolean; order?: number; updated_at?: string }
        Relationships: []
      }
      crm_service_plans: {
        Row: { id: string; service_id: string; name: string; description: string | null; table_price: number | null; max_discount_pct: number; active: boolean; order: number; created_at: string; updated_at: string }
        Insert: { id?: string; service_id: string; name: string; description?: string | null; table_price?: number | null; max_discount_pct?: number; active?: boolean; order?: number; created_at?: string; updated_at?: string }
        Update: { id?: string; service_id?: string; name?: string; description?: string | null; table_price?: number | null; max_discount_pct?: number; active?: boolean; order?: number; updated_at?: string }
        Relationships: [
          { foreignKeyName: "crm_service_plans_service_id_fkey"; columns: ["service_id"]; isOneToOne: false; referencedRelation: "crm_services"; referencedColumns: ["id"] }
        ]
      }
      crm_contacts: {
        Row: { id: string; name: string; phone: string; email: string | null; origin: 'whatsapp' | 'presencial' | 'indicacao' | 'site'; chatwoot_id: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; name: string; phone: string; email?: string | null; origin?: 'whatsapp' | 'presencial' | 'indicacao' | 'site'; chatwoot_id?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; name?: string; phone?: string; email?: string | null; origin?: 'whatsapp' | 'presencial' | 'indicacao' | 'site'; chatwoot_id?: string | null; updated_at?: string }
        Relationships: []
      }
      crm_deals: {
        Row: {
          id: string; contact_id: string; pipeline_id: string; stage_id: string; assigned_to: string | null
          service_id: string; plan_id: string | null
          urgency: number; temperature: 'frio' | 'morno' | 'quente' | 'fechando'
          interest_point: string | null; objection: string | null; previous_experience: string | null
          payment_method: 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'dinheiro' | null
          negotiated_value: number | null; status: 'open' | 'won' | 'lost'; created_at: string; updated_at: string
        }
        Insert: {
          id?: string; contact_id: string; pipeline_id: string; stage_id: string; assigned_to?: string | null
          service_id: string; plan_id?: string | null
          urgency?: number; temperature?: 'frio' | 'morno' | 'quente' | 'fechando'
          interest_point?: string | null; objection?: string | null; previous_experience?: string | null
          payment_method?: 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'dinheiro' | null
          negotiated_value?: number | null; status?: 'open' | 'won' | 'lost'; created_at?: string; updated_at?: string
        }
        Update: {
          id?: string; contact_id?: string; pipeline_id?: string; stage_id?: string; assigned_to?: string | null
          service_id?: string; plan_id?: string | null
          urgency?: number; temperature?: 'frio' | 'morno' | 'quente' | 'fechando'
          interest_point?: string | null; objection?: string | null; previous_experience?: string | null
          payment_method?: 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'dinheiro' | null
          negotiated_value?: number | null; status?: 'open' | 'won' | 'lost'; updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "crm_deals_service_id_fkey"; columns: ["service_id"]; isOneToOne: false; referencedRelation: "crm_services"; referencedColumns: ["id"] },
          { foreignKeyName: "crm_deals_plan_id_fkey"; columns: ["plan_id"]; isOneToOne: false; referencedRelation: "crm_service_plans"; referencedColumns: ["id"] }
        ]
      }
      crm_deal_activities: {
        Row: { id: string; deal_id: string; user_id: string | null; type: string; content: string | null; metadata: Json | null; created_at: string }
        Insert: { id?: string; deal_id: string; user_id?: string | null; type: string; content?: string | null; metadata?: Json | null; created_at?: string }
        Update: { id?: string; content?: string | null; metadata?: Json | null }
        Relationships: []
      }
      crm_budgets: {
        Row: { id: string; deal_id: string; valid_days: number; notes: string | null; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; deal_id: string; valid_days?: number; notes?: string | null; created_by?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; valid_days?: number; notes?: string | null; updated_at?: string }
        Relationships: [
          { foreignKeyName: "crm_budgets_deal_id_fkey"; columns: ["deal_id"]; isOneToOne: false; referencedRelation: "crm_deals"; referencedColumns: ["id"] }
        ]
      }
      crm_budget_plans: {
        Row: { budget_id: string; plan_id: string; custom_price: number | null }
        Insert: { budget_id: string; plan_id: string; custom_price?: number | null }
        Update: { budget_id?: string; plan_id?: string; custom_price?: number | null }
        Relationships: [
          { foreignKeyName: "crm_budget_plans_budget_id_fkey"; columns: ["budget_id"]; isOneToOne: false; referencedRelation: "crm_budgets"; referencedColumns: ["id"] },
          { foreignKeyName: "crm_budget_plans_plan_id_fkey"; columns: ["plan_id"]; isOneToOne: false; referencedRelation: "crm_service_plans"; referencedColumns: ["id"] }
        ]
      }
      crm_tags: {
        Row: { id: string; name: string; color: string }
        Insert: { id?: string; name: string; color?: string }
        Update: { id?: string; name?: string; color?: string }
        Relationships: []
      }
      crm_contact_tags: {
        Row: { contact_id: string; tag_id: string }
        Insert: { contact_id: string; tag_id: string }
        Update: { contact_id?: string; tag_id?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      crm_is_admin: { Args: Record<string, never>; Returns: boolean }
      crm_accessible_pipeline_ids: { Args: Record<string, never>; Returns: string[] }
    }
    Enums: {
      crm_contact_origin: 'whatsapp' | 'presencial' | 'indicacao' | 'site'
      crm_deal_temperature: 'frio' | 'morno' | 'quente' | 'fechando'
      crm_deal_status: 'open' | 'won' | 'lost'
      crm_payment_method: 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'dinheiro'
      crm_user_role: 'admin' | 'manager' | 'seller'
      crm_activity_type: 'note' | 'stage_change' | 'status_change' | 'call' | 'whatsapp' | 'email'
    }
    CompositeTypes: Record<string, never>
  }
}
