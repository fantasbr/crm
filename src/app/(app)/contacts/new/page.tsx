'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { paymentLabels, originLabels } from '@/lib/labels'
import type { PaymentMethod, ContactOrigin, DealTemperature } from '@/types/crm'
import type { Database } from '@/lib/supabase/types'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type Pipeline = Database['public']['Tables']['crm_pipelines']['Row']
type Stage = Database['public']['Tables']['crm_stages']['Row']
type User = Database['public']['Tables']['crm_users']['Row']
type DbService = Database['public']['Tables']['crm_services']['Row']
type DbPlan = Database['public']['Tables']['crm_service_plans']['Row']

interface ServiceWithPlans extends DbService {
  crm_service_plans: DbPlan[]
}

export default function NewContactPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [services, setServices] = useState<ServiceWithPlans[]>([])

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    origin: 'presencial' as ContactOrigin,
    // Deal
    createDeal: true,
    pipelineId: '',
    stageId: '',
    assignedTo: '',
    serviceId: '',
    planId: '',
    urgency: 3,
    temperature: 'morno' as DealTemperature,
    interestPoint: '',
    objection: '',
    previousExperience: '',
    paymentMethod: '' as PaymentMethod | '',
    negotiatedValue: '',
  })

  const set = (key: string, value: string | number | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }))

  useEffect(() => {
    const supabase = createClient()
    supabase.from('crm_pipelines').select('*').order('created_at').then(({ data }) => {
      setPipelines(data ?? [])
      if (data && data.length > 0) set('pipelineId', data[0].id)
    })
    supabase.from('crm_users').select('*').order('name').then(({ data }) => setUsers(data ?? []))
    supabase.from('crm_services').select('*, crm_service_plans(*)')
      .eq('active', true).order('order')
      .then(({ data }) => {
        const svcs = (data ?? []).map(s => ({
          ...s,
          crm_service_plans: ((s.crm_service_plans ?? []) as DbPlan[])
            .filter(p => p.active)
            .sort((a, b) => a.order - b.order),
        })) as ServiceWithPlans[]
        setServices(svcs)
      })
  }, [])

  useEffect(() => {
    if (!form.pipelineId) return
    const supabase = createClient()
    supabase.from('crm_stages').select('*').eq('pipeline_id', form.pipelineId).order('order').then(({ data }) => {
      setStages(data ?? [])
      if (data && data.length > 0) set('stageId', data[0].id)
    })
  }, [form.pipelineId])

  const selectedService = services.find(s => s.id === form.serviceId) ?? null
  const selectedPlan = selectedService?.crm_service_plans.find(p => p.id === form.planId) ?? null

  const handleServiceSelect = (svc: ServiceWithPlans) => {
    setForm(prev => ({ ...prev, serviceId: svc.id, planId: '' }))
  }

  const handlePlanSelect = (plan: DbPlan) => {
    setForm(prev => ({
      ...prev,
      planId: prev.planId === plan.id ? '' : plan.id,
      negotiatedValue: plan.table_price != null && !prev.negotiatedValue && prev.planId !== plan.id
        ? String(plan.table_price)
        : prev.negotiatedValue,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const supabase = createClient()

    try {
      const { data: contact, error: contactErr } = await supabase
        .from('crm_contacts')
        .insert({
          name: form.name,
          phone: form.phone,
          email: form.email || null,
          origin: form.origin,
        })
        .select()
        .single()

      if (contactErr) {
        if (contactErr.code === '23505') setError('Já existe um contato com este telefone.')
        else setError(contactErr.message)
        setSaving(false)
        return
      }

      if (form.createDeal && form.pipelineId && form.stageId && form.serviceId) {
        await supabase.from('crm_deals').insert({
          contact_id: contact.id,
          pipeline_id: form.pipelineId,
          stage_id: form.stageId,
          assigned_to: form.assignedTo || null,
          service_id: form.serviceId,
          plan_id: form.planId || null,
          urgency: form.urgency,
          temperature: form.temperature,
          interest_point: form.interestPoint || null,
          objection: form.objection || null,
          previous_experience: form.previousExperience || null,
          payment_method: (form.paymentMethod as PaymentMethod) || null,
          negotiated_value: form.negotiatedValue ? parseFloat(form.negotiatedValue) : null,
        })
      }

      router.push('/contacts')
      router.refresh()
    } catch {
      setError('Erro ao salvar. Tente novamente.')
      setSaving(false)
    }
  }

  return (
    <div className="p-5 xl:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6 xl:mb-8">
        <Link href="/contacts" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo Contato</h1>
          <p className="text-sm text-gray-500">Cadastro de lead</p>
        </div>
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados pessoais */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Dados do Contato</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome *</label>
            <input required value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Nome completo"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefone *</label>
              <input required value={form.phone} onChange={e => set('phone', e.target.value)}
                placeholder="(62) 99999-0000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="email@exemplo.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Origem</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(Object.keys(originLabels) as ContactOrigin[]).map(o => (
                <button key={o} type="button" onClick={() => set('origin', o)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${form.origin === o ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'}`}>
                  {originLabels[o]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Criar deal junto */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-semibold text-gray-900">Criar Deal</h2>
              <p className="text-xs text-gray-500 mt-0.5">Adicionar direto ao pipeline</p>
            </div>
            <button type="button" onClick={() => set('createDeal', !form.createDeal)}
              className={`relative w-10 h-6 rounded-full transition-colors ${form.createDeal ? 'bg-brand-500' : 'bg-gray-200'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.createDeal ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
          </div>

          {form.createDeal && (
            <div className="p-6 space-y-4">
              {/* Pipeline e Etapa */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Pipeline</label>
                  <select value={form.pipelineId} onChange={e => set('pipelineId', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                    {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Etapa</label>
                  <select value={form.stageId} onChange={e => set('stageId', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Responsável</label>
                <select value={form.assignedTo} onChange={e => set('assignedTo', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                  <option value="">Sem responsável</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>

              {/* Serviço */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Serviço de Interesse</label>
                {services.length === 0 ? (
                  <p className="text-xs text-gray-400">Carregando serviços...</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {services.map(svc => (
                      <button key={svc.id} type="button" onClick={() => handleServiceSelect(svc)}
                        className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors text-left ${form.serviceId === svc.id ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'}`}>
                        {svc.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Planos do serviço selecionado */}
              {selectedService && selectedService.crm_service_plans.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Plano
                    <span className="text-gray-400 font-normal ml-1">(opcional)</span>
                  </label>
                  <div className="space-y-1.5">
                    {selectedService.crm_service_plans.map(plan => {
                      const isSelected = form.planId === plan.id
                      return (
                        <button key={plan.id} type="button" onClick={() => handlePlanSelect(plan)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border-2 text-left transition-all ${isSelected ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white hover:border-brand-300'}`}>
                          <div>
                            <p className={`text-sm font-medium ${isSelected ? 'text-brand-700' : 'text-gray-800'}`}>{plan.name}</p>
                            {plan.description && (
                              <p className="text-xs text-gray-500 mt-0.5">{plan.description}</p>
                            )}
                          </div>
                          <div className="text-right ml-3 flex-shrink-0">
                            {plan.table_price != null && (
                              <p className={`text-sm font-semibold ${isSelected ? 'text-brand-600' : 'text-gray-700'}`}>
                                {plan.table_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </p>
                            )}
                            {plan.max_discount_pct > 0 && (
                              <p className="text-xs text-amber-600">até -{plan.max_discount_pct}%</p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Temperatura + Urgência */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Temperatura</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['frio', 'morno', 'quente', 'fechando'] as DealTemperature[]).map(t => (
                      <button key={t} type="button" onClick={() => set('temperature', t)}
                        className={`py-2 px-2 rounded-lg text-sm font-medium border transition-colors capitalize ${form.temperature === t ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'}`}>
                        {t === 'frio' ? '🧊' : t === 'morno' ? '☀️' : t === 'quente' ? '🔥' : '✅'} {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Urgência: <span className="text-brand-500 font-bold">{form.urgency}/5</span>
                  </label>
                  <input type="range" min={1} max={5} value={form.urgency}
                    onChange={e => set('urgency', parseInt(e.target.value))}
                    className="w-full accent-brand-500 mt-3" />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Baixa</span><span>Alta</span>
                  </div>
                </div>
              </div>

              {/* Qualificação */}
              <div className="space-y-3">
                <textarea value={form.interestPoint} onChange={e => set('interestPoint', e.target.value)}
                  placeholder="Ponto de interesse (o que chamou atenção do lead?)" rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
                <textarea value={form.objection} onChange={e => set('objection', e.target.value)}
                  placeholder="Objeção (o que pode travar o fechamento?)" rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
                <textarea value={form.previousExperience} onChange={e => set('previousExperience', e.target.value)}
                  placeholder="Experiência prévia (já fez CNH? qual categoria?)" rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
              </div>

              {/* Negócio */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Valor Estimado (R$)
                    {selectedPlan?.table_price != null && !form.negotiatedValue && (
                      <span className="text-xs text-brand-500 ml-1">preenchido pelo plano</span>
                    )}
                  </label>
                  <input value={form.negotiatedValue} onChange={e => set('negotiatedValue', e.target.value)}
                    type="number" min={0} placeholder="0,00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Forma de Pagamento</label>
                  <select value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                    <option value="">Selecionar...</option>
                    {(Object.keys(paymentLabels) as PaymentMethod[]).map(m => (
                      <option key={m} value={m}>{paymentLabels[m]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link href="/contacts" className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </Link>
          <button type="submit" disabled={saving}
            className="px-5 py-2.5 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors disabled:opacity-60">
            {saving ? 'Salvando...' : 'Salvar Contato'}
          </button>
        </div>
      </form>
    </div>
  )
}
