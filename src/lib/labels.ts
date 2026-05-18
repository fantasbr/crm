import type { PaymentMethod, ContactOrigin, DealTemperature } from '@/types/crm'

export const paymentLabels: Record<PaymentMethod, string> = {
  pix: 'PIX',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  boleto: 'Boleto',
  dinheiro: 'Dinheiro',
}

export const originLabels: Record<ContactOrigin, string> = {
  whatsapp: 'WhatsApp',
  presencial: 'Presencial',
  indicacao: 'Indicação',
  site: 'Site',
}

export const temperatureLabels: Record<DealTemperature, string> = {
  frio: 'Frio',
  morno: 'Morno',
  quente: 'Quente',
  fechando: 'Fechando',
}

export const temperatureColors: Record<DealTemperature, string> = {
  frio: 'bg-blue-100 text-blue-700',
  morno: 'bg-yellow-100 text-yellow-700',
  quente: 'bg-orange-100 text-orange-700',
  fechando: 'bg-green-100 text-green-700',
}

export const temperatureEmoji: Record<DealTemperature, string> = {
  frio: '🧊',
  morno: '☀️',
  quente: '🔥',
  fechando: '✅',
}

export const originColors: Record<ContactOrigin, string> = {
  whatsapp: 'bg-green-100 text-green-700',
  presencial: 'bg-purple-100 text-purple-700',
  indicacao: 'bg-blue-100 text-blue-700',
  site: 'bg-gray-100 text-gray-700',
}
