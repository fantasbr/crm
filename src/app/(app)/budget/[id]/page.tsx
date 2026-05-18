import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PrintButton } from './print-button'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function BudgetPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: budget, error } = await supabase
    .from('crm_budgets')
    .select(`
      *,
      crm_deals(
        id, negotiated_value,
        crm_contacts(id, name, phone),
        crm_services(name),
        assigned_user:crm_users!crm_deals_assigned_to_fkey(id, name)
      ),
      crm_budget_plans(
        plan_id, custom_price,
        crm_service_plans(id, name, table_price, description)
      )
    `)
    .eq('id', id)
    .single()

  if (error || !budget) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deal = budget.crm_deals as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contact = deal?.crm_contacts as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vendor = deal?.assigned_user as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const budgetPlans = (budget.crm_budget_plans ?? []) as any[]

  const expiresAt = new Date(budget.created_at)
  expiresAt.setDate(expiresAt.getDate() + budget.valid_days)

  const fmt = (v: number | null | undefined) =>
    v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

  const today = new Date(budget.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <>
      <style>{`
        @media print {
          aside, nav, .no-print { display: none !important; }
          body { background: white !important; margin: 0; }
          .print-page { padding: 0 !important; background: white !important; }
          .print-doc { box-shadow: none !important; border: 0 !important; border-radius: 0 !important; max-width: 100% !important; }
        }
      `}</style>

      <div className="print-page min-h-screen bg-gray-100 py-8 px-4">
        {/* Toolbar — hidden in print */}
        <div className="no-print max-w-2xl mx-auto mb-5 flex items-center gap-2">
          <PrintButton />
          <button
            onClick={() => { if (typeof window !== 'undefined') window.close() }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 bg-white"
          >
            Fechar
          </button>
          <span className="text-xs text-gray-400 ml-2">
            Orçamento #{id.slice(0, 8).toUpperCase()}
          </span>
        </div>

        {/* Document */}
        <div className="print-doc max-w-2xl mx-auto bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">

          {/* Header */}
          <div className="bg-gray-900 text-white px-8 py-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Proposta Comercial</p>
                <h1 className="text-2xl font-bold tracking-tight">Autoescola</h1>
                <p className="text-sm text-gray-400 mt-0.5">Centro de Formação de Condutores</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-400 font-mono">#{id.slice(0, 8).toUpperCase()}</p>
                <p className="text-xs text-gray-400 mt-2">{today}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Válida até <span className="text-white font-medium">{expiresAt.toLocaleDateString('pt-BR')}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Lead + Vendor */}
          <div className="px-8 py-5 border-b border-gray-100 bg-gray-50">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Para</p>
                <p className="text-lg font-bold text-gray-900">{contact?.name ?? '—'}</p>
                <p className="text-sm text-gray-500">{contact?.phone ?? ''}</p>
              </div>
              {vendor && (
                <div className="text-right">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Vendedor</p>
                  <p className="text-sm font-medium text-gray-900">{vendor.name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Service */}
          <div className="px-8 py-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Serviço</p>
            <p className="text-sm font-semibold text-gray-800">{deal?.crm_services?.name ?? '—'}</p>
          </div>

          {/* Plans */}
          <div className="px-8 py-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Opções de Plano</p>

            <div className="divide-y divide-gray-100">
              {budgetPlans.map((bp, i: number) => {
                const plan = bp.crm_service_plans
                const finalPrice = bp.custom_price ?? plan?.table_price
                const hasDiscount = bp.custom_price != null && plan?.table_price != null && bp.custom_price !== plan.table_price
                return (
                  <div key={i} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                    <div className="min-w-0 pr-4">
                      <p className="text-base font-bold text-gray-900">{plan?.name ?? '—'}</p>
                      {plan?.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{plan.description}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl font-bold text-gray-900">{fmt(finalPrice)}</p>
                      {hasDiscount && (
                        <p className="text-sm text-gray-400 line-through mt-0.5">{fmt(plan?.table_price)}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          {budget.notes && (
            <div className="px-8 pb-6">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5">Observações</p>
                <p className="text-sm text-gray-700 leading-relaxed">{budget.notes}</p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Proposta válida por {budget.valid_days} dia{budget.valid_days !== 1 ? 's' : ''} a partir da emissão
            </p>
            <p className="text-xs text-gray-400">
              {expiresAt.toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
