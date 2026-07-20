import { createClient } from '@/lib/supabase/server'
import { TrendingUp, DollarSign, Users, Target, MessageCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [dealsRes, contactsRes, openConvsRes, resolvedConvsRes] = await Promise.all([
    supabase.from('crm_deals').select('status, temperature, negotiated_value, assigned_to, stage_id, crm_users!crm_deals_assigned_to_fkey(name)'),
    supabase.from('crm_contacts').select('id', { count: 'exact', head: true }),
    supabase.from('crm_conversations').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('crm_conversations').select('id', { count: 'exact', head: true }).eq('status', 'resolved'),
  ])

  const deals = dealsRes.data ?? []
  const totalContacts = contactsRes.count ?? 0
  const openConversations = openConvsRes.count ?? 0
  const resolvedConversations = resolvedConvsRes.count ?? 0

  const openDeals = deals.filter(d => d.status === 'open')
  const wonDeals = deals.filter(d => d.status === 'won')
  const totalValue = openDeals.reduce((s, d) => s + (d.negotiated_value ?? 0), 0)
  const wonValue = wonDeals.reduce((s, d) => s + (d.negotiated_value ?? 0), 0)

  const byTemp = {
    frio: openDeals.filter(d => d.temperature === 'frio').length,
    morno: openDeals.filter(d => d.temperature === 'morno').length,
    quente: openDeals.filter(d => d.temperature === 'quente').length,
    fechando: openDeals.filter(d => d.temperature === 'fechando').length,
  }

  // Ranking de vendedores
  const sellerMap: Record<string, { name: string; deals: number; value: number }> = {}
  for (const d of openDeals) {
    const seller = d.crm_users as unknown as { name: string } | null
    if (!seller) continue
    const key = seller.name
    if (!sellerMap[key]) sellerMap[key] = { name: seller.name, deals: 0, value: 0 }
    sellerMap[key].deals++
    sellerMap[key].value += d.negotiated_value ?? 0
  }
  const sellers = Object.values(sellerMap).sort((a, b) => b.value - a.value)

  return (
    <div className="p-5 xl:p-8">
      <div className="mb-6 xl:mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Visão geral do comercial</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 xl:gap-5 mb-6 xl:mb-8">
        {[
          { label: 'Deals Ativos', value: openDeals.length, sub: `${wonDeals.length} ganhos`, icon: Target, bg: 'bg-brand-50', color: 'text-brand-500' },
          { label: 'Em Negociação', value: totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), sub: 'Potencial em aberto', icon: DollarSign, bg: 'bg-amber-50', color: 'text-amber-600' },
          { label: 'Valor Ganho', value: wonValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), sub: 'Matrículas realizadas', icon: TrendingUp, bg: 'bg-green-50', color: 'text-green-600' },
          { label: 'Total de Contatos', value: totalContacts, sub: 'Cadastrados no CRM', icon: Users, bg: 'bg-purple-50', color: 'text-purple-600' },
        ].map(({ label, value, sub, icon: Icon, bg, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{label}</span>
              <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{sub}</p>
          </div>
        ))}

        {/* Conversas do Inbox — um card só, com as duas contagens lado a lado */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Conversas</span>
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div className="flex items-end gap-4">
            <div>
              <p className="text-2xl font-bold text-gray-900">{openConversations}</p>
              <p className="text-xs text-gray-500 mt-1">Abertas</p>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{resolvedConversations}</p>
              <p className="text-xs text-gray-500 mt-1">Concluídas</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 xl:gap-5">
        {/* Temperatura */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Temperatura dos Leads</h2>
          <div className="space-y-3">
            {([
              { label: '🧊 Frio', key: 'frio', color: 'bg-blue-500' },
              { label: '☀️ Morno', key: 'morno', color: 'bg-yellow-400' },
              { label: '🔥 Quente', key: 'quente', color: 'bg-orange-500' },
              { label: '✅ Fechando', key: 'fechando', color: 'bg-green-500' },
            ] as const).map(({ label, key, color }) => {
              const count = byTemp[key]
              const pct = openDeals.length > 0 ? (count / openDeals.length) * 100 : 0
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{label}</span>
                    <span className="font-medium text-gray-900">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Ranking vendedores */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Ranking de Vendedores</h2>
          {sellers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhum deal atribuído</p>
          ) : (
            <div className="space-y-3">
              {sellers.slice(0, 5).map((s, i) => (
                <div key={s.name} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-400 w-5">#{i + 1}</span>
                  <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-brand-600">{s.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                    <p className="text-xs text-gray-500">{s.deals} deal{s.deals !== 1 ? 's' : ''}</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {s.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
