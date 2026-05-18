'use client'

import { useState } from 'react'
import Link from 'next/link'
import { originLabels, originColors, temperatureEmoji, temperatureColors } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { Plus, Search, Phone, MessageCircle } from 'lucide-react'
import type { Database } from '@/lib/supabase/types'

type Contact = Database['public']['Tables']['crm_contacts']['Row']
type DealSummary = {
  contact_id: string
  service_id: string
  temperature: string
  negotiated_value: number | null
  status: string
  crm_services: { name: string } | null
}

interface ContactsTableProps {
  contacts: Contact[]
  deals: DealSummary[]
}

export function ContactsTable({ contacts, deals }: ContactsTableProps) {
  const [search, setSearch] = useState('')

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const getDeal = (contactId: string) =>
    deals.find(d => d.contact_id === contactId && d.status === 'open')

  return (
    <div className="p-5 xl:p-8">
      <div className="flex items-center justify-between mb-5 xl:mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contatos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contacts.length} contatos cadastrados</p>
        </div>
        <Link
          href="/contacts/new"
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Contato
        </Link>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, telefone ou e-mail..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contato</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Telefone</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Origem</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Deal Ativo</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Temperatura</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(contact => {
              const deal = getDeal(contact.id)
              return (
                <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-brand-600">{contact.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{contact.name}</p>
                        {contact.email && <p className="text-xs text-gray-500">{contact.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-gray-700">{contact.phone}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', originColors[contact.origin])}>
                      {originLabels[contact.origin]}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {deal ? (
                      <span className="text-sm text-gray-700">
                        {deal.crm_services?.name ?? '—'}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {deal ? (
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', temperatureColors[deal.temperature as keyof typeof temperatureColors])}>
                        {temperatureEmoji[deal.temperature as keyof typeof temperatureEmoji]} {deal.temperature}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {deal?.negotiated_value ? (
                      <span className="text-sm font-semibold text-gray-900">
                        {deal.negotiated_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://wa.me/55${contact.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                      <a
                        href={`tel:${contact.phone}`}
                        className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors"
                        title="Ligar"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm">
              {search ? 'Nenhum contato encontrado para esta busca' : 'Nenhum contato cadastrado'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
