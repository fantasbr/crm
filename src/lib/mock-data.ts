import type { User, Team, Pipeline, Contact, Deal, Service } from '@/types/crm'

const mockService = (id: string, name: string): Service => ({
  id, name, active: true, order: 0,
})

export const mockUsers: User[] = [
  { id: 'u1', name: 'Carlos Silva', email: 'carlos@autoescola.com', role: 'seller' },
  { id: 'u2', name: 'Ana Paula', email: 'ana@autoescola.com', role: 'seller' },
  { id: 'u3', name: 'Marcos Lima', email: 'marcos@autoescola.com', role: 'manager' },
  { id: 'u4', name: 'Admin', email: 'admin@autoescola.com', role: 'admin' },
]

export const mockPipelines: Pipeline[] = [
  {
    id: 'p1',
    name: 'Vendas CNH',
    createdAt: '2024-01-01',
    stages: [
      { id: 's1', pipelineId: 'p1', name: 'Novo Lead', color: '#6366f1', order: 1, type: 'initial' as const },
      { id: 's2', pipelineId: 'p1', name: 'Qualificado', color: '#f59e0b', order: 2, type: 'normal' as const },
      { id: 's3', pipelineId: 'p1', name: 'Proposta Enviada', color: '#3b82f6', order: 3, type: 'normal' as const },
      { id: 's4', pipelineId: 'p1', name: 'Negociação', color: '#8b5cf6', order: 4, type: 'normal' as const },
      { id: 's5', pipelineId: 'p1', name: 'Matrícula Realizada', color: '#10b981', order: 5, type: 'won' as const },
    ],
  },
  {
    id: 'p2',
    name: 'Reciclagem e Adição',
    createdAt: '2024-01-15',
    stages: [
      { id: 's6', pipelineId: 'p2', name: 'Novo Lead', color: '#6366f1', order: 1, type: 'initial' as const },
      { id: 's7', pipelineId: 'p2', name: 'Contato Feito', color: '#f59e0b', order: 2, type: 'normal' as const },
      { id: 's8', pipelineId: 'p2', name: 'Proposta', color: '#3b82f6', order: 3, type: 'normal' as const },
      { id: 's9', pipelineId: 'p2', name: 'Fechado', color: '#10b981', order: 4, type: 'won' as const },
    ],
  },
]

export const mockContacts: Contact[] = [
  { id: 'c1', name: 'João Pereira', phone: '(62) 99999-1111', email: 'joao@email.com', origin: 'whatsapp', createdAt: '2024-05-01' },
  { id: 'c2', name: 'Fernanda Costa', phone: '(62) 99999-2222', origin: 'presencial', createdAt: '2024-05-03' },
  { id: 'c3', name: 'Ricardo Alves', phone: '(62) 99999-3333', origin: 'indicacao', createdAt: '2024-05-05' },
  { id: 'c4', name: 'Beatriz Souza', phone: '(62) 99999-4444', origin: 'whatsapp', createdAt: '2024-05-06' },
  { id: 'c5', name: 'Thiago Martins', phone: '(62) 99999-5555', origin: 'site', createdAt: '2024-05-08' },
  { id: 'c6', name: 'Larissa Ferreira', phone: '(62) 99999-6666', origin: 'presencial', createdAt: '2024-05-10' },
  { id: 'c7', name: 'Gabriel Nunes', phone: '(62) 99999-7777', origin: 'whatsapp', createdAt: '2024-05-11' },
  { id: 'c8', name: 'Camila Rocha', phone: '(62) 99999-8888', origin: 'indicacao', createdAt: '2024-05-12' },
]

const svcB   = mockService('svc-b',    'CNH Categoria B')
const svcAB  = mockService('svc-ab',   'CNH Categoria AB')
const svcA   = mockService('svc-a',    'CNH Categoria A')
const svcC   = mockService('svc-c',    'CNH Categoria C')
const svcAdd = mockService('svc-add',  'Adição de Categoria')
const svcRec = mockService('svc-rec',  'Reciclagem')

