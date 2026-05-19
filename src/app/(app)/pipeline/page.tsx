'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PipelineBoard } from '@/components/crm/pipeline-board'
import { NewDealModal } from '@/components/crm/new-deal-modal'
import { ChevronDown, Plus, RefreshCw } from 'lucide-react'
import type { Deal, Stage, Contact, User } from '@/types/crm'
import type { Database } from '@/lib/supabase/types'

type DbPipeline = Database['public']['Tables']['crm_pipelines']['Row']
type DbStage = Database['public']['Tables']['crm_stages']['Row']

function dbDealToDeal(row: Record<string, unknown>): Deal {
  const contact = row.crm_contacts as Record<string, string>
  const user = row.assigned_user as Record<string, string> | null
  const svc = row.crm_services as Record<string, unknown> | null
  const plan = row.crm_service_plans as Record<string, unknown> | null
  return {
    id: row.id as string,
    contactId: row.contact_id as string,
    contact: {
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      email: contact.email ?? undefined,
      origin: contact.origin as Contact['origin'],
      createdAt: contact.created_at,
    },
    pipelineId: row.pipeline_id as string,
    stageId: row.stage_id as string,
    assignedTo: user
      ? { id: user.id, name: user.name, email: '', role: user.role as User['role'] }
      : { id: '', name: 'Sem responsável', email: '', role: 'seller' },
    serviceId: row.service_id as string | null,
    service: svc ? { id: svc.id as string, name: svc.name as string } : null,
    chatwootConversationId: row.chatwoot_conversation_id as string | null,
    waConversationId: row.wa_conversation_id as string | null,
    planId: row.plan_id as string | null,
    plan: plan ? {
      id: plan.id as string,
      name: plan.name as string,
      tablePrice: plan.table_price as number | null,
      maxDiscountPct: plan.max_discount_pct as number,
    } : null,
    urgency: row.urgency as Deal['urgency'],
    temperature: row.temperature as Deal['temperature'],
    interestPoint: row.interest_point as string | undefined,
    objection: row.objection as string | undefined,
    previousExperience: row.previous_experience as string | undefined,
    paymentMethod: row.payment_method as Deal['paymentMethod'] | undefined,
    negotiatedValue: row.negotiated_value as number | undefined,
    status: row.status as Deal['status'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function dbStageToStage(s: DbStage): Stage {
  return { id: s.id, pipelineId: s.pipeline_id, name: s.name, color: s.color, order: s.order, type: (s.type ?? 'normal') as Stage['type'] }
}

export default function PipelinePage() {
  const [pipelines, setPipelines] = useState<DbPipeline[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [stages, setStages] = useState<DbStage[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [newDealModal, setNewDealModal] = useState(false)
  const [newDealStageId, setNewDealStageId] = useState('')

  const supabase = createClient()

  const loadPipelines = useCallback(async () => {
    const { data } = await supabase.from('crm_pipelines').select('*').order('created_at')
    if (data && data.length > 0) {
      setPipelines(data)
      if (!selectedId) setSelectedId(data[0].id)
    }
  }, [selectedId])

  const loadDeals = useCallback(async (pipelineId: string) => {
    setLoading(true)
    const [stagesRes, dealsRes] = await Promise.all([
      supabase.from('crm_stages').select('*').eq('pipeline_id', pipelineId).order('order'),
      supabase.from('crm_deals').select(`
        *, crm_contacts(*),
        crm_services(id, name),
        crm_service_plans(id, name, table_price, max_discount_pct),
        assigned_user:crm_users!crm_deals_assigned_to_fkey(id, name, role)
      `).eq('pipeline_id', pipelineId).eq('status', 'open').order('created_at', { ascending: false }),
    ])
    setStages(stagesRes.data ?? [])
    setDeals((dealsRes.data ?? []).map(d => dbDealToDeal(d as Record<string, unknown>)))
    setLoading(false)
  }, [])

  useEffect(() => { loadPipelines() }, [loadPipelines])
  useEffect(() => { if (selectedId) loadDeals(selectedId) }, [selectedId, loadDeals])

  const columns = stages
    .sort((a, b) => a.order - b.order)
    .map(stage => ({
      stage: dbStageToStage(stage),
      deals: deals.filter(d => d.stageId === stage.id),
    }))

  const handleNewDeal = (stageId: string) => {
    setNewDealStageId(stageId)
    setNewDealModal(true)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 xl:px-8 xl:py-5 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
            <p className="text-sm text-gray-500 mt-0.5">Acompanhe a evolução dos seus negócios</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                className="appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <button
              onClick={() => loadDeals(selectedId)}
              className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
              title="Atualizar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const initialStage = stages.find(s => s.type === 'initial') ?? stages[0]
                setNewDealStageId(initialStage?.id ?? '')
                setNewDealModal(true)
              }}
              className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Deal
            </button>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400 text-sm">Carregando...</div>
          </div>
        ) : (
          <PipelineBoard columns={columns} onNewDeal={handleNewDeal} />
        )}
      </div>

      <NewDealModal
        open={newDealModal}
        onClose={() => setNewDealModal(false)}
        pipelineId={selectedId}
        initialStageId={newDealStageId}
        stages={stages}
        onCreated={() => loadDeals(selectedId)}
      />
    </div>
  )
}
