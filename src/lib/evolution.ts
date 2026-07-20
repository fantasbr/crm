// Helpers compartilhados para chamadas à Evolution API que não fazem parte
// do fluxo de envio/recebimento de mensagens (esses ficam em cada route).

/**
 * Busca a URL da foto de perfil de um número no WhatsApp, usando a instância
 * (inbox) informada para fazer a consulta. Retorna null se não configurado,
 * se a chamada falhar, ou se o contato não tiver foto (perfil privado, etc).
 */
export async function fetchWhatsAppAvatarUrl(waInstance: string, waPhone: string): Promise<string | null> {
  const evolutionUrl = process.env.EVOLUTION_API_URL
  const evolutionKey = process.env.EVOLUTION_API_KEY
  if (!evolutionUrl || !evolutionKey) return null

  try {
    const res = await fetch(`${evolutionUrl}/chat/fetchProfilePictureUrl/${waInstance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
      body: JSON.stringify({ number: waPhone }),
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => null) as { profilePictureUrl?: string } | null
    return data?.profilePictureUrl ?? null
  } catch (err) {
    console.warn('[evolution] falha ao buscar foto de perfil:', waPhone, err)
    return null
  }
}

/**
 * Marca mensagens como lidas do lado do WhatsApp (o contato vê "✓✓" azul).
 * Best-effort: nunca lança, só loga em caso de falha — não deve travar o
 * fluxo de "abrir conversa" no CRM se a Evolution estiver indisponível.
 */
export async function markMessagesAsRead(
  waInstance: string,
  reads: { remoteJid: string; id: string; fromMe: boolean }[]
): Promise<boolean> {
  if (reads.length === 0) return true
  const evolutionUrl = process.env.EVOLUTION_API_URL
  const evolutionKey = process.env.EVOLUTION_API_KEY
  if (!evolutionUrl || !evolutionKey) return false

  try {
    const res = await fetch(`${evolutionUrl}/chat/markMessageAsRead/${waInstance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
      body: JSON.stringify({ readMessages: reads }),
    })
    if (!res.ok) {
      console.warn('[evolution] markMessageAsRead retornou erro:', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.warn('[evolution] falha ao marcar mensagens como lidas:', err)
    return false
  }
}

/**
 * Envia presença (digitando/gravando/pausado) pro WhatsApp do contato.
 * Best-effort: nunca lança — presença é cosmético, uma falha aqui não pode
 * impedir o agente de digitar/enviar mensagem normalmente.
 */
export async function sendPresence(
  waInstance: string,
  number: string,
  presence: 'composing' | 'recording' | 'paused' | 'available' | 'unavailable',
  delay?: number
): Promise<boolean> {
  const evolutionUrl = process.env.EVOLUTION_API_URL
  const evolutionKey = process.env.EVOLUTION_API_KEY
  if (!evolutionUrl || !evolutionKey) return false

  try {
    const res = await fetch(`${evolutionUrl}/chat/sendPresence/${waInstance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
      body: JSON.stringify({ number, presence, ...(delay ? { delay } : {}) }),
    })
    if (!res.ok) {
      console.warn('[evolution] sendPresence retornou erro:', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.warn('[evolution] falha ao enviar presença:', err)
    return false
  }
}
