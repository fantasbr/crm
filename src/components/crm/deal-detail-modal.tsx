'use client'

import { useState, useEffect } from 'react'
import { Deal } from '@/types/crm'
import { paymentLabels, temperatureEmoji, temperatureColors, originLabels, originColors } from '@/lib/labels'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Phone, Mail, Calendar, MessageSquare, ArrowRight, CheckCircle, XCircle, Pencil, Check, X, FileText, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type Activity = Database['public']['Tables']['crm_deal_activities']['Row'] & {
  crm_users: { name: string } | null
}

type Stage = Database['public']['Tables']['crm_stages']['Row']

const activityIcon = (type: string) => {
  switch (type) {
    case 'stage_change': return <ArrowRight className="w-3.5 h-3.5 text-brand-500" />
    case 'won': return <CheckCircle className="w-3.5 h-3.5 text-green-500" />
    case 'lost': return <XCircle className="w-3.5 h-3.5 text-red-500" />
    default: return <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
  }
}

interface DealDetailModalProps {
  deal: Deal
  open: boolean
  onClose: () => void
  onUpdated?: () => void
  onBudget?: () => void
}

export function DealDetailModal({ deal, open, onClose, onUpdated, onBudget }: DealDetailModalProps) {
  const [tab, setTab] = useState<'info' | 'activity'>('info')
  const [editing, setEditing] = useState(false)
  const [activities, setActivities] = useState<Activity[]>([])
  const [note, setNote] = useState('')
  const [stages, setStages] = useState<Stage[]>([])
  const [saving, setSaving] = useState(false)
  const [closingDeal, setClosingDeal] = useState<'won' | 'lost' | null>(null)

  const [editForm, setEditForm] = useState({
    temperature: deal.temperature,
    urgency: deal.urgency,
    negotiated_value: deal.negotiatedValue?.toString() ?? '',
    objection: deal.objection ?? '',
    interest_point: deal.interestPoint ?? '',
    previous_experience: deal.previousExperience ?? '',
  })

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    supabase.from('crm_deal_activities')
      .select('*, crm_users(name)')
      .eq('deal_id', deal.id)
      .order('created_at', { ascending: false })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }) => setActivities((data ?? []) as any as Activity[]))

    supabase.from('crm_stages')
      .select('*')
      .eq('pipeline_id', deal.pipelineId)
      .order('order')
      .then(({ data }) => setStages(data ?? []))
  }, [open, deal.id, deal.pipelineId])

  const handleSaveEdit = async () => {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('crm_deals').update({
      temperature: editForm.temperature,
      urgency: editForm.urgency,
      negotiated_value: editForm.negotiated_value ? parseFloat(editForm.negotiated_value) : null,
      objection: editForm.objection || null,
      interest_point: editForm.interest_point || null,
      previous_experience: editForm.previous_experience || null,
    }).eq('id', deal.id)
    setSaving(false)
    setEditing(false)
    onUpdated?.()
  }

  const handleAddNote = async () => {
    if (!note.trim()) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('crm_deal_activities').insert({
      deal_id: deal.id,
      user_id: user?.id ?? null,
      type: 'note',
      content: note.trim(),
    })
    setNote('')
    const { data } = await supabase.from('crm_deal_activities')
      .select('*, crm_users(name)')
      .eq('deal_id', deal.id)
      .order('created_at', { ascending: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setActivities((data ?? []) as any as Activity[])
  }

  const handleCloseDeal = async (status: 'won' | 'lost') => {
    setClosingDeal(status)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('crm_deals').update({ status }).eq('id', deal.id)
    await supabase.from('crm_deal_activities').insert({
      deal_id: deal.id,
      user_id: user?.id ?? null,
      type: 'status_change',
      content: status === 'won' ? 'Deal marcado como GANHO ✅' : 'Deal marcado como PERDIDO ❌',
    })
    setClosingDeal(null)
    onUpdated?.()
    onClose()
  }

  const currentStage = stages.find(s => s.id === deal.stageId)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="h-[780px] max-h-[90vh] w-[calc(100%-2rem)] overflow-hidden flex flex-col sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl">
        <DialogHeader>
          <div className="flex flex-col gap-3 pr-9 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <DialogTitle className="text-xl leading-tight break-words">{deal.contact.name}</DialogTitle>
              <p className="text-sm text-gray-500 mt-0.5">{deal.contact.phone}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <span className={cn('whitespace-nowrap text-sm font-medium px-3 py-1 rounded-full', temperatureColors[deal.temperature])}>
                {temperatureEmoji[deal.temperature]} {deal.temperature}
              </span>
              {deal.waConversationId && (
                <Link
                  href={`/inbox?conv=${deal.waConversationId}`}
                  className="flex items-center gap-1 whitespace-nowrap px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-full hover:bg-green-700 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Inbox
                </Link>
              )}
              {deal.status === 'open' && (
                <>
                  {onBudget && (
                    <button onClick={onBudget}
                      className="flex items-center gap-1 whitespace-nowrap px-3 py-1 bg-amber-500 text-white text-xs font-medium rounded-full hover:bg-amber-600 transition-colors">
                      <FileText className="w-3.5 h-3.5" /> Orçamento
                    </button>
                  )}
                  <button onClick={() => handleCloseDeal('won')} disabled={!!closingDeal}
                    className="flex items-center gap-1 whitespace-nowrap px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-full hover:bg-green-700 disabled:opacity-50 transition-colors">
                    <CheckCircle className="w-3.5 h-3.5" /> Ganho
                  </button>
                  <button onClick={() => handleCloseDeal('lost')} disabled={!!closingDeal}
                    className="flex items-center gap-1 whitespace-nowrap px-3 py-1 bg-red-500 text-white text-xs font-medium rounded-full hover:bg-red-600 disabled:opacity-50 transition-colors">
                    <XCircle className="w-3.5 h-3.5" /> Perdido
                  </button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {(['info', 'activity'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('px-5 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize',
                tab === t ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-500 hover:text-gray-700')}>
              {t === 'info' ? 'Informações' : 'Histórico'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === 'info' && (
            <div className="p-5 space-y-4">
              {/* Contato */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contato</h3>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', originColors[deal.contact.origin])}>
                    {originLabels[deal.contact.origin]}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  <a href={`tel:${deal.contact.phone}`} className="hover:text-brand-500">{deal.contact.phone}</a>
                  {deal.waConversationId ? (
                    <Link
                      href={`/inbox?conv=${deal.waConversationId}`}
                      className="ml-1 text-xs text-green-600 hover:text-green-700 font-medium"
                    >
                      ver no inbox
                    </Link>
                  ) : (
                    <Link
                      href={`/inbox?phone=${deal.contact.phone.replace(/\D/g, '')}`}
                      className="ml-1 text-xs text-green-600 hover:text-green-700 font-medium"
                    >
                      inbox
                    </Link>
                  )}
                </div>
                {deal.contact.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    {deal.contact.email}
                  </div>
                )}
              </div>

              {/* Negócio */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Negócio</h3>
                  {!editing ? (
                    <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 font-medium">
                      <Pencil className="w-3 h-3" /> Editar
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={handleSaveEdit} disabled={saving}
                        className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium disabled:opacity-50">
                        <Check className="w-3 h-3" /> {saving ? 'Salvando...' : 'Salvar'}
                      </button>
                      <button onClick={() => setEditing(false)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium">
                        <X className="w-3 h-3" /> Cancelar
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Serviço</p>
                    <p className="text-sm font-medium text-gray-900">{deal.service?.name ?? '—'}</p>
                    {deal.plan ? (
                      <div className="mt-1">
                        <span className="inline-flex items-center text-xs bg-brand-50 text-brand-700 border border-brand-200 rounded-full px-2 py-0.5 font-medium">
                          {deal.plan.name}
                        </span>
                        {deal.plan.tablePrice != null && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Tabela: {deal.plan.tablePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            {deal.plan.maxDiscountPct > 0 && (
                              <span className="ml-1">· Margem: {deal.plan.maxDiscountPct}%</span>
                            )}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mt-0.5">Nenhum plano selecionado</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Etapa atual</p>
                    <div className="flex items-center gap-1.5">
                      {currentStage && (
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentStage.color }} />
                      )}
                      <p className="text-sm font-medium text-gray-900">{currentStage?.name ?? '—'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Responsável</p>
                    <p className="text-sm font-medium text-gray-900">{deal.assignedTo?.name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Pagamento</p>
                    <p className="text-sm font-medium text-gray-900">
                      {deal.paymentMethod ? paymentLabels[deal.paymentMethod] : '—'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 mb-1">Valor</p>
                    {editing ? (
                      <input type="number" min={0} value={editForm.negotiated_value}
                        onChange={e => setEditForm(p => ({ ...p, negotiated_value: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    ) : (
                      <p className="text-sm font-bold text-gray-900">
                        {deal.negotiatedValue?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 mb-1">Temperatura</p>
                    {editing ? (
                      <select value={editForm.temperature}
                        onChange={e => setEditForm(p => ({ ...p, temperature: e.target.value as typeof deal.temperature }))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                        {(['frio', 'morno', 'quente', 'fechando'] as const).map(t => (
                          <option key={t} value={t}>{temperatureEmoji[t]} {t}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', temperatureColors[deal.temperature])}>
                        {temperatureEmoji[deal.temperature]} {deal.temperature}
                      </span>
                    )}
                  </div>
                </div>

                {/* Urgência */}
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-1.5">Urgência {editing && <span className="text-brand-500 font-bold">{editForm.urgency}/5</span>}</p>
                  {editing ? (
                    <input type="range" min={1} max={5} value={editForm.urgency}
                      onChange={e => setEditForm(p => ({ ...p, urgency: parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5 }))}
                      className="w-full accent-brand-500" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(n => (
                          <div key={n} className={cn('w-8 h-2 rounded-full', n <= deal.urgency ? 'bg-brand-500' : 'bg-gray-200')} />
                        ))}
                      </div>
                      <span className="text-sm text-gray-500">{deal.urgency}/5</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Qualificação */}
              <div className="space-y-2 border-t border-gray-100 pt-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Qualificação</h3>

                {editing ? (
                  <div className="space-y-2">
                    <textarea value={editForm.interest_point}
                      onChange={e => setEditForm(p => ({ ...p, interest_point: e.target.value }))}
                      placeholder="Ponto de interesse..." rows={2}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
                    <textarea value={editForm.objection}
                      onChange={e => setEditForm(p => ({ ...p, objection: e.target.value }))}
                      placeholder="Objeção..." rows={2}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
                    <textarea value={editForm.previous_experience}
                      onChange={e => setEditForm(p => ({ ...p, previous_experience: e.target.value }))}
                      placeholder="Experiência prévia..." rows={2}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
                  </div>
                ) : (
                  <>
                    {deal.interestPoint && (
                      <div className="bg-green-50 rounded-lg p-3">
                        <p className="text-xs text-green-600 font-medium mb-1">✅ Ponto de Interesse</p>
                        <p className="text-sm text-gray-800">{deal.interestPoint}</p>
                      </div>
                    )}
                    {deal.objection && (
                      <div className="bg-orange-50 rounded-lg p-3">
                        <p className="text-xs text-orange-600 font-medium mb-1">⚠️ Objeção</p>
                        <p className="text-sm text-gray-800">{deal.objection}</p>
                      </div>
                    )}
                    {deal.previousExperience && (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-blue-600 font-medium mb-1">📋 Experiência Prévia</p>
                        <p className="text-sm text-gray-800">{deal.previousExperience}</p>
                      </div>
                    )}
                    {!deal.interestPoint && !deal.objection && !deal.previousExperience && (
                      <p className="text-sm text-gray-400 text-center py-4">Nenhuma qualificação registrada</p>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-400 border-t border-gray-100 pt-3">
                <Calendar className="w-3 h-3" />
                <span>Criado em {new Date(deal.createdAt).toLocaleDateString('pt-BR')}</span>
                <span>·</span>
                <span>Atualizado em {new Date(deal.updatedAt).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          )}

          {tab === 'activity' && (
            <div className="p-5 space-y-4">
              {/* Adicionar nota */}
              <div className="flex gap-2">
                <textarea value={note} onChange={e => setNote(e.target.value)}
                  placeholder="Adicionar anotação..." rows={2}
                  onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleAddNote() }}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
                <button onClick={handleAddNote} disabled={!note.trim()}
                  className="px-3 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-40 transition-colors self-end">
                  Salvar
                </button>
              </div>

              {/* Timeline */}
              {activities.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Nenhuma atividade registrada</p>
              ) : (
                <div className="space-y-3">
                  {activities.map(act => (
                    <div key={act.id} className="flex gap-3">
                      <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        {activityIcon(act.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800">{act.content}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-gray-400">
                            {new Date(act.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {act.crm_users && (
                            <>
                              <span className="text-xs text-gray-300">·</span>
                              <span className="text-xs text-gray-400">{act.crm_users.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
