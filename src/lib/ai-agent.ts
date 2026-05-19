import type { SupabaseClient } from '@supabase/supabase-js'

export interface AIAgentContext {
  conversationId: string
  inboxId: string
  contactId: string | null
  contactName: string
  newMessageBody: string
}

// Stub: implementar quando o agente de IA for ativado
export async function maybeRouteToAI(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _supabase: SupabaseClient,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _ctx: AIAgentContext
): Promise<void> {
  if (process.env.AI_AGENT_ENABLED !== 'true') return
  // TODO: carregar histórico → chamar LLM → reply automático / atualizar deal
}
