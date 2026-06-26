'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NewDealModal } from '@/components/crm/new-deal-modal'
import { EditContactModal } from '@/components/crm/edit-contact-modal'
import { DealDetailModal } from '@/components/crm/deal-detail-modal'
import type { Deal, Contact, User } from '@/types/crm'
import { cn } from '@/lib/utils'
import { Send, Plus, Phone, CheckCheck, Clock, Search, Paperclip, FileText, X, Mic, Square, CheckCircle, RotateCcw, Pencil } from 'lucide-react'
import type { Database } from '@/lib/supabase/types'

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

type DbInbox = Database['public']['Tables']['crm_inboxes']['Row']
type DbStage = Database['public']['Tables']['crm_stages']['Row']

type DbConversation = Database['public']['Tables']['crm_conversations']['Row'] & {
  crm_contacts: { id: string; name: string; phone: string; email: string | null; origin: string } | null
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
  const supabase = useMemo(() => createClient(), [])

  const [activeInboxId, setActiveInboxId] = useState(initialInboxId ?? '')
  const [conversations, setConversations] = useState<DbConversation[]>(initialConversations)
  const [activeConvId, setActiveConvId] = useState<string | null>(initialConvId)
  const [messages, setMessages] = useState<DbMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'open' | 'resolved'>('open')
  const [newDealOpen, setNewDealOpen] = useState(false)
  const [editContactOpen, setEditContactOpen] = useState(false)
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null)
  const [dealPanelOpen, setDealPanelOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [pendingFile, setPendingFile] = useState<{ base64: string; type: string; name: string; preview?: string } | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeConvIdRef2 = useRef(activeConvId)
  // Cache base64 de mídias enviadas pelo CRM (outbound, sem metadata no banco)
  const mediaCacheRef = useRef<Map<string, string>>(new Map())
  const statusFilterRef = useRef<'open' | 'resolved'>('open')

  const activeConv = conversations.find(c => c.id === activeConvId) ?? null
  const activeInbox = inboxes.find(i => i.id === activeInboxId) ?? null

  useEffect(() => {
    setMounted(true)
    return () => {
      // Garante que microfone e timer são liberados ao desmontar
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
      if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    }
  }, [])

  // Refs para acessar valores atuais dentro de closures (SSE handlers)
  const activeConvIdRef = useRef(activeConvId)
  useEffect(() => {
    activeConvIdRef.current = activeConvId
    activeConvIdRef2.current = activeConvId
  }, [activeConvId])

  useEffect(() => { statusFilterRef.current = statusFilter }, [statusFilter])

  // ─── Load conversations when inbox or filter changes ─────────────────────
  const loadConversations = useCallback(async (inboxId: string) => {
    const { data } = await supabase
      .from('crm_conversations')
      .select('*, crm_contacts(id, name, phone, email, origin)')
      .eq('inbox_id', inboxId)
      .eq('status', statusFilterRef.current)
      .order('last_message_at', { ascending: false })
      .limit(50)
    // Preserva o zero local da conversa ativa para evitar race condition com SSE:
    // o SSE dispara loadConversations antes do mark-as-read persistir no banco.
    const activeId = activeConvIdRef.current
    setConversations(
      ((data ?? []) as DbConversation[]).map(c =>
        c.id === activeId ? { ...c, unread_count: 0 } : c
      )
    )
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

  // Deseleciona conversa quando o usuário muda de inbox ou filtro
  useEffect(() => {
    setActiveConvId(null)
  }, [activeInboxId, statusFilter])

  // Recarrega a lista de conversas
  useEffect(() => {
    if (activeInboxId) loadConversations(activeInboxId)
  }, [activeInboxId, statusFilter, loadConversations])

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

    // Mark as read — atualiza local imediatamente; persiste via service client (bypassa RLS)
    setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, unread_count: 0 } : c))
    fetch('/api/conversations/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: activeConvId }),
      keepalive: true,
    }).catch(err => console.warn('[inbox] mark-as-read failed:', err))

    // Atualiza a URL sem acionar re-fetch do RSC (router.replace com force-dynamic
    // causa remontagem via Suspense e o efeito de deselect limpa activeConvId).
    const params = new URLSearchParams(window.location.search)
    params.set('conv', activeConvId)
    params.delete('phone')
    history.replaceState(null, '', `/inbox?${params.toString()}`)
  }, [activeConvId, supabase, loadMessages])

  // ─── Busca o deal ativo do contato da conversa selecionada ───────────────
  useEffect(() => {
    const contactId = activeConv?.crm_contacts?.id
    if (!contactId) { setActiveDeal(null); return }
    supabase
      .from('crm_deals')
      .select('*, crm_contacts(*), crm_services(id, name), crm_service_plans(id, name, table_price, max_discount_pct), assigned_user:crm_users!crm_deals_assigned_to_fkey(id, name, role)')
      .eq('contact_id', contactId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setActiveDeal(data ? dbDealToDeal(data as Record<string, unknown>) : null))
  }, [activeConvId, supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Scroll to bottom on new messages ────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ─── Tempo real via SSE (backend do CRM, sem WebSocket do Supabase) ───────
  useEffect(() => {
    if (!activeInboxId) return
    const es = new EventSource(`/api/whatsapp/stream?inboxId=${activeInboxId}`)

    // Reconexão automática: recarrega a lista para recuperar eventos perdidos
    // durante a desconexão (SSE não faz replay; onopen dispara a cada reconect).
    es.onopen = () => {
      loadConversations(activeInboxId)
    }

    es.onmessage = (e) => {
      let ev: { inboxId: string; conversationId: string }
      try { ev = JSON.parse(e.data) } catch { return }

      loadConversations(activeInboxId)

      // Sempre recarrega a conversa aberta — o webhook pode ter encontrado uma
      // conversa diferente via dedup "1 por contato", então não filtramos por
      // ev.conversationId === activeConvId (isso causava mensagens sumindo).
      const currentConvId = activeConvIdRef.current
      if (currentConvId) {
        loadMessages(currentConvId)
        // Marca como lida se o evento é para esta conversa (loadConversations já zerará o count localmente)
        if (ev.conversationId === currentConvId) {
          fetch('/api/conversations/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationId: currentConvId }),
            keepalive: true,
          }).catch(() => {})
        }
      }
    }

    // Polling de segurança: garante atualização mesmo se o SSE perder eventos.
    // Intervalo longo para não sobrecarregar — SSE é o caminho principal.
    const poll = setInterval(() => loadConversations(activeInboxId), 30_000)

    return () => { es.close(); clearInterval(poll) }
  }, [activeInboxId, loadConversations, loadMessages])

  // ─── File picker ──────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''  // reset so same file can be re-picked
    if (!file) return
    if (file.size > 16 * 1024 * 1024) {
      setSendError('Arquivo muito grande. Limite: 16 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string
      setPendingFile({
        base64,
        type: file.type || 'application/octet-stream',
        name: file.name,
        preview: file.type.startsWith('image/') ? base64 : undefined,
      })
    }
    reader.readAsDataURL(file)
  }

  // ─── Voice recording ─────────────────────────────────────────────────────
  const startRecording = async () => {
    if (recording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/ogg;codecs=opus'
      const recorder = new MediaRecorder(stream, { mimeType })
      const chunks: BlobPart[] = []

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunks, { type: mimeType })
        const reader = new FileReader()
        reader.onload = (ev) => {
          const audioMime = mimeType.split(';')[0]  // "audio/webm" or "audio/ogg"
          const ext = audioMime === 'audio/webm' ? 'webm' : 'ogg'
          setPendingFile({
            base64: ev.target?.result as string,
            type: audioMime,
            name: `audio.${ext}`,
          })
        }
        reader.readAsDataURL(blob)
        if (recordTimerRef.current) clearInterval(recordTimerRef.current)
        setRecording(false)
        setRecordSeconds(0)
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
      setRecordSeconds(0)
      recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000)
    } catch {
      setSendError('Não foi possível acessar o microfone.')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
  }

  // ─── Send message ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    const hasText = text.trim().length > 0
    const hasMedia = !!pendingFile
    if ((!hasText && !hasMedia) || !activeConvId || sending) return
    setSending(true)
    setSendError(null)

    const payload = hasMedia
      ? {
          conversationId: activeConvId,
          mediaBase64: pendingFile.base64,
          mediaType: pendingFile.type,
          fileName: pendingFile.name,
          caption: text.trim() || undefined,
        }
      : { conversationId: activeConvId, text: text.trim() }

    // Captura antes de limpar o estado — closures React preservam o valor snapshot
    const snapshotFile = pendingFile
    const savedText = text
    setText('')
    setPendingFile(null)

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        // Restaura o que foi limpo para o usuário tentar de novo
        setText(savedText)
        if (hasMedia) setPendingFile(snapshotFile)
        let msg = `Erro ${res.status}`
        try {
          const j = await res.json() as { error?: string; detail?: string }
          msg = j.detail ? `${j.error}: ${j.detail}` : (j.error ?? msg)
        } catch { /* corpo não-JSON */ }
        setSendError(msg)
        console.error('Send failed', msg)
      } else {
        const j = await res.json() as { ok: boolean; messageId?: string | null }
        // Armazena base64 localmente para renderizar a mídia outbound no histórico
        if (hasMedia && snapshotFile && j.messageId) {
          mediaCacheRef.current.set(j.messageId, snapshotFile.base64)
        }
        // Usa ref para pegar o convId atual (pode ter mudado durante o await)
        const convIdNow = activeConvIdRef2.current
        if (convIdNow) loadMessages(convIdNow)
      }
    } catch (err) {
      setText(savedText)
      if (hasMedia) setPendingFile(snapshotFile)
      setSendError(String(err))
    } finally {
      setSending(false)
    }
  }

  // ─── Concluir / Reabrir conversa ─────────────────────────────────────────
  const handleToggleStatus = async () => {
    if (!activeConvId || !activeConv) return
    const newStatus = activeConv.status === 'open' ? 'resolved' : 'open'
    await supabase
      .from('crm_conversations')
      .update({ status: newStatus })
      .eq('id', activeConvId)
    setActiveConvId(null)
    loadConversations(activeInboxId)
  }

  // ─── Filtered conversations ───────────────────────────────────────────────
  const filtered = conversations.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    const name = c.crm_contacts?.name?.toLowerCase() ?? ''
    const phone = c.crm_contacts?.phone ?? ''
    const jidPhone = c.wa_jid.split('@')[0]
    return name.includes(q) || phone.includes(q) || jidPhone.includes(q)
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
                ? 'text-gray-900'
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
          {/* Status filter */}
          <div className="flex p-2 gap-1 border-b border-gray-100">
            <button
              onClick={() => setStatusFilter('open')}
              className={cn(
                'flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors',
                statusFilter === 'open'
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              )}
            >
              Abertas
            </button>
            <button
              onClick={() => setStatusFilter('resolved')}
              className={cn(
                'flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors',
                statusFilter === 'resolved'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              )}
            >
              Concluídas
            </button>
          </div>
          {/* Search */}
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
                          {mounted ? formatTime(conv.last_message_at) : ''}
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
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-gray-900">
                      {activeConv.crm_contacts?.name ?? activeConv.wa_jid.split('@')[0]}
                    </p>
                    {activeConv.crm_contacts && (
                      <button
                        onClick={() => setEditContactOpen(true)}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="Editar contato"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
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
                  onClick={handleToggleStatus}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                    activeConv.status === 'open'
                      ? 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                      : 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
                  )}
                >
                  {activeConv.status === 'open'
                    ? <><CheckCircle className="w-3.5 h-3.5" />Concluir</>
                    : <><RotateCcw className="w-3.5 h-3.5" />Reabrir</>
                  }
                </button>
                {activeDeal ? (
                  <button
                    onClick={() => setDealPanelOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-600 border border-brand-200 text-xs font-medium rounded-lg hover:bg-brand-100 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Ver Deal
                  </button>
                ) : (
                  <button
                    onClick={() => setNewDealOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 text-white text-xs font-medium rounded-lg hover:bg-brand-600 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Criar Deal
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {loadingMsgs && (
                <div className="text-center text-gray-400 text-sm py-4">Carregando...</div>
              )}
              {messages.map(msg => {
                const isOut = msg.direction === 'outbound'
                const mt = msg.media_type
                const hasMedia = !!mt
                // Cache local: mídia enviada pelo CRM (sent_by preenchido, sem metadata no banco)
                const cachedBase64 = mediaCacheRef.current.get(msg.id)
                // Renderiza mídia se: inbound, outbound Evolution (sent_by null), ou outbound CRM com cache
                const canRenderMedia = hasMedia && (
                  msg.direction === 'inbound' || msg.sent_by === null || !!cachedBase64
                )
                const mediaSrc = cachedBase64 ?? `/api/whatsapp/media?messageId=${msg.id}`
                const isImage = canRenderMedia && mt?.startsWith('image/')
                const isAudio = canRenderMedia && mt?.startsWith('audio/')
                const isVideo = canRenderMedia && mt?.startsWith('video/')
                const isDoc = canRenderMedia && !isImage && !isAudio && !isVideo
                // show text body if no media to render, or if body is a user caption (not auto brackets)
                const showBody = !canRenderMedia || (msg.body && !msg.body.startsWith('['))

                return (
                  <div key={msg.id} className={cn('flex', isOut ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-xs xl:max-w-sm rounded-2xl text-sm shadow-sm overflow-hidden',
                        isOut
                          ? 'bg-brand-500 text-white rounded-br-sm'
                          : 'bg-white text-gray-900 rounded-bl-sm'
                      )}
                    >
                      {!isOut && msg.sender_name && (
                        <p className="text-[10px] font-semibold text-brand-500 px-3.5 pt-2 mb-0.5">{msg.sender_name}</p>
                      )}

                      {isImage && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mediaSrc}
                          alt="imagem"
                          className="w-full object-cover"
                          loading="lazy"
                        />
                      )}
                      {isAudio && (
                        <div className="px-3 py-2">
                          <audio controls src={mediaSrc} preload="metadata" className="w-full min-w-[220px]" />
                        </div>
                      )}
                      {isVideo && (
                        <video controls src={mediaSrc} preload="metadata" className="w-full" />
                      )}
                      {isDoc && (
                        <a
                          href={mediaSrc}
                          download={msg.body.replace(/^\[Documento: /, '').replace(/\]$/, '')}
                          className={cn(
                            'flex items-center gap-2 px-3.5 py-2.5 hover:opacity-80 transition-opacity',
                            isOut ? 'text-white' : 'text-brand-600'
                          )}
                        >
                          <FileText className="w-5 h-5 flex-shrink-0" />
                          <span className="text-xs truncate max-w-[180px]">{msg.body}</span>
                        </a>
                      )}

                      {showBody && (
                        <p className="whitespace-pre-wrap break-words px-3.5 py-2">{msg.body}</p>
                      )}

                      <div className={cn('flex items-center justify-end gap-1.5 px-3.5 pb-2 mt-0', isOut ? 'text-white/60' : 'text-gray-400')}>
                        {/* Inbox indicator — mostra só quando a mensagem tem inbox gravado */}
                        {msg.inbox_id && (() => {
                          const msgInbox = inboxes.find(i => i.id === msg.inbox_id)
                          return msgInbox ? (
                            <span className="flex items-center gap-0.5 text-[9px] opacity-70">
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: isOut ? 'currentColor' : msgInbox.color }}
                              />
                              {msgInbox.name}
                            </span>
                          ) : null
                        })()}
                        <span className="text-[10px]">{mounted ? formatMsgTime(msg.created_at) : ''}</span>
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
                <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 break-words flex items-start justify-between gap-2">
                  <span>{sendError}</span>
                  <button onClick={() => setSendError(null)} className="flex-shrink-0 text-red-400 hover:text-red-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Pending file preview */}
              {pendingFile && (
                <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
                  {pendingFile.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pendingFile.preview} alt="preview" className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
                  ) : (
                    <FileText className="w-8 h-8 text-gray-400 flex-shrink-0" />
                  )}
                  <span className="text-xs text-gray-600 truncate flex-1">{pendingFile.name}</span>
                  <button onClick={() => setPendingFile(null)} className="p-1 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={handleFileSelect}
                />

                {recording ? (
                  /* Recording state — full width indicator + stop button */
                  <>
                    <div className="flex-1 flex items-center gap-2 px-4 py-2.5 border border-red-300 bg-red-50 rounded-xl">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                      <span className="text-sm text-red-600 font-medium">
                        {String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:{String(recordSeconds % 60).padStart(2, '0')}
                      </span>
                      <span className="text-xs text-red-400">Gravando...</span>
                    </div>
                    <button
                      onClick={stopRecording}
                      className="p-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors flex-shrink-0"
                      title="Parar gravação"
                    >
                      <Square className="w-4 h-4 fill-white" />
                    </button>
                  </>
                ) : (
                  /* Normal state */
                  <>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!!pendingFile}
                      className="p-2.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-xl transition-colors flex-shrink-0 disabled:opacity-40"
                      title="Anexar arquivo"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <textarea
                      ref={textareaRef}
                      value={text}
                      onChange={e => {
                        setText(e.target.value)
                        e.target.style.height = 'auto'
                        e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
                      }}
                      placeholder={pendingFile ? 'Legenda (opcional)...' : 'Mensagem...'}
                      rows={1}
                      className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 overflow-y-auto"
                      style={{ height: 'auto', maxHeight: '128px' }}
                    />
                    {text.trim() || pendingFile ? (
                      <button
                        onClick={handleSend}
                        disabled={sending}
                        className="p-2.5 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 transition-colors flex-shrink-0"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={startRecording}
                        className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors flex-shrink-0"
                        title="Gravar áudio"
                      >
                        <Mic className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
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

      {/* Deal side panel */}
      {activeDeal && (
        <DealDetailModal
          deal={activeDeal}
          open={dealPanelOpen}
          onClose={() => setDealPanelOpen(false)}
          onUpdated={() => {
            // Rebusca o deal para refletir edições (temperatura, valor, etc.)
            const contactId = activeConv?.crm_contacts?.id
            if (!contactId) return
            supabase
              .from('crm_deals')
              .select('*, crm_contacts(*), crm_services(id, name), crm_service_plans(id, name, table_price, max_discount_pct), assigned_user:crm_users!crm_deals_assigned_to_fkey(id, name, role)')
              .eq('contact_id', contactId)
              .eq('status', 'open')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
              .then(({ data }) => setActiveDeal(data ? dbDealToDeal(data as Record<string, unknown>) : null))
          }}
          variant="panel"
        />
      )}

      {/* Edit Contact Modal */}
      <EditContactModal
        contact={editContactOpen && activeConv?.crm_contacts ? activeConv.crm_contacts : null}
        onClose={() => setEditContactOpen(false)}
        onSaved={(updated) => {
          setConversations(prev => prev.map(c =>
            c.crm_contacts?.id === updated.id
              ? { ...c, crm_contacts: { ...c.crm_contacts!, name: updated.name } }
              : c
          ))
          setEditContactOpen(false)
        }}
      />
    </div>
  )
}
