'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, GripVertical, Pencil, Trash2, Check, X, DollarSign, Tag, ChevronDown, ChevronRight } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type StageType = 'initial' | 'won' | 'lost' | 'normal'
type Stage = { id: string; name: string; color: string; order: number; pipeline_id: string; type: StageType }
type Pipeline = { id: string; name: string; crm_stages: Stage[] }

type ServicePlan = {
  id: string
  service_id: string
  name: string
  description: string | null
  table_price: number | null
  max_discount_pct: number
  active: boolean
  order: number
}

type Service = { id: string; name: string; active: boolean; order: number }
type ServiceWithPlans = Service & { crm_service_plans: ServicePlan[] }

// ── Constants ──────────────────────────────────────────────────────────────────

const COLORS = ['#6366f1', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444', '#06b6d4', '#ec4899']

const stageTypeConfig: Record<StageType, { label: string; icon: string; bg: string; text: string; border: string }> = {
  initial: { label: 'Entrada',  icon: '🚀', bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  won:     { label: 'Ganho',    icon: '✅', bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
  lost:    { label: 'Perdido',  icon: '❌', bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
  normal:  { label: 'Normal',   icon: '•',  bg: 'bg-gray-50',   text: 'text-gray-500',   border: 'border-gray-200' },
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  pipelines: Pipeline[]
  services: ServiceWithPlans[]
}

export function SettingsClient({ pipelines: initialPipelines, services: initialServices }: Props) {
  const [tab, setTab] = useState<'pipelines' | 'servicos'>('pipelines')

  return (
    <div className="p-5 xl:p-8 max-w-3xl">
      <div className="mb-6 xl:mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gerencie pipelines, etapas e serviços</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setTab('pipelines')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'pipelines' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Tag className="w-4 h-4" />
          Pipelines
        </button>
        <button
          onClick={() => setTab('servicos')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'servicos' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <DollarSign className="w-4 h-4" />
          Serviços
        </button>
      </div>

      {tab === 'pipelines' && <PipelinesSection initialPipelines={initialPipelines} />}
      {tab === 'servicos' && <ServicesSection initialServices={initialServices} />}
    </div>
  )
}

// ── Pipelines Section ─────────────────────────────────────────────────────────

function PipelinesSection({ initialPipelines }: { initialPipelines: Pipeline[] }) {
  const [pipelines, setPipelines] = useState(initialPipelines)
  const [newPipelineName, setNewPipelineName] = useState('')
  const [addingPipeline, setAddingPipeline] = useState(false)
  const [editingPipeline, setEditingPipeline] = useState<string | null>(null)
  const [editPipelineName, setEditPipelineName] = useState('')
  const [newStageName, setNewStageName] = useState<Record<string, string>>({})
  const [newStageColor, setNewStageColor] = useState<Record<string, string>>({})
  const [editingStage, setEditingStage] = useState<string | null>(null)
  const [editStageName, setEditStageName] = useState('')
  const [typeMenuOpen, setTypeMenuOpen] = useState<string | null>(null)

  const supabase = createClient()

  const createPipeline = async () => {
    if (!newPipelineName.trim()) return
    const { data } = await supabase.from('crm_pipelines').insert({ name: newPipelineName.trim() }).select().single()
    if (data) {
      setPipelines(prev => [...prev, { ...data, crm_stages: [] }])
      setNewPipelineName('')
      setAddingPipeline(false)
    }
  }

  const savePipelineName = async (id: string) => {
    if (!editPipelineName.trim()) return
    await supabase.from('crm_pipelines').update({ name: editPipelineName.trim() }).eq('id', id)
    setPipelines(prev => prev.map(p => p.id === id ? { ...p, name: editPipelineName.trim() } : p))
    setEditingPipeline(null)
  }

  const deletePipeline = async (id: string) => {
    if (!confirm('Excluir este pipeline e todas as suas etapas?')) return
    await supabase.from('crm_pipelines').delete().eq('id', id)
    setPipelines(prev => prev.filter(p => p.id !== id))
  }

  const createStage = async (pipelineId: string) => {
    const name = newStageName[pipelineId]?.trim()
    if (!name) return
    const color = newStageColor[pipelineId] ?? COLORS[0]
    const pipeline = pipelines.find(p => p.id === pipelineId)
    const nextOrder = (pipeline?.crm_stages.length ?? 0) + 1
    const { data } = await supabase.from('crm_stages')
      .insert({ pipeline_id: pipelineId, name, color, order: nextOrder, type: 'normal' })
      .select().single()
    if (data) {
      setPipelines(prev => prev.map(p => p.id === pipelineId
        ? { ...p, crm_stages: [...p.crm_stages, data as Stage] }
        : p))
      setNewStageName(prev => ({ ...prev, [pipelineId]: '' }))
    }
  }

  const saveStage = async (stageId: string, pipelineId: string) => {
    if (!editStageName.trim()) return
    await supabase.from('crm_stages').update({ name: editStageName.trim() }).eq('id', stageId)
    setPipelines(prev => prev.map(p => p.id === pipelineId
      ? { ...p, crm_stages: p.crm_stages.map(s => s.id === stageId ? { ...s, name: editStageName.trim() } : s) }
      : p))
    setEditingStage(null)
  }

  const deleteStage = async (stageId: string, pipelineId: string) => {
    await supabase.from('crm_stages').delete().eq('id', stageId)
    setPipelines(prev => prev.map(p => p.id === pipelineId
      ? { ...p, crm_stages: p.crm_stages.filter(s => s.id !== stageId) }
      : p))
  }

  const setStageType = async (stageId: string, pipelineId: string, type: StageType) => {
    if (type !== 'normal') {
      const pipeline = pipelines.find(p => p.id === pipelineId)
      const conflicting = pipeline?.crm_stages.filter(s => s.type === type && s.id !== stageId) ?? []
      for (const s of conflicting) {
        await supabase.from('crm_stages').update({ type: 'normal' }).eq('id', s.id)
      }
    }
    await supabase.from('crm_stages').update({ type }).eq('id', stageId)
    setPipelines(prev => prev.map(p => {
      if (p.id !== pipelineId) return p
      return {
        ...p,
        crm_stages: p.crm_stages.map(s => {
          if (s.id === stageId) return { ...s, type }
          if (type !== 'normal' && s.type === type) return { ...s, type: 'normal' as StageType }
          return s
        })
      }
    }))
    setTypeMenuOpen(null)
  }

  return (
    <div className="space-y-6">
      {/* Legenda */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Tipos de etapa</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.entries(stageTypeConfig) as [StageType, typeof stageTypeConfig[StageType]][]).map(([type, cfg]) => (
            <div key={type} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${cfg.bg} ${cfg.border}`}>
              <span className="text-base">{cfg.icon}</span>
              <div>
                <p className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</p>
                <p className="text-[10px] text-gray-400">
                  {type === 'initial' ? 'Entrada de novos deals' :
                   type === 'won'     ? 'Fecha como ganho' :
                   type === 'lost'    ? 'Fecha como perdido' :
                                        'Etapa intermediária'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Pipelines</h2>
        {!addingPipeline && (
          <button onClick={() => setAddingPipeline(true)}
            className="flex items-center gap-2 bg-brand-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
            <Plus className="w-4 h-4" /> Novo Pipeline
          </button>
        )}
      </div>

      {addingPipeline && (
        <div className="bg-white rounded-xl border border-brand-200 p-4 flex gap-2">
          <input autoFocus value={newPipelineName} onChange={e => setNewPipelineName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createPipeline(); if (e.key === 'Escape') setAddingPipeline(false) }}
            placeholder="Nome do pipeline..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <button onClick={createPipeline} className="px-3 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600">Criar</button>
          <button onClick={() => { setAddingPipeline(false); setNewPipelineName('') }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
        </div>
      )}

      {pipelines.map(pipeline => (
        <div key={pipeline.id} className="relative bg-white rounded-xl border border-gray-200 overflow-visible">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            {editingPipeline === pipeline.id ? (
              <div className="flex items-center gap-2 flex-1">
                <input autoFocus value={editPipelineName} onChange={e => setEditPipelineName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') savePipelineName(pipeline.id); if (e.key === 'Escape') setEditingPipeline(null) }}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <button onClick={() => savePipelineName(pipeline.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setEditingPipeline(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-gray-900">{pipeline.name}</h3>
                <div className="flex items-center gap-1">
                  {pipeline.crm_stages.some(s => s.type === 'initial') &&
                    <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">🚀 Entrada</span>}
                  {pipeline.crm_stages.some(s => s.type === 'won') &&
                    <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">✅ Ganho</span>}
                  {pipeline.crm_stages.some(s => s.type === 'lost') &&
                    <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">❌ Perdido</span>}
                </div>
              </div>
            )}
            {editingPipeline !== pipeline.id && (
              <div className="flex items-center gap-1">
                <button onClick={() => { setEditingPipeline(pipeline.id); setEditPipelineName(pipeline.name) }}
                  className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => deletePipeline(pipeline.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="p-4 space-y-2">
            {[...pipeline.crm_stages].sort((a, b) => a.order - b.order).map(stage => {
              const typeCfg = stageTypeConfig[stage.type]
              return (
                <div key={stage.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group">
                  <GripVertical className="w-4 h-4 text-gray-300 cursor-grab flex-shrink-0" />
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />

                  {editingStage === stage.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input autoFocus value={editStageName} onChange={e => setEditStageName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveStage(stage.id, pipeline.id); if (e.key === 'Escape') setEditingStage(null) }}
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      <button onClick={() => saveStage(stage.id, pipeline.id)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEditingStage(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm text-gray-700 flex-1">{stage.name}</span>

                      <div className="relative z-20">
                        <button
                          onClick={() => setTypeMenuOpen(typeMenuOpen === stage.id ? null : stage.id)}
                          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${typeCfg.bg} ${typeCfg.text} ${typeCfg.border} hover:opacity-80`}
                        >
                          <span>{typeCfg.icon}</span>
                          <span>{typeCfg.label}</span>
                        </button>

                        {typeMenuOpen === stage.id && (
                          <div className="absolute right-0 top-8 z-30 bg-white rounded-xl border border-gray-200 shadow-lg p-1.5 min-w-[160px]">
                            {(Object.entries(stageTypeConfig) as [StageType, typeof stageTypeConfig[StageType]][]).map(([type, cfg]) => (
                              <button
                                key={type}
                                onClick={() => setStageType(stage.id, pipeline.id, type)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                                  stage.type === type ? `${cfg.bg} ${cfg.text} font-medium` : 'text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                <span>{cfg.icon}</span>
                                <span>{cfg.label}</span>
                                {stage.type === type && <Check className="w-3 h-3 ml-auto" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingStage(stage.id); setEditStageName(stage.name) }}
                          className="p-1 text-gray-400 hover:text-brand-500 rounded transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteStage(stage.id, pipeline.id)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}

            <div className="flex items-center gap-2 p-2 border-t border-gray-100 mt-2">
              <div className="flex items-center gap-1 flex-shrink-0">
                {COLORS.map(c => (
                  <button key={c} type="button"
                    onClick={() => setNewStageColor(prev => ({ ...prev, [pipeline.id]: c }))}
                    className="w-5 h-5 rounded-full border-2 transition-all flex-shrink-0"
                    style={{
                      backgroundColor: c,
                      borderColor: 'transparent',
                      boxShadow: (newStageColor[pipeline.id] ?? COLORS[0]) === c ? `0 0 0 2px white, 0 0 0 3.5px ${c}` : 'none',
                    }} />
                ))}
              </div>
              <input
                value={newStageName[pipeline.id] ?? ''}
                onChange={e => setNewStageName(prev => ({ ...prev, [pipeline.id]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') createStage(pipeline.id) }}
                placeholder="Nova etapa..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <button onClick={() => createStage(pipeline.id)}
                className="p-1.5 text-brand-500 hover:bg-brand-50 rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {pipelines.length === 0 && !addingPipeline && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-400 text-sm">Nenhum pipeline criado</p>
          <button onClick={() => setAddingPipeline(true)}
            className="mt-3 text-sm text-brand-500 hover:text-brand-600 font-medium">
            Criar primeiro pipeline
          </button>
        </div>
      )}
    </div>
  )
}

// ── Services Section ──────────────────────────────────────────────────────────

const emptyPlanForm = { name: '', description: '', table_price: '', max_discount_pct: '' }

function ServicesSection({ initialServices }: { initialServices: ServiceWithPlans[] }) {
  const [services, setServices] = useState(
    initialServices.map(s => ({
      ...s,
      crm_service_plans: [...s.crm_service_plans].sort((a, b) => a.order - b.order),
    }))
  )
  const [addingSvc, setAddingSvc] = useState(false)
  const [newSvcName, setNewSvcName] = useState('')
  const [editingSvcId, setEditingSvcId] = useState<string | null>(null)
  const [editSvcName, setEditSvcName] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [addingPlanFor, setAddingPlanFor] = useState<string | null>(null)
  const [newPlanForm, setNewPlanForm] = useState(emptyPlanForm)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [editPlanForm, setEditPlanForm] = useState(emptyPlanForm)

  const supabase = createClient()

  const toggleExpand = (id: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  // ── Service CRUD ──────────────────────────────────────────────────────────

  const createService = async () => {
    if (!newSvcName.trim()) return
    const nextOrder = (services.at(-1)?.order ?? 0) + 1
    const { data } = await supabase
      .from('crm_services')
      .insert({ name: newSvcName.trim(), order: nextOrder })
      .select()
      .single()
    if (data) {
      setServices(prev => [...prev, { ...data, crm_service_plans: [] }])
      setNewSvcName('')
      setAddingSvc(false)
      setExpanded(prev => new Set([...prev, data.id]))
    }
  }

  const saveServiceName = async (id: string) => {
    if (!editSvcName.trim()) return
    await supabase.from('crm_services').update({ name: editSvcName.trim() }).eq('id', id)
    setServices(prev => prev.map(s => s.id === id ? { ...s, name: editSvcName.trim() } : s))
    setEditingSvcId(null)
  }

  const toggleServiceActive = async (svc: ServiceWithPlans) => {
    await supabase.from('crm_services').update({ active: !svc.active }).eq('id', svc.id)
    setServices(prev => prev.map(s => s.id === svc.id ? { ...s, active: !s.active } : s))
  }

  // ── Plan CRUD ─────────────────────────────────────────────────────────────

  const createPlan = async (serviceId: string) => {
    if (!newPlanForm.name.trim()) return
    const svc = services.find(s => s.id === serviceId)
    const nextOrder = (svc?.crm_service_plans.at(-1)?.order ?? 0) + 1
    const { data } = await supabase
      .from('crm_service_plans')
      .insert({
        service_id: serviceId,
        name: newPlanForm.name.trim(),
        description: newPlanForm.description.trim() || null,
        table_price: newPlanForm.table_price ? parseFloat(newPlanForm.table_price) : null,
        max_discount_pct: newPlanForm.max_discount_pct ? parseFloat(newPlanForm.max_discount_pct) : 0,
        order: nextOrder,
      })
      .select()
      .single()
    if (data) {
      setServices(prev => prev.map(s => s.id === serviceId
        ? { ...s, crm_service_plans: [...s.crm_service_plans, data as ServicePlan] }
        : s))
      setNewPlanForm(emptyPlanForm)
      setAddingPlanFor(null)
    }
  }

  const startEditPlan = (plan: ServicePlan) => {
    setEditingPlanId(plan.id)
    setEditPlanForm({
      name: plan.name,
      description: plan.description ?? '',
      table_price: plan.table_price != null ? String(plan.table_price) : '',
      max_discount_pct: plan.max_discount_pct > 0 ? String(plan.max_discount_pct) : '',
    })
  }

  const savePlan = async (planId: string, serviceId: string) => {
    if (!editPlanForm.name.trim()) return
    const updates = {
      name: editPlanForm.name.trim(),
      description: editPlanForm.description.trim() || null,
      table_price: editPlanForm.table_price ? parseFloat(editPlanForm.table_price) : null,
      max_discount_pct: editPlanForm.max_discount_pct ? parseFloat(editPlanForm.max_discount_pct) : 0,
    }
    await supabase.from('crm_service_plans').update(updates).eq('id', planId)
    setServices(prev => prev.map(s => s.id === serviceId
      ? { ...s, crm_service_plans: s.crm_service_plans.map(p => p.id === planId ? { ...p, ...updates } : p) }
      : s))
    setEditingPlanId(null)
  }

  const togglePlanActive = async (plan: ServicePlan, serviceId: string) => {
    await supabase.from('crm_service_plans').update({ active: !plan.active }).eq('id', plan.id)
    setServices(prev => prev.map(s => s.id === serviceId
      ? { ...s, crm_service_plans: s.crm_service_plans.map(p => p.id === plan.id ? { ...p, active: !p.active } : p) }
      : s))
  }

  const deletePlan = async (planId: string, serviceId: string) => {
    if (!confirm('Excluir este plano?')) return
    await supabase.from('crm_service_plans').delete().eq('id', planId)
    setServices(prev => prev.map(s => s.id === serviceId
      ? { ...s, crm_service_plans: s.crm_service_plans.filter(p => p.id !== planId) }
      : s))
  }

  const fmt = (v: number | null) =>
    v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Serviços e Planos</h2>
          <p className="text-xs text-gray-500 mt-0.5">Cada serviço pode ter múltiplos planos com preços e margens individuais</p>
        </div>
        {!addingSvc && (
          <button onClick={() => setAddingSvc(true)}
            className="flex items-center gap-2 bg-brand-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
            <Plus className="w-4 h-4" /> Novo Serviço
          </button>
        )}
      </div>

      {addingSvc && (
        <div className="bg-white rounded-xl border border-brand-200 p-4 flex gap-2">
          <input autoFocus value={newSvcName} onChange={e => setNewSvcName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createService(); if (e.key === 'Escape') setAddingSvc(false) }}
            placeholder="Nome do serviço (ex: CNH-B, CNH-A)..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <button onClick={createService} className="px-3 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600">Criar</button>
          <button onClick={() => { setAddingSvc(false); setNewSvcName('') }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
        </div>
      )}

      {services.map(svc => {
        const isExpanded = expanded.has(svc.id)
        const activePlans = svc.crm_service_plans.filter(p => p.active).length
        return (
          <div key={svc.id} className={`bg-white rounded-xl border overflow-hidden transition-colors ${!svc.active ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}>
            {/* Service header */}
            <div className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => toggleExpand(svc.id)}
                className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {editingSvcId === svc.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input autoFocus value={editSvcName} onChange={e => setEditSvcName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveServiceName(svc.id); if (e.key === 'Escape') setEditingSvcId(null) }}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  <button onClick={() => saveServiceName(svc.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingSvcId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <button onClick={() => toggleExpand(svc.id)} className="flex-1 flex items-center gap-2.5 text-left">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${svc.active ? 'bg-brand-500' : 'bg-gray-300'}`} />
                    <span className="text-sm font-semibold text-gray-900">{svc.name}</span>
                    <span className="text-xs text-gray-400">
                      {activePlans} plano{activePlans !== 1 ? 's' : ''} ativo{activePlans !== 1 ? 's' : ''}
                    </span>
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleServiceActive(svc)}
                      title={svc.active ? 'Desativar serviço' : 'Ativar serviço'}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg transition-colors border"
                      style={svc.active
                        ? { color: '#92400e', background: '#fef3c7', borderColor: '#fde68a' }
                        : { color: '#065f46', background: '#d1fae5', borderColor: '#a7f3d0' }
                      }
                    >
                      {svc.active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button onClick={() => { setEditingSvcId(svc.id); setEditSvcName(svc.name) }}
                      className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Plans list */}
            {isExpanded && (
              <div className="border-t border-gray-100">
                {/* Plans table header */}
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 px-6 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  <span className="pl-4">Plano</span>
                  <span className="w-32 text-right pr-3">Tabela</span>
                  <span className="w-24 text-right pr-3">Desc. máx.</span>
                  <span className="w-16 text-center pr-2">Status</span>
                  <span className="w-16 text-right">Ações</span>
                </div>

                {svc.crm_service_plans.map(plan => (
                  <div key={plan.id}
                    className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 items-center px-6 py-3 border-b border-gray-50 last:border-0 group ${!plan.active ? 'opacity-50' : ''}`}>
                    {editingPlanId === plan.id ? (
                      <div className="col-span-5 space-y-2 py-1">
                        <div className="grid grid-cols-2 gap-2">
                          <input autoFocus value={editPlanForm.name} onChange={e => setEditPlanForm(p => ({ ...p, name: e.target.value }))}
                            placeholder="Nome do plano"
                            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                          <input value={editPlanForm.description} onChange={e => setEditPlanForm(p => ({ ...p, description: e.target.value }))}
                            placeholder="Descrição (opcional)"
                            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                            <input type="number" min={0} step={0.01} value={editPlanForm.table_price}
                              onChange={e => setEditPlanForm(p => ({ ...p, table_price: e.target.value }))}
                              placeholder="Preço de tabela"
                              className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                          </div>
                          <div className="relative w-36">
                            <input type="number" min={0} max={100} step={0.5} value={editPlanForm.max_discount_pct}
                              onChange={e => setEditPlanForm(p => ({ ...p, max_discount_pct: e.target.value }))}
                              placeholder="Desc. máx."
                              className="w-full border border-gray-200 rounded-lg pl-3 pr-7 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                          </div>
                          <button onClick={() => savePlan(plan.id, svc.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingPlanId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="pl-4 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{plan.name}</p>
                          {plan.description && (
                            <p className="text-xs text-gray-400 truncate mt-0.5">{plan.description}</p>
                          )}
                        </div>
                        <div className="w-32 text-right pr-3">
                          {fmt(plan.table_price) ? (
                            <span className="text-sm font-semibold text-gray-900">{fmt(plan.table_price)}</span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </div>
                        <div className="w-24 text-right pr-3">
                          {plan.max_discount_pct > 0 ? (
                            <span className="text-sm font-medium text-amber-600">{plan.max_discount_pct}%</span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </div>
                        <div className="w-16 text-center pr-2">
                          <button onClick={() => togglePlanActive(plan, svc.id)}
                            title={plan.active ? 'Desativar' : 'Ativar'}
                            className={`w-8 h-4 rounded-full transition-colors relative ${plan.active ? 'bg-brand-500' : 'bg-gray-200'}`}>
                            <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${plan.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                        <div className="w-16 flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEditPlan(plan)}
                            className="p-1 text-gray-400 hover:text-brand-500 rounded transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deletePlan(plan.id, svc.id)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}

                {/* Add plan form */}
                {addingPlanFor === svc.id ? (
                  <div className="px-6 py-3 bg-brand-50/50 border-t border-brand-100 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input autoFocus value={newPlanForm.name} onChange={e => setNewPlanForm(p => ({ ...p, name: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Escape') { setAddingPlanFor(null); setNewPlanForm(emptyPlanForm) } }}
                        placeholder="Nome do plano (ex: Pacote 10 Aulas)"
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white" />
                      <input value={newPlanForm.description} onChange={e => setNewPlanForm(p => ({ ...p, description: e.target.value }))}
                        placeholder="Descrição (opcional)"
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                        <input type="number" min={0} step={0.01} value={newPlanForm.table_price}
                          onChange={e => setNewPlanForm(p => ({ ...p, table_price: e.target.value }))}
                          placeholder="Preço de tabela"
                          className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white" />
                      </div>
                      <div className="relative w-36">
                        <input type="number" min={0} max={100} step={0.5} value={newPlanForm.max_discount_pct}
                          onChange={e => setNewPlanForm(p => ({ ...p, max_discount_pct: e.target.value }))}
                          placeholder="Desc. máx."
                          className="w-full border border-gray-200 rounded-lg pl-3 pr-7 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white" />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                      </div>
                      <button onClick={() => createPlan(svc.id)}
                        className="px-3 py-1.5 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
                        Adicionar
                      </button>
                      <button onClick={() => { setAddingPlanFor(null); setNewPlanForm(emptyPlanForm) }}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-6 py-2.5 border-t border-gray-100">
                    <button
                      onClick={() => { setAddingPlanFor(svc.id); setNewPlanForm(emptyPlanForm) }}
                      className="flex items-center gap-1.5 text-xs text-brand-500 hover:text-brand-600 font-medium transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Adicionar plano
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {services.length === 0 && !addingSvc && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-400 text-sm">Nenhum serviço cadastrado</p>
          <button onClick={() => setAddingSvc(true)}
            className="mt-3 text-sm text-brand-500 hover:text-brand-600 font-medium">
            Criar primeiro serviço
          </button>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Serviços e planos inativos não aparecem na seleção de novos deals.
      </p>
    </div>
  )
}
