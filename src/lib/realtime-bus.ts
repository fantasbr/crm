import { EventEmitter } from 'node:events'

// Eventos de mensagem/conversa migraram para Supabase Realtime
// (postgres_changes) — este bus carrega só presença (digitando/gravando)
// por enquanto, que fica de fora dessa migração.
export interface InboxEvent {
  inboxId: string
  conversationId: string
  presence: 'composing' | 'recording' | 'paused' | 'available' | 'unavailable'
}

// Bus em memória — vive enquanto o processo Node viver. Webhook emite,
// a rota SSE escuta. Funciona com replicas:1 (config atual). Para múltiplas
// réplicas, trocar por um pub/sub externo (Redis, Postgres LISTEN/NOTIFY,
// ou migrar presença também pro Realtime via Broadcast).
const globalForBus = globalThis as unknown as { __inboxBus?: EventEmitter }

export const inboxBus: EventEmitter = globalForBus.__inboxBus ?? new EventEmitter()
inboxBus.setMaxListeners(0)
globalForBus.__inboxBus = inboxBus

export function emitInboxEvent(ev: InboxEvent) {
  inboxBus.emit('event', ev)
}