export const mockDeals: Deal[] = [
  {
    id: 'd1', contactId: 'c1', contact: mockContacts[0],
    pipelineId: 'p1', stageId: 's1', assignedTo: mockUsers[0],
    serviceId: svcB.id, service: svcB, planId: null, plan: null,
    urgency: 4, temperature: 'quente',
    interestPoint: 'Precisa para trabalho', objection: 'Preço alto',
    previousExperience: 'Nunca fez CNH', paymentMethod: 'pix',
    negotiatedValue: 2800, status: 'open',
    createdAt: '2024-05-01', updatedAt: '2024-05-10',
  },
  {
    id: 'd2', contactId: 'c2', contact: mockContacts[1],
    pipelineId: 'p1', stageId: 's2', assignedTo: mockUsers[1],
    serviceId: svcAB.id, service: svcAB, planId: null, plan: null,
    urgency: 3, temperature: 'morno',
    interestPoint: 'Quer tirar moto e carro', objection: 'Tempo disponível',
    previousExperience: 'Já tem CNH A', paymentMethod: 'cartao_credito',
    negotiatedValue: 3200, status: 'open',
    createdAt: '2024-05-03', updatedAt: '2024-05-11',
  },
  {
    id: 'd3', contactId: 'c3', contact: mockContacts[2],
    pipelineId: 'p1', stageId: 's3', assignedTo: mockUsers[0],
    serviceId: svcB.id, service: svcB, planId: null, plan: null,
    urgency: 5, temperature: 'fechando',
    interestPoint: 'Indicado por amigo', objection: 'Nenhuma',
    previousExperience: 'Nunca fez CNH', paymentMethod: 'pix',
    negotiatedValue: 2600, status: 'open',
    createdAt: '2024-05-05', updatedAt: '2024-05-13',
  },
  {
    id: 'd4', contactId: 'c4', contact: mockContacts[3],
    pipelineId: 'p1', stageId: 's1', assignedTo: mockUsers[1],
    serviceId: svcA.id, service: svcA, planId: null, plan: null,
    urgency: 2, temperature: 'frio',
    interestPoint: 'Quer mobilidade', objection: 'Medo de moto',
    paymentMethod: 'boleto',
    negotiatedValue: 1800, status: 'open',
    createdAt: '2024-05-06', updatedAt: '2024-05-06',
  },
  {
    id: 'd5', contactId: 'c5', contact: mockContacts[4],
    pipelineId: 'p1', stageId: 's4', assignedTo: mockUsers[2],
    serviceId: svcC.id, service: svcC, planId: null, plan: null,
    urgency: 4, temperature: 'quente',
    interestPoint: 'Necessidade profissional', objection: 'Parcelamento',
    previousExperience: 'Tem CNH B há 10 anos', paymentMethod: 'cartao_credito',
    negotiatedValue: 3800, status: 'open',
    createdAt: '2024-05-08', updatedAt: '2024-05-14',
  },
  {
    id: 'd6', contactId: 'c6', contact: mockContacts[5],
    pipelineId: 'p1', stageId: 's2', assignedTo: mockUsers[0],
    serviceId: svcAdd.id, service: svcAdd, planId: null, plan: null,
    urgency: 3, temperature: 'morno',
    interestPoint: 'Já é cliente da casa', objection: 'Preço',
    previousExperience: 'Fez CNH B aqui', paymentMethod: 'pix',
    negotiatedValue: 1500, status: 'open',
    createdAt: '2024-05-10', updatedAt: '2024-05-12',
  },
  {
    id: 'd7', contactId: 'c7', contact: mockContacts[6],
    pipelineId: 'p1', stageId: 's5', assignedTo: mockUsers[1],
    serviceId: svcB.id, service: svcB, planId: null, plan: null,
    urgency: 5, temperature: 'fechando',
    interestPoint: 'Emprego exige CNH', objection: 'Nenhuma',
    previousExperience: 'Nunca fez CNH', paymentMethod: 'dinheiro',
    negotiatedValue: 2700, status: 'won',
    createdAt: '2024-05-01', updatedAt: '2024-05-15',
  },
  {
    id: 'd8', contactId: 'c8', contact: mockContacts[7],
    pipelineId: 'p1', stageId: 's1', assignedTo: mockUsers[0],
    serviceId: svcRec.id, service: svcRec, planId: null, plan: null,
    urgency: 1, temperature: 'frio',
    interestPoint: 'CNH vencida', objection: 'Distância da escola',
    previousExperience: 'CNH vencida há 2 anos', paymentMethod: 'pix',
    negotiatedValue: 900, status: 'open',
    createdAt: '2024-05-12', updatedAt: '2024-05-12',
  },
]

export const mockTeams: Team[] = [
  {
    id: 't1', name: 'Equipe CNH', pipelineIds: ['p1'],
    members: [mockUsers[0], mockUsers[1]],
    createdAt: '2024-01-01',
  },
  {
    id: 't2', name: 'Equipe Reciclagem', pipelineIds: ['p2'],
    members: [mockUsers[2]],
    createdAt: '2024-01-15',
  },
]
