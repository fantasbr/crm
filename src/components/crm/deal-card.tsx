'use client'

import { Deal } from '@/types/crm'
import { temperatureEmoji, temperatureColors } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { DealDetailModal } from './deal-detail-modal'
import { BudgetModal } from './budget-modal'

interface DealCardProps {
  deal: Deal
  onUpdated?: () => void
}

export function DealCard({ deal, onUpdated }: DealCardProps) {
  const [detailOpen, setDetailOpen] = useState(false)
  const [budgetOpen, setBudgetOpen] = useState(false)

  return (
    <>
      <div
        onClick={() => setDetailOpen(true)}
        className="bg-white rounded-lg border border-gray-200 p-3.5 cursor-pointer hover:shadow-md hover:border-brand-200 transition-all"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-brand-600">
                {deal.contact.name.charAt(0)}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate">{deal.contact.name}</p>
          </div>
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0',
            temperatureColors[deal.temperature]
          )}>
            {temperatureEmoji[deal.temperature]} {deal.temperature}
          </span>
        </div>

        {/* Serviço */}
        <div className="mb-2.5">
          <p className="text-xs text-gray-600 flex items-center gap-1.5">
            <span className="text-gray-400">📦</span>
            {deal.service?.name ?? 'Sem serviço'}
          </p>
          {deal.plan && (
            <p className="text-xs text-brand-600 font-medium mt-0.5 ml-5">{deal.plan.name}</p>
          )}
        </div>

        {/* Urgência */}
        <div className="flex items-center gap-1.5 mb-2.5">
          <span className="text-xs text-gray-400">⚡</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(n => (
              <div
                key={n}
                className={cn(
                  'w-4 h-1.5 rounded-full',
                  n <= deal.urgency ? 'bg-brand-500' : 'bg-gray-200'
                )}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500">{deal.urgency}/5</span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-gray-100">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-[10px] font-semibold text-gray-600">
                {deal.assignedTo.name.charAt(0)}
              </span>
            </div>
            <span className="text-xs text-gray-500 truncate max-w-[70px]">{deal.assignedTo.name}</span>
          </div>
          {deal.negotiatedValue && (
            <span className="text-sm font-bold text-gray-900">
              {deal.negotiatedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          )}
        </div>

        {/* Objeção */}
        {deal.objection && deal.objection !== 'Nenhuma' && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <p className="text-xs text-orange-600 flex items-center gap-1">
              <span>⚠️</span>
              <span className="truncate">{deal.objection}</span>
            </p>
          </div>
        )}
      </div>

      <DealDetailModal
        deal={deal}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onUpdated={onUpdated}
        onBudget={() => { setDetailOpen(false); setBudgetOpen(true) }}
      />

      <BudgetModal
        deal={deal}
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
      />
    </>
  )
}
