import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'node:stream'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getMinioClient, parseMinioObject } from '@/lib/minio'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const messageId = req.nextUrl.searchParams.get('messageId')
  if (!messageId) return new Response('messageId required', { status: 400 })

  // Auth client first: RLS verifica se o usuário tem acesso à mensagem
  const { data: msgAuth } = await supabaseAuth
    .from('crm_messages')
    .select('id, metadata, media_type, media_url, conversation_id')
    .eq('id', messageId)
    .single()

  if (!msgAuth) return new Response('Not found', { status: 404 })

  // Caminho rápido: mídia no MinIO. Com credenciais, busca o objeto autenticado
  // pelo bucket+key (permanentes) — imune à expiração da URL pré-assinada, que
  // no S3/SigV4 dura no máx. 7 dias. Sem credenciais, cai no comportamento
  // legado de dar fetch na própria URL assinada (funciona enquanto fresca).
  if (msgAuth.media_url) {
    const minio = getMinioClient()
    const parsed = parseMinioObject(msgAuth.media_url)

    if (minio && parsed) {
      try {
        const stat = await minio.statObject(parsed.bucket, parsed.objectName)
        const stream = await minio.getObject(parsed.bucket, parsed.objectName)
        const mimetype = msgAuth.media_type
          ?? (stat.metaData?.['content-type'] as string | undefined)
          ?? 'application/octet-stream'
        return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
          headers: {
            'Content-Type': mimetype,
            'Cache-Control': 'private, max-age=86400',
            'Content-Length': String(stat.size),
          },
        })
      } catch (err) {
        const code = (err as { code?: string }).code
        // NoSuchKey/NotFound = objeto realmente sumiu do bucket → tenta Evolution.
        // Outros erros (rede/credencial) também caem no fallback, mas logados diferente.
        if (code === 'NoSuchKey' || code === 'NotFound') {
          console.warn('[media] objeto não existe mais no MinIO, tentando Evolution fallback:', parsed.objectName)
        } else {
          console.warn('[media] erro ao buscar do MinIO, tentando fallback:', err)
        }
      }
    } else {
      // MinIO não configurado ou URL fora do padrão path-style — usa a URL assinada
      let minioRes: Response | null = null
      try {
        minioRes = await fetch(msgAuth.media_url)
      } catch (err) {
        console.warn('[media] falha ao buscar do MinIO, tentando fallback:', err)
      }
      if (minioRes?.ok) {
        const mimetype = msgAuth.media_type ?? minioRes.headers.get('Content-Type') ?? 'application/octet-stream'
        return new Response(minioRes.body, {
          headers: {
            'Content-Type': mimetype,
            'Cache-Control': 'private, max-age=86400',
            'Content-Length': minioRes.headers.get('Content-Length') ?? '',
          },
        })
      }
      if (minioRes) {
        console.warn('[media] MinIO retornou', minioRes.status, '— tentando Evolution API fallback')
      }
    }
  }

  // Fallback: sem URL no banco — busca base64 via Evolution API (mensagens antigas)
  if (!msgAuth.metadata) return new Response('Sem metadados de mídia', { status: 404 })

  // Service client apenas para buscar o wa_instance (não exposto via RLS diretamente)
  const supabase = createServiceClient()

  const { data: conv } = await supabase
    .from('crm_conversations')
    .select('crm_inboxes(wa_instance)')
    .eq('id', msgAuth.conversation_id)
    .single()

  const waInstance = (conv?.crm_inboxes as { wa_instance: string } | null)?.wa_instance
  if (!waInstance) return new Response('Inbox not found', { status: 404 })

  const evolutionUrl = process.env.EVOLUTION_API_URL
  const evolutionKey = process.env.EVOLUTION_API_KEY
  if (!evolutionUrl || !evolutionKey) return new Response('Evolution API not configured', { status: 500 })

  const endpoint = `${evolutionUrl}/chat/getBase64FromMediaMessage/${waInstance}`
  let fetchRes: Response
  try {
    fetchRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
      body: JSON.stringify({ message: msgAuth.metadata, convertToMp4: false }),
    })
  } catch (err) {
    console.error('[media] falha ao buscar mídia:', err)
    return new Response('Erro ao buscar mídia', { status: 502 })
  }

  if (!fetchRes.ok) {
    const detail = await fetchRes.text()
    console.error('[media] Evolution API retornou', fetchRes.status, detail)
    return NextResponse.json({ error: `Evolution API ${fetchRes.status}`, detail }, { status: 502 })
  }

  const result = await fetchRes.json() as { base64?: string; mimetype?: string }
  if (!result.base64) return new Response('Sem dados de mídia', { status: 404 })

  const buffer = Buffer.from(result.base64, 'base64')
  const mimetype = result.mimetype ?? msgAuth.media_type ?? 'application/octet-stream'

  return new Response(buffer, {
    headers: {
      'Content-Type': mimetype,
      'Cache-Control': 'private, max-age=3600',
      'Content-Length': String(buffer.length),
    },
  })
}
