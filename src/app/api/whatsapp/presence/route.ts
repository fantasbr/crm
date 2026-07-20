import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendPresence } from '@/lib/evolution'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { conversationId, presence } = await req.json() as {
    conversationId?: string
    presence?: 'composing' | 'recording' | 'paused'
  }
  if (!conversationId || !presence) {
    return NextResponse.json({ error: 'conversationId e presence são obrigatórios' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: conv } = await supabase
    .from('crm_conversations')
    .select('crm_inboxes(wa_instance)')
    .eq('id', conversationId)
    .maybeSingle()

  // A Evolution API define presença por instance inteiro, não por conversa
  // (sem campo de destinatário no endpoint) — ver comentário em sendPresence.
  const waInstance = (conv?.crm_inboxes as { wa_instance: string } | null)?.wa_instance
  if (!waInstance) return NextResponse.json({ ok: true }) // best-effort, não falha a UI

  await sendPresence(waInstance, presence)

  return NextResponse.json({ ok: true })
}
