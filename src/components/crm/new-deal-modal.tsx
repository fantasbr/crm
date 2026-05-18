'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { paymentLabels, originLabels } from '@/lib/labels'
import type { PaymentMethod, ContactOrigin, DealTemperature } from '@/types/crm'
import type { Database } from '@/lib/supabase/types'

type CrmUser = Database['public']['Tables']['crm_users']['Row']
type CrmStage = Database['public']['Tables']['crm_stages']['Row']
type CrmContact = Database['public']['Tables']['crm_contacts']['Row']
type DbService = Database['public']['Tables']['crm_services']['Row']
type DbPlan = Database['public']['Tables']['crm_service_plans']['Row']

interface ServiceWithPlans extends DbService {
  crm_service_plans: DbPlan[]
}

interface NewDealModalProps {
  open: boolean
  onClose: () => void
  pipelineId: string
  initialStageId?: string
  stages: CrmStage[]
  onCreated: () => void
}

export function NewDealModal({ open, onClose, pipelineId, initialStageId, stages, onCreated }: NewDealModalProps) {
  const [users, setUsers] = useState<CrmUser[]>([])
  const [contacts, setContacts] = useState<CrmContact[]>([])
  const [services, setServices] = useState<ServiceWithPlans[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [contactMode, setContactMode] = useState<'existing' | 'new'>('existing')

  const [form, setForm] = useState({
    contactId: '',
    newContactName: '',
    newContactPhone: '',
    newContactEmail: '',
    newContactOrigin: 'presencial' as ContactOrigin,
    stageId: initialStageId ?? stages[0]?.id ?? '',
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

  const set = (key: string, value: string | number) =>
    setForm(prev => ({ ...prev, [key]: value }))

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    supabase.from('crm_users').select('*').order('name').then(({ data }) => setUsers(data ?? []))
    supabase.from('crm_contacts').select('*').order('name').then(({ data }) => setContacts(data ?? []))
    supabase
      .from('crm_services')
      .select('*, crm_service_plans(*)')
      .eq('active', true)
      .order('order')
      .then(({ data }) => {
        const svcs = (data ?? []) as ServiceWithPlans[]
        setServices(svcs.map(s => ({
          ...s,
          crm_service_plans: (s.crm_service_plans ?? []).filter(p => p.active).sort((a, b) => a.order - b.order),
        })))
      })
  }, [open])

  useEffect(() => {
    if (initialStageId) set('stageId', initialStageId)
  }, [initialStageId])

  const selectedService = services.find(s => s.id === form.serviceId)
  const selectedPlan = selectedService?.crm_service_plans.find(p => p.id === form.planId)

  const handleServiceSelect = (svc: ServiceWithPlans) => {
    setForm(prev => ({ ...prev, serviceId: svc.id, planId: '' }))
  }

  const handlePlanSelect = (plan: DbPlan) => {
    setForm(prev => ({
      ...prev,
      planId: plan.id,
      negotiatedValue: plan.table_price != null && !prev.negotiatedValue
        ? String(plan.table_price)
        : prev.negotiatedValue,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.serviceId) return
    setSubmitting(true)
    const supabase = createClient()

    try {
      let contactId = form.contactId

      if (contactMode === 'new') {
        const { data, error } = await supabase
          .from('crm_contacts')
          .insert({
            name: form.newContactName,
            phone: form.newContactPhone,
            email: form.newContactEmail || null,
            origin: form.newContactOrigin,
          })
          .select()
          .single()
        if (error) throw error
        contactId = data.id
      }

      const { error } = await supabase.from('crm_deals').insert({
        contact_id: contactId,
        pipeline_id: pipelineId,
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
      if (error) throw error

      onCreated()
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Deal</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Contato */}
          <div>
            <div className="flex gap-2 mb-3">
              {(['existing', 'new'] as const).map(m => (
                <button key={m} type="button" onClick={() => setContactMode(m)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${contactMode === m ? 'bg-brand-500 text-white border-brand-500' : 'border-gray-200 text-gray-600'}`}>
                  {m === 'existing' ? 'Contato existente' : 'Novo contato'}
                </button>
              ))}
            </div>

            {contactMode === 'existing' ? (
              <select required value={form.contactId} onChange={e => set('contactId', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                <option value="">Selecionar contato...</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
              </select>
            ) : (
              <div className="space-y-3">
                <input required value={form.newContactName} onChange={e => set('newContactName', e.target.value)}
                  placeholder="Nome completo *"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <input required value={form.newContactPhone} onChange={e => set('newContactPhone', e.target.value)}
                  placeholder="Telefone *"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <input value={form.newContactEmail} onChange={e => set('newContactEmail', e.target.value)}
                  placeholder="E-mail" type="email"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(Object.keys(originLabels) as ContactOrigin[]).map(o => (
                    <button key={o} type="button" onClick={() => set('newContactOrigin', o)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${form.newContactOrigin === o ? 'bg-brand-500 text-white border-brand-500' : 'border-gray-200 text-gray-600'}`}>
                      {originLabels[o]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Etapa</label>
              <select value={form.stageId} onChange={e => set('stageId', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Responsável</label>
              <select value={form.assignedTo} onChange={e => set('assignedTo', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                <option value="">Sem responsável</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          {/* Serviço */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Serviço de Interesse *</label>
            {services.length === 0 ? (
              <p className="text-xs text-gray-400">Carregando...</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {services.map(svc => (
                  <button key={svc.id} type="button" onClick={() => handleServiceSelect(svc)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors text-left ${form.serviceId === svc.id ? 'bg-brand-500 text-white border-brand-500' : 'border-gray-200 text-gray-600 hover:border-brand-300'}`}>
                    {svc.name}
                  </button>
                ))}
              </div>
            )}

            {/* Planos do serviço selecionado */}
            {selectedService && selectedService.crm_service_plans.length > 0 && (
              <div className="mt-3 border border-gray-100 rounded-lg p-3 bg-gray-50">
                <p className="text-xs font-medium text-gray-500 mb-2">Plano <span className="text-gray-400">(opcional)</span></p>
                <div className="space-y-1.5">
                  {selectedService.crm_service_plans.map(plan => {
                    const isSelected = form.planId === plan.id
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => handlePlanSelect(plan)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm border transition-all ${
                          isSelected
                            ? 'bg-brand-500 text-white border-brand-500'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-brand-300'
                        }`}
                      >
                        <span className="font-medium">{plan.name}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {plan.table_price != null && (
                            <span className={`text-xs ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                              {plan.table_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          )}
                          {plan.max_discount_pct > 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-600'}`}>
                              desc. {plan.max_discount_pct}%
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
                {form.planId && (
                  <button type="button" onClick={() => set('planId', '')}
                    className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline">
                    Remover seleção de plano
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Temperatura</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['frio', 'morno', 'quente', 'fechando'] as DealTemperature[]).map(t => (
                  <button key={t} type="button" onClick={() => set('temperature', t)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors capitalize ${form.temperature === t ? 'bg-brand-500 text-white border-brand-500' : 'border-gray-200 text-gray-600'}`}>
                    {t === 'frio' ? '🧊' : t === 'morno' ? '☀️' : t === 'quente' ? '🔥' : '✅'} {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Urgência: <span className="text-brand-500 font-bold">{form.urgency}/5</span>
              </label>
              <input type="range" min={1} max={5} value={form.urgency}
                onChange={e => set('urgency', parseInt(e.target.value))}
                className="w-full accent-brand-500 mt-2" />
            </div>
          </div>

          <div className="space-y-2">
            <textarea value={form.interestPoint} onChange={e => set('interestPoint', e.target.value)}
              placeholder="Ponto de interesse..." rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
            <textarea value={form.objection} onChange={e => set('objection', e.target.value)}
              placeholder="Objeção..." rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
            <textarea value={form.previousExperience} onChange={e => set('previousExperience', e.target.value)}
              placeholder="Experiência prévia com CNH..." rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Valor (R$)
                {selectedPlan?.table_price != null && (
                  <span className="ml-1 text-gray-400 font-normal">
                    tabela: {selectedPlan.table_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                )}
              </label>
              <input value={form.negotiatedValue} onChange={e => set('negotiatedValue', e.target.value)}
                type="number" min={0} placeholder="0,00"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pagamento</label>
              <select value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                <option value="">Selecionar...</option>
                {(Object.keys(paymentLabels) as PaymentMethod[]).map(m => (
                  <option key={m} value={m}>{paymentLabels[m]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={submitting || !form.serviceId}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-60">
              {submitting ? 'Salvando...' : 'Criar Deal'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
