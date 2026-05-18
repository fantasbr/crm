'use client'

import { useState, useCallback } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DealCard } from './deal-card'
import { moveDealToStage, addDealActivity, closeDeal } from '@/lib/queries'
import { Plus } from 'lucide-react'
import type { Deal, Stage } from '@/types/crm'

interface Column {
  stage: Stage
  deals: Deal[]
}

interface PipelineBoardProps {
  columns: Column[]
  onNewDeal: (stageId: string) => void
}

function SortableDealCard({ deal }: { deal: Deal }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <DealCard deal={deal} />
    </div>
  )
}

export function PipelineBoard({ columns: initialColumns, onNewDeal }: PipelineBoardProps) {
  const [columns, setColumns] = useState(initialColumns)
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const findStageOfDeal = useCallback((dealId: string) => {
    return columns.find(col => col.deals.some(d => d.id === dealId))?.stage
  }, [columns])

  const handleDragStart = (event: DragStartEvent) => {
    const deal = columns.flatMap(c => c.deals).find(d => d.id === event.active.id)
    setActiveDeal(deal ?? null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDeal(null)

    if (!over) return

    const dealId = active.id as string
    const overId = over.id as string

    const sourceStage = findStageOfDeal(dealId)
    // over pode ser uma stage ou um deal dentro da stage
    const targetStage = columns.find(c => c.stage.id === overId)?.stage
      ?? findStageOfDeal(overId)

    if (!sourceStage || !targetStage || sourceStage.id === targetStage.id) return

    // Atualizar UI otimisticamente
    setColumns(prev => {
      const deal = prev.flatMap(c => c.deals).find(d => d.id === dealId)!
      return prev.map(col => {
        if (col.stage.id === sourceStage.id) {
          return { ...col, deals: col.deals.filter(d => d.id !== dealId) }
        }
        if (col.stage.id === targetStage.id) {
          return { ...col, deals: [{ ...deal, stageId: targetStage.id }, ...col.deals] }
        }
        return col
      })
    })

    // Persistir no banco
    try {
      await moveDealToStage(dealId, targetStage.id)
      await addDealActivity({
        deal_id: dealId,
        type: 'stage_change',
        content: `Movido de "${sourceStage.name}" para "${targetStage.name}"`,
        metadata: { from_stage_id: sourceStage.id, to_stage_id: targetStage.id } as Record<string, string>,
      })
      // Fechar deal automaticamente se a etapa for won ou lost
      if (targetStage.type === 'won') {
        await closeDeal(dealId, 'won')
        await addDealActivity({
          deal_id: dealId,
          type: 'status_change',
          content: `Deal fechado como GANHO na etapa "${targetStage.name}" ✅`,
        })
        // Remover da UI após breve delay (deal fechado some do kanban)
        setTimeout(() => {
          setColumns(prev => prev.map(col => ({
            ...col,
            deals: col.deals.filter(d => d.id !== dealId),
          })))
        }, 1200)
      } else if (targetStage.type === 'lost') {
        await closeDeal(dealId, 'lost')
        await addDealActivity({
          deal_id: dealId,
          type: 'status_change',
          content: `Deal fechado como PERDIDO na etapa "${targetStage.name}" ❌`,
        })
        setTimeout(() => {
          setColumns(prev => prev.map(col => ({
            ...col,
            deals: col.deals.filter(d => d.id !== dealId),
          })))
        }, 1200)
      }
    } catch (err) {
      console.error('Erro ao mover deal:', err)
      setColumns(initialColumns)
    }
  }

  const stageTotal = (deals: Deal[]) =>
    deals.reduce((sum, d) => sum + (d.negotiatedValue ?? 0), 0)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 h-full" style={{ minWidth: `${columns.length * 280}px` }}>
        {columns.map(({ stage, deals }) => {
          const total = stageTotal(deals)
          return (
            <div key={stage.id} className="flex flex-col w-[270px] flex-shrink-0" id={stage.id}>
              {/* Header */}
              <div className={`flex items-center justify-between mb-3 px-3 py-2 rounded-lg ${
                stage.type === 'won'  ? 'bg-green-50 border border-green-200' :
                stage.type === 'lost' ? 'bg-red-50 border border-red-200' :
                stage.type === 'initial' ? 'bg-blue-50 border border-blue-200' :
                'bg-transparent'
              }`}>
                <div className="flex items-center gap-2">
                  {stage.type === 'won'     && <span className="text-sm">✅</span>}
                  {stage.type === 'lost'    && <span className="text-sm">❌</span>}
                  {stage.type === 'initial' && <span className="text-sm">🚀</span>}
                  {stage.type === 'normal'  && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />}
                  <h3 className={`text-sm font-semibold ${
                    stage.type === 'won' ? 'text-green-800' :
                    stage.type === 'lost' ? 'text-red-800' :
                    stage.type === 'initial' ? 'text-blue-800' :
                    'text-gray-700'
                  }`}>{stage.name}</h3>
                  <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 font-medium">
                    {deals.length}
                  </span>
                </div>
                {total > 0 && (
                  <span className="text-xs font-semibold text-gray-500">
                    {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                )}
              </div>

              {/* Drop zone */}
              <SortableContext
                id={stage.id}
                items={deals.map(d => d.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex-1 space-y-2.5 overflow-y-auto pr-1 min-h-[80px]">
                  {deals.map(deal => (
                    <SortableDealCard key={deal.id} deal={deal} />
                  ))}
                  {deals.length === 0 && (
                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                      <p className="text-xs text-gray-400">Arraste um deal aqui</p>
                    </div>
                  )}
                </div>
              </SortableContext>

              <button
                onClick={() => onNewDeal(stage.id)}
                className="mt-2 w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar deal
              </button>
            </div>
          )
        })}
      </div>

      <DragOverlay>
        {activeDeal && <DealCard deal={activeDeal} />}
      </DragOverlay>
    </DndContext>
  )
}
