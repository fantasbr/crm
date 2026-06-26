import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

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
