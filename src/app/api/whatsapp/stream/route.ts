import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { inboxBus, type InboxEvent } from '@/lib/realtime-bus'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const inboxId = req.nextUrl.searchParams.get('inboxId')
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let closed = false

      function cleanup() {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        inboxBus.off('event', listener)
        try { controller.close() } catch { /* já fechado */ }
      }

      const send = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          cleanup()
        }
      }

      const listener = (ev: InboxEvent) => {
        if (inboxId && ev.inboxId !== inboxId) return
        send(`data: ${JSON.stringify(ev)}\n\n`)
      }

      // Heartbeat para o Traefik não fechar a conexão por idle
      const heartbeat = setInterval(() => send(': ping\n\n'), 25000)

      inboxBus.on('event', listener)
      req.signal.addEventListener('abort', cleanup)

      send(': connected\n\n')
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',      // Nginx/Traefik: desabilita buffering
      'Content-Encoding': 'identity',  // Impede gzip middleware de bufferizar o stream
    },
  })
}
