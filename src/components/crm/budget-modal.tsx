'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import type { Deal } from '@/types/crm'
import type { Database } from '@/lib/supabase/types'
import { FileText } from 'lucide-react'

type DbPlan = Database['public']['Tables']['crm_service_plans']['Row']

interface SelectedPlan {
  planId: string
  tablePrice: number | null
  customPrice: string
}

interface BudgetModalProps {
  deal: Deal
  open: boolean
  onClose: () => void
}

export function BudgetModal({ deal, open, onClose }: BudgetModalProps) {
  const [plans, setPlans] = useState<DbPlan[]>([])
  const [selected, setSelected] = useState<SelectedPlan[]>([])
  const [validDays, setValidDays] = useState('7')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelected([])
    setValidDays('7')
    setNotes('')
    const supabase = createClient()
    supabase.from('crm_service_plans')
      .select('*')
      .eq('service_id', deal.serviceId)
      .eq('active', true)
      .order('order')
      .then(({ data }) => setPlans(data ?? []))
  }, [open, deal.serviceId])

  const togglePlan = (plan: DbPlan) => {
    setSelected(prev => {
      const exists = prev.find(p => p.planId === plan.id)
      if (exists) return prev.filter(p => p.planId !== plan.id)
      return [...prev, {
        planId: plan.id,
        tablePrice: plan.table_price,
        customPrice: plan.table_price != null ? String(plan.table_price) : '',
      }]
    })
  }

  const updateCustomPrice = (planId: string, value: string) =>
    setSelected(prev => prev.map(p => p.planId === planId ? { ...p, customPrice: value } : p))

  const handleSave = async () => {
    if (selected.length === 0) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const { data: budget, error } = await supabase
        .from('crm_budgets')
        .insert({
          deal_id: deal.id,
          valid_days: parseInt(validDays) || 7,
          notes: notes.trim() || null,
          created_by: user?.id ?? null,
        })
        .select()
        .single()

      if (error || !budget) throw error

      await supabase.from('crm_budget_plans').insert(
        selected.map(p => ({
          budget_id: budget.id,
          plan_id: p.planId,
          custom_price: p.customPrice ? parseFloat(p.customPrice) : null,
        }))
      )

      onClose()
      window.open(`/budget/${budget.id}`, '_blank')
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const fmt = (v: number | null) =>
    v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" />
            Gerar Orçamento
          </DialogTitle>
          <p className="text-sm text-gray-500">{deal.contact.name} · {deal.service.name}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-1 pr-1">
          {/* Selecionar planos */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Selecione os planos para apresentar
            </p>
            {plans.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-400">Nenhum plano ativo para {deal.service.name}</p>
                <p className="text-xs text-gray-400 mt-1">Cadastre planos em Configurações → Serviços</p>
              </div>
            ) : (
              <div className="space-y-2">
                {plans.map(plan => {
                  const sel = selected.find(p => p.planId === plan.id)
                  return (
                    <div key={plan.id}
                      className={`rounded-lg border-2 overflow-hidden transition-colors ${sel ? 'border-brand-400' : 'border-gray-200'}`}>
                      <button
                        type="button"
                        onClick={() => togglePlan(plan)}
                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${sel ? 'bg-brand-50' : 'bg-white hover:bg-gray-50'}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${sel ? 'bg-brand-500 border-brand-500' : 'border-gray-300'}`}>
                            {sel && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm font-medium ${sel ? 'text-brand-700' : 'text-gray-800'}`}>{plan.name}</p>
                            {plan.description && (
                              <p className="text-xs text-gray-500 truncate mt-0.5">{plan.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-3 flex-shrink-0">
                          {plan.table_price != null && (
                            <p className={`text-sm font-semibold ${sel ? 'text-brand-600' : 'text-gray-700'}`}>
                              {fmt(plan.table_price)}
                            </p>
                          )}
                          {plan.max_discount_pct > 0 && (
                            <p className="text-xs text-amber-600">até -{plan.max_discount_pct}%</p>
                          )}
                        </div>
                      </button>

                      {sel && (
                        <div className="px-4 pb-3 pt-1 bg-brand-50 border-t border-brand-100">
                          <label className="text-xs text-brand-700 font-medium block mb-1">Preço no orçamento</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                            <input
                              type="number" min={0} step={0.01}
                              value={sel.customPrice}
                              onChange={e => updateCustomPrice(plan.id, e.target.value)}
                              placeholder={plan.table_price != null ? String(plan.table_price) : '0,00'}
                              className="w-full border border-brand-200 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Validade */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Validade</p>
            <div className="flex items-center gap-2">
              {['3', '7', '15', '30'].map(d => (
                <button key={d} type="button"
                  onClick={() => setValidDays(d)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${validDays === d ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'}`}>
                  {d} dias
                </button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Observações</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Condições especiais, formas de pagamento, detalhes..."
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            {selected.length === 0
              ? 'Selecione ao menos um plano'
              : `${selected.length} plano${selected.length > 1 ? 's' : ''} selecionado${selected.length > 1 ? 's' : ''}`}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={selected.length === 0 || saving}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors">
              <FileText className="w-4 h-4" />
              {saving ? 'Gerando...' : 'Gerar e Abrir'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
