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
      crm_inboxes: {
        Row: { id: string; name: string; wa_instance: string; phone: string | null; color: string; active: boolean; created_at: string }
        Insert: { id?: string; name: string; wa_instance: string; phone?: string | null; color?: string; active?: boolean; created_at?: string }
        Update: { id?: string; name?: string; wa_instance?: string; phone?: string | null; color?: string; active?: boolean }
        Relationships: []
      }
      crm_conversations: {
        Row: { id: string; inbox_id: string; contact_id: string | null; wa_jid: string; status: 'open' | 'resolved' | 'archived'; unread_count: number; last_message: string | null; last_message_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; inbox_id: string; contact_id?: string | null; wa_jid: string; status?: 'open' | 'resolved' | 'archived'; unread_count?: number; last_message?: string | null; last_message_at?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; inbox_id?: string; contact_id?: string | null; wa_jid?: string; status?: 'open' | 'resolved' | 'archived'; unread_count?: number; last_message?: string | null; last_message_at?: string | null; updated_at?: string }
        Relationships: [
          { foreignKeyName: "crm_conversations_inbox_id_fkey"; columns: ["inbox_id"]; isOneToOne: false; referencedRelation: "crm_inboxes"; referencedColumns: ["id"] },
          { foreignKeyName: "crm_conversations_contact_id_fkey"; columns: ["contact_id"]; isOneToOne: false; referencedRelation: "crm_contacts"; referencedColumns: ["id"] }
        ]
      }
      crm_messages: {
        Row: { id: string; conversation_id: string; inbox_id: string | null; wa_message_id: string | null; direction: 'inbound' | 'outbound'; body: string; media_url: string | null; media_type: string | null; status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'; sender_name: string | null; sent_by: string | null; metadata: Json | null; deleted_at: string | null; edited_at: string | null; original_body: string | null; read_at: string | null; client_ref: string | null; created_at: string }
        Insert: { id?: string; conversation_id: string; inbox_id?: string | null; wa_message_id?: string | null; direction: 'inbound' | 'outbound'; body: string; media_url?: string | null; media_type?: string | null; status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'; sender_name?: string | null; sent_by?: string | null; metadata?: Json | null; deleted_at?: string | null; edited_at?: string | null; original_body?: string | null; read_at?: string | null; client_ref?: string | null; created_at?: string }
        Update: { id?: string; conversation_id?: string; inbox_id?: string | null; wa_message_id?: string | null; direction?: 'inbound' | 'outbound'; body?: string; media_url?: string | null; media_type?: string | null; status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'; sender_name?: string | null; sent_by?: string | null; metadata?: Json | null; deleted_at?: string | null; edited_at?: string | null; original_body?: string | null; read_at?: string | null; client_ref?: string | null }
        Relationships: [
          { foreignKeyName: "crm_messages_conversation_id_fkey"; columns: ["conversation_id"]; isOneToOne: false; referencedRelation: "crm_conversations"; referencedColumns: ["id"] },
          { foreignKeyName: "crm_messages_inbox_id_fkey"; columns: ["inbox_id"]; isOneToOne: false; referencedRelation: "crm_inboxes"; referencedColumns: ["id"] }
        ]
      }
      crm_contacts: {
        Row: { id: string; name: string; phone: string; email: string | null; origin: 'whatsapp' | 'presencial' | 'indicacao' | 'site'; chatwoot_id: string | null; wa_phone: string | null; wa_push_name: string | null; avatar_url: string | null; avatar_synced_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; name: string; phone: string; email?: string | null; origin?: 'whatsapp' | 'presencial' | 'indicacao' | 'site'; chatwoot_id?: string | null; wa_phone?: string | null; wa_push_name?: string | null; avatar_url?: string | null; avatar_synced_at?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; name?: string; phone?: string; email?: string | null; origin?: 'whatsapp' | 'presencial' | 'indicacao' | 'site'; chatwoot_id?: string | null; wa_phone?: string | null; wa_push_name?: string | null; avatar_url?: string | null; avatar_synced_at?: string | null; updated_at?: string }
        Relationships: []
      }
      crm_deals: {
        Row: {
          id: string; contact_id: string; pipeline_id: string; stage_id: string; assigned_to: string | null
          service_id: string | null; plan_id: string | null; chatwoot_conversation_id: string | null; wa_conversation_id: string | null
          urgency: number; temperature: 'frio' | 'morno' | 'quente' | 'fechando'
          interest_point: string | null; objection: string | null; previous_experience: string | null
          payment_method: 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'dinheiro' | null
          negotiated_value: number | null; status: 'open' | 'won' | 'lost'; created_at: string; updated_at: string
        }
        Insert: {
          id?: string; contact_id: string; pipeline_id: string; stage_id: string; assigned_to?: string | null
          service_id?: string | null; plan_id?: string | null; chatwoot_conversation_id?: string | null; wa_conversation_id?: string | null
          urgency?: number; temperature?: 'frio' | 'morno' | 'quente' | 'fechando'
          interest_point?: string | null; objection?: string | null; previous_experience?: string | null
          payment_method?: 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'dinheiro' | null
          negotiated_value?: number | null; status?: 'open' | 'won' | 'lost'; created_at?: string; updated_at?: string
        }
        Update: {
          id?: string; contact_id?: string; pipeline_id?: string; stage_id?: string; assigned_to?: string | null
          service_id?: string | null; plan_id?: string | null; chatwoot_conversation_id?: string | null; wa_conversation_id?: string | null
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
      crm_message_direction: 'inbound' | 'outbound'
      crm_message_status: 'sent' | 'delivered' | 'read' | 'failed'
      crm_conv_status: 'open' | 'resolved' | 'archived'
    }
    CompositeTypes: Record<string, never>
  }
}
