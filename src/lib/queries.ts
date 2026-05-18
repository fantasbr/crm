import { createClient } from './supabase/client'
import type { Json } from './supabase/types'

// ─── Pipelines ────────────────────────────────────────────────────────────────

export async function getPipelines() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('crm_pipelines')
    .select('*, crm_stages(*)')
    .order('created_at')
  if (error) throw error
  return data
}

export async function createPipeline(name: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('crm_pipelines')
    .insert({ name })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Stages ───────────────────────────────────────────────────────────────────

export async function createStage(pipelineId: string, name: string, color: string, order: number) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('crm_stages')
    .insert({ pipeline_id: pipelineId, name, color, order })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Services & Plans ─────────────────────────────────────────────────────────

export async function getServicesWithPlans() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('crm_services')
    .select('*, crm_service_plans(*)')
    .order('order')
  if (error) throw error
  return data
}

export async function getActiveServicesWithPlans() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('crm_services')
    .select('*, crm_service_plans(*)')
    .eq('active', true)
    .order('order')
  if (error) throw error
  return (data ?? []).map(svc => ({
    ...svc,
    crm_service_plans: (svc.crm_service_plans ?? [])
      .filter((p: { active: boolean }) => p.active)
      .sort((a: { order: number }, b: { order: number }) => a.order - b.order),
  }))
}

export async function createService(name: string, order: number) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('crm_services')
    .insert({ name, order })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateService(id: string, updates: { name?: string; active?: boolean; order?: number }) {
  const supabase = createClient()
  const { error } = await supabase.from('crm_services').update(updates).eq('id', id)
  if (error) throw error
}

export async function createPlan(plan: {
  service_id: string
  name: string
  description?: string
  table_price?: number | null
  max_discount_pct?: number
  order: number
}) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('crm_service_plans')
    .insert(plan)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePlan(id: string, updates: {
  name?: string
  description?: string | null
  table_price?: number | null
  max_discount_pct?: number
  active?: boolean
}) {
  const supabase = createClient()
  const { error } = await supabase.from('crm_service_plans').update(updates).eq('id', id)
  if (error) throw error
}

export async function deletePlan(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('crm_service_plans').delete().eq('id', id)
  if (error) throw error
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function getContacts() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('crm_contacts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createContact(contact: {
  name: string
  phone: string
  email?: string
  origin: 'whatsapp' | 'presencial' | 'indicacao' | 'site'
  chatwoot_id?: string
}) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('crm_contacts')
    .insert(contact)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function upsertContactByChatwootId(contact: {
  chatwoot_id: string
  name: string
  phone: string
  email?: string
}) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('crm_contacts')
    .upsert({ ...contact, origin: 'whatsapp' }, { onConflict: 'chatwoot_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Deals ────────────────────────────────────────────────────────────────────

export async function getDealsByPipeline(pipelineId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('crm_deals')
    .select(`
      *,
      crm_contacts(*),
      crm_services(id, name),
      crm_service_plans(id, name, table_price, max_discount_pct),
      assigned_user:crm_users!crm_deals_assigned_to_fkey(id, name, role)
    `)
    .eq('pipeline_id', pipelineId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createDeal(deal: {
  contact_id: string
  pipeline_id: string
  stage_id: string
  assigned_to?: string
  service_id?: string | null
  plan_id?: string
  chatwoot_conversation_id?: string | null
  urgency: number
  temperature: 'frio' | 'morno' | 'quente' | 'fechando'
  interest_point?: string
  objection?: string
  previous_experience?: string
  payment_method?: 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'dinheiro'
  negotiated_value?: number
}) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('crm_deals')
    .insert(deal)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function moveDealToStage(dealId: string, stageId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('crm_deals')
    .update({ stage_id: stageId })
    .eq('id', dealId)
  if (error) throw error
}

export async function updateDeal(dealId: string, updates: {
  stage_id?: string
  assigned_to?: string
  service_id?: string
  plan_id?: string | null
  chatwoot_conversation_id?: string | null
  urgency?: number
  temperature?: 'frio' | 'morno' | 'quente' | 'fechando'
  interest_point?: string
  objection?: string
  previous_experience?: string
  payment_method?: 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'dinheiro'
  negotiated_value?: number
  status?: 'open' | 'won' | 'lost'
}) {
  const supabase = createClient()
  const { error } = await supabase
    .from('crm_deals')
    .update(updates)
    .eq('id', dealId)
  if (error) throw error
}

export async function closeDeal(dealId: string, status: 'won' | 'lost') {
  return updateDeal(dealId, { status })
}

// ─── Activities ───────────────────────────────────────────────────────────────

export async function getDealActivities(dealId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('crm_deal_activities')
    .select('*, crm_users(id, name)')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addDealActivity(activity: {
  deal_id: string
  type: 'note' | 'stage_change' | 'status_change' | 'call' | 'whatsapp' | 'email'
  content?: string
  metadata?: Json
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('crm_deal_activities')
    .insert({ ...activity, user_id: user?.id ?? null })
  if (error) throw error
}

// ─── Budgets ──────────────────────────────────────────────────────────────────

export async function createBudget(dealId: string, plans: Array<{ plan_id: string; custom_price?: number | null }>, validDays: number, notes?: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: budget, error } = await supabase
    .from('crm_budgets')
    .insert({ deal_id: dealId, valid_days: validDays, notes: notes || null, created_by: user?.id ?? null })
    .select()
    .single()
  if (error) throw error

  const planRows = plans.map(p => ({
    budget_id: budget.id,
    plan_id: p.plan_id,
    custom_price: p.custom_price ?? null,
  }))
  const { error: plansError } = await supabase.from('crm_budget_plans').insert(planRows)
  if (plansError) throw plansError

  return budget
}

export async function getBudgetsByDeal(dealId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('crm_budgets')
    .select(`
      *,
      crm_budget_plans(plan_id, custom_price, crm_service_plans(id, name, table_price, service_id))
    `)
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getBudgetById(id: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('crm_budgets')
    .select(`
      *,
      crm_deals(
        id, negotiated_value,
        crm_contacts(id, name, phone),
        crm_services(name),
        assigned_user:crm_users!crm_deals_assigned_to_fkey(id, name)
      ),
      crm_budget_plans(
        plan_id, custom_price,
        crm_service_plans(id, name, table_price, description)
      )
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUsers() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('crm_users')
    .select('*')
    .order('name')
  if (error) throw error
  return data
}

export async function getCurrentUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('crm_users')
    .select('*')
    .eq('id', user.id)
    .single()
  return data
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export async function getTeams() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('crm_teams')
    .select(`
      *,
      crm_team_members(user_id, crm_users(id, name, role)),
      crm_team_pipelines(pipeline_id, crm_pipelines(id, name))
    `)
    .order('name')
  if (error) throw error
  return data
}
