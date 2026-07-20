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
