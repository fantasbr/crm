export type ContactOrigin = 'whatsapp' | 'presencial' | 'indicacao' | 'site'

export type DealTemperature = 'frio' | 'morno' | 'quente' | 'fechando'

export type DealStatus = 'open' | 'won' | 'lost'

export type PaymentMethod = 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'dinheiro'

export interface Service {
  id: string
  name: string
  active: boolean
  order: number
}

export interface ServicePlan {
  id: string
  serviceId: string
  name: string
  description?: string
  tablePrice: number | null
  maxDiscountPct: number
  active: boolean
  order: number
}

export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  role: 'admin' | 'manager' | 'seller'
}

export interface Team {
  id: string
  name: string
  members: User[]
  pipelineIds: string[]
  createdAt: string
}

export interface Pipeline {
  id: string
  name: string
  stages: Stage[]
  createdAt: string
}

export type StageType = 'initial' | 'won' | 'lost' | 'normal'

export interface Stage {
  id: string
  pipelineId: string
  name: string
  color: string
  order: number
  type: StageType
}

export interface Contact {
  id: string
  name: string
  phone: string
  email?: string
  origin: ContactOrigin
  chatwootId?: string
  waPushName?: string | null
  avatarUrl?: string | null
  createdAt: string
}

export interface Deal {
  id: string
  contactId: string
  contact: Contact
  pipelineId: string
  stageId: string
  assignedTo: User
  serviceId: string | null
  service: Pick<Service, 'id' | 'name'> | null
  chatwootConversationId: string | null
  waConversationId: string | null
  planId: string | null
  plan: Pick<ServicePlan, 'id' | 'name' | 'tablePrice' | 'maxDiscountPct'> | null
  urgency: 1 | 2 | 3 | 4 | 5
  temperature: DealTemperature
  interestPoint?: string
  objection?: string
  previousExperience?: string
  paymentMethod?: PaymentMethod
  negotiatedValue?: number
  status: DealStatus
  createdAt: string
  updatedAt: string
}

export interface Inbox {
  id: string
  name: string
  waInstance: string
  phone: string | null
  color: string
  active: boolean
}

export interface Conversation {
  id: string
  inboxId: string
  contact: Pick<Contact, 'id' | 'name' | 'phone'> | null
  waJid: string
  status: 'open' | 'resolved' | 'archived'
  unreadCount: number
  lastMessage: string | null
  lastMessageAt: string | null
}

export interface Message {
  id: string
  conversationId: string
  waMessageId: string | null
  direction: 'inbound' | 'outbound'
  body: string
  mediaUrl: string | null
  mediaType: string | null
  status: 'sent' | 'delivered' | 'read' | 'failed'
  senderName: string | null
  sentBy: string | null
  createdAt: string
}

export interface BudgetPlan {
  planId: string
  planName: string
  tablePrice: number | null
  customPrice: number | null
}

export interface Budget {
  id: string
  dealId: string
  validDays: number
  notes?: string
  createdBy: string | null
  createdAt: string
  plans: BudgetPlan[]
}
