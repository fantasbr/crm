'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { NewDealModal } from '@/components/crm/new-deal-modal'
import { cn } from '@/lib/utils'
import { Send, Plus, Phone, CheckCheck, Clock, Search } from 'lucide-react'
import type { Database } from '@/lib/supabase/types'

type DbInbox = Database['public']['Tables']['crm_inboxes']['Row']
type DbStage = Database['public']['Tables']['crm_stages']['Row']

type DbConversation = Database['public']['Tables']['crm_conversations']['Row'] & {
  crm_contacts: { id: string; name: string; phone: string } | null
}
type DbMessage = Database['public']['Tables']['crm_messages']['Row']

interface InboxClientProps {
  inboxes: DbInbox[]
  initialConversations: DbConversation[]
  initialInboxId: string | null
  initialConvId: string | null
  initialPhone: string | null
  pipelineId: string | null
  stages: DbStage[]
}

function formatTime(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function formatMsgTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function InboxClient({
  inboxes,
  initialConversations,
  initialInboxId,
  initialConvId,
  initialPhone,
  pipelineId,
  stages,
}: InboxClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [activeInboxId, setActiveInboxId] = useState(initialInboxId ?? '')
  const [conversations, setConversations] = useState<DbConversation[]>(initialConversations)
  const [activeConvId, setActiveConvId] = useState<string | null>(initialConvId)
  const [messages, setMessages] = useState<DbMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [search, setSearch] = useState('')
  const [newDealOpen, setNewDealOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeConv = conversations.find(c => c.id === activeConvId) ?? null
  const activeInbox = inboxes.find(i => i.id === activeInboxId) ?? null

  // Ref para acessar a conversa ativa dentro do handler do EventSource
  const activeConvIdRef = useRef(activeConvId)
  useEffect(() => { activeConvIdRef.current = activeConvId }, [activeConvId])

  // ─── Load conversations when inbox changes ────────────────────────────────
  const loadConversations = useCallback(async (inboxId: string) => {
    const { data } = await supabase
      .from('crm_conversations')
      .select('*, crm_contacts(id, name, phone)')
      .eq('inbox_id', inboxId)
      .eq('status', 'open')
      .order('last_message_at', { ascending: false })
      .limit(50)
    setConversations((data ?? []) as DbConversation[])
  }, [supabase])

  // ─── Load messages for a conversation ─────────────────────────────────────
  const loadMessages = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from('crm_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(100)
    setMessages(data ?? [])
  }, [supabase])

  useEffect(() => {
    if (activeInboxId) loadConversations(activeInboxId)
  }, [activeInboxId, loadConversations])

  // ─── Auto-select from URL params ─────────────────────────────────────────
  useEffect(() => {
    if (initialPhone && conversations.length > 0) {
      const normalized = initialPhone.replace(/\D/g, '')
      const found = conversations.find(c => c.wa_jid.includes(normalized))
      if (found) setActiveConvId(found.id)
    }
  }, [initialPhone, conversations])

  // ─── Load messages when conversation changes ──────────────────────────────
  useEffect(() => {
    if (!activeConvId) return
    setLoadingMsgs(true)
    loadMessages(activeConvId).finally(() => setLoadingMsgs(false))

    // Mark as read
    supabase.from('crm_conversations').update({ unread_count: 0 }).eq('id', activeConvId)

    // Update URL
    const params = new URLSearchParams(searchParams.toString())
    params.set('conv', activeConvId)
    params.delete('phone')
    router.replace(`/inbox?${params.toString()}`, { scroll: false })
  }, [activeConvId, supabase, router, searchParams, loadMessages])

  // ─── Scroll to bottom on new messages ────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ─── Tempo real via SSE (backend do CRM, sem WebSocket do Supabase) ───────
  useEffect(() => {
    if (!activeInboxId) return
    const es = new EventSource(`/api/whatsapp/stream?inboxId=${activeInboxId}`)

    es.onmessage = (e) => {
      let ev: { inboxId: string; conversationId: string }
      try { ev = JSON.parse(e.data) } catch { return }

      loadConversations(activeInboxId)

      if (ev.conversationId === activeConvIdRef.current) {
        loadMessages(ev.conversationId)
        supabase.from('crm_conversations').update({ unread_count: 0 }).eq('id', ev.conversationId)
      }
    }

    // EventSource reconecta sozinho em caso de queda
    return () => es.close()
  }, [activeInboxId, supabase, loadConversations, loadMessages])

  // ─── Send message ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!text.trim() || !activeConvId || sending) return
    setSending(true)
    setSendError(null)
    const body = text.trim()
    setText('')
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: activeConvId, text: body }),
      })
      if (!res.ok) {
        setText(body)
        let msg = `Erro ${res.status}`
        try {
          const j = await res.json()
          msg = j.detail ? `${j.error}: ${j.detail}` : (j.error ?? msg)
        } catch { /* corpo não-JSON */ }
        setSendError(msg)
        console.error('Send failed', msg)
      } else {
        loadMessages(activeConvId)
      }
    } catch (err) {
      setText(body)
      setSendError(String(err))
    } finally {
      setSending(false)
    }
  }

  // ─── Filtered conversations ───────────────────────────────────────────────
  const filtered = conversations.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    const name = c.crm_contacts?.name?.toLowerCase() ?? ''
    const phone = c.crm_contacts?.phone ?? ''
    return name.includes(q) || phone.includes(q)
  })

  if (inboxes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Nenhum inbox configurado. Adicione instâncias em <code className="mx-1 bg-gray-100 px-1 rounded">crm_inboxes</code>.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tabs por inbox */}
      <div className="flex items-center gap-1 px-4 pt-3 border-b border-gray-200 bg-white flex-shrink-0 overflow-x-auto">
        {inboxes.map(inbox => (
          <button
            key={inbox.id}
            onClick={() => { setActiveInboxId(inbox.id); setActiveConvId(null) }}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap',
              activeInboxId === inbox.id
                ? 'border-b-2 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
            style={activeInboxId === inbox.id ? { borderBottomColor: inbox.color } : {}}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: inbox.color }}
            />
            {inbox.name}
            {inbox.phone && <span className="text-xs text-gray-400 font-normal">{inbox.phone}</span>}
          </button>
        ))}
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Conversation list */}
        <div className="w-72 xl:w-80 flex-shrink-0 border-r border-gray-200 flex flex-col bg-white">
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {filtered.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm">
                {activeInbox ? 'Nenhuma conversa' : 'Selecione um inbox'}
              </div>
            )}
            {filtered.map(conv => {
              const contact = conv.crm_contacts
              const name = contact?.name ?? conv.wa_jid.split('@')[0]
              const isActive = conv.id === activeConvId
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors',
                    isActive && 'bg-brand-50 hover:bg-brand-50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-brand-600">{name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={cn('text-sm truncate', isActive ? 'font-semibold text-brand-700' : 'font-medium text-gray-900')}>
                          {name}
                        </span>
                        <span className="text-[11px] text-gray-400 flex-shrink-0 ml-1">
                          {formatTime(conv.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-gray-500 truncate">{conv.last_message ?? ''}</p>
                        {(conv.unread_count ?? 0) > 0 && (
                          <span className="ml-1 flex-shrink-0 w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Chat panel */}
        {!activeConv ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm bg-gray-50">
            Selecione uma conversa
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Chat header */}
            <div className="px-5 py-3.5 border-b border-gray-200 bg-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center">
                  <span className="text-sm font-bold text-brand-600">
                    {(activeConv.crm_contacts?.name ?? activeConv.wa_jid).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {activeConv.crm_contacts?.name ?? activeConv.wa_jid.split('@')[0]}
                  </p>
                  {activeConv.crm_contacts?.phone && (
                    <p className="text-xs text-gray-500">{activeConv.crm_contacts.phone}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeConv.crm_contacts?.phone && (
                  <a
                    href={`tel:${activeConv.crm_contacts.phone}`}
                    className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors"
                    title="Ligar"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => setNewDealOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 text-white text-xs font-medium rounded-lg hover:bg-brand-600 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Criar Deal
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {loadingMsgs && (
                <div className="text-center text-gray-400 text-sm py-4">Carregando...</div>
              )}
              {messages.map(msg => {
                const isOut = msg.direction === 'outbound'
                return (
                  <div key={msg.id} className={cn('flex', isOut ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-xs xl:max-w-sm px-3.5 py-2 rounded-2xl text-sm shadow-sm',
                        isOut
                          ? 'bg-brand-500 text-white rounded-br-sm'
                          : 'bg-white text-gray-900 rounded-bl-sm'
                      )}
                    >
                      {!isOut && msg.sender_name && (
                        <p className="text-[10px] font-semibold text-brand-500 mb-0.5">{msg.sender_name}</p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                      <div className={cn('flex items-center justify-end gap-1 mt-1', isOut ? 'text-white/60' : 'text-gray-400')}>
                        <span className="text-[10px]">{formatMsgTime(msg.created_at)}</span>
                        {isOut && (
                          msg.status === 'read' ? (
                            <CheckCheck className="w-3 h-3 text-blue-300" />
                          ) : msg.status === 'delivered' ? (
                            <CheckCheck className="w-3 h-3" />
                          ) : msg.status === 'failed' ? (
                            <span className="text-[10px] text-red-300">!</span>
                          ) : (
                            <Clock className="w-3 h-3" />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-gray-200 bg-white flex-shrink-0">
              {sendError && (
                <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 break-words">
                  {sendError}
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
                  }}
                  placeholder="Mensagem..."
                  rows={1}
                  className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 max-h-32 overflow-y-auto"
                  style={{ height: 'auto' }}
                />
                <button
                  onClick={handleSend}
                  disabled={!text.trim() || sending}
                  className="p-2.5 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 transition-colors flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Deal Modal */}
      {pipelineId && (
        <NewDealModal
          open={newDealOpen}
          onClose={() => setNewDealOpen(false)}
          pipelineId={pipelineId}
          stages={stages}
          prefilledContactId={activeConv?.crm_contacts?.id ?? undefined}
          prefilledConversationId={activeConvId ?? undefined}
          onCreated={() => setNewDealOpen(false)}
        />
      )}
    </div>
  )
}
