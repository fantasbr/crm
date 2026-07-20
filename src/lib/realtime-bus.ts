import { EventEmitter } from 'node:events'

export type InboxEvent =
  | { type: 'message'; inboxId: string; conversationId: string }
  | { type: 'presence'; inboxId: string; conversationId: string; presence: 'composing' | 'recording' | 'paused' | 'available' | 'unavailable' }

// Bus em memória — vive enquanto o processo Node viver. Webhook/send emitem,
// a rota SSE escuta. Funciona com replicas:1 (config atual). Para múltiplas
// réplicas, trocar por um pub/sub externo (Redis, Postgres LISTEN/NOTIFY).
const globalForBus = globalThis as unknown as { __inboxBus?: EventEmitter }

export const inboxBus: EventEmitter = globalForBus.__inboxBus ?? new EventEmitter()
inboxBus.setMaxListeners(0)
globalForBus.__inboxBus = inboxBus

export function emitInboxEvent(ev: InboxEvent) {
  inboxBus.emit('event', ev)
}
