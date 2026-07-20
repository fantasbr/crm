import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { markMessagesAsRead } from '@/lib/evolution'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // Verifica autenticação
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { conversationId } = await req.json() as { conversationId?: string }
  if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })

  // Usa service client para bypassar RLS (o RLS pode não permitir UPDATE de unread_count)
  const supabase = createServiceClient()

  const { data: conv } = await supabase
    .from('crm_conversations')
    .select('id, wa_jid, unread_count, crm_inboxes(wa_instance)')
    .eq('id', conversationId)
    .maybeSingle()

  // Marca como lida de verdade no WhatsApp (best-effort — nunca bloqueia o
  // "zera unread_count local" abaixo, que é o que a UI depende pra sumir o badge)
  if (conv && conv.unread_count > 0) {
    const waInstance = (conv.crm_inboxes as { wa_instance: string } | null)?.wa_instance
    if (waInstance) {
      const { data: unread } = await supabase
        .from('crm_messages')
        .select('id, wa_message_id')
        .eq('conversation_id', conversationId)
        .eq('direction', 'inbound')
        .is('read_at', null)
        .not('wa_message_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(conv.unread_count)

      if (unread && unread.length > 0) {
        const reads = unread.map(m => ({ remoteJid: conv.wa_jid, fromMe: false, id: m.wa_message_id as string }))
        const marked = await markMessagesAsRead(waInstance, reads)
        // Só grava read_at se a Evolution confirmou — se falhou (instância fora
        // do ar, etc), deixa read_at nulo pra próxima abertura da conversa tentar de novo
        if (marked) {
          await supabase
            .from('crm_messages')
            .update({ read_at: new Date().toISOString() })
            .in('id', unread.map(m => m.id))
        }
      }
    }
  }

  const { error } = await supabase
    .from('crm_conversations')
    .update({ unread_count: 0 })
    .eq('id', conversationId)

  if (error) {
    console.error('[conversations/read] falha ao marcar como lida:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
