'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { originLabels, originColors, temperatureEmoji, temperatureColors } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { Plus, Search, Phone, MessageCircle, Pencil, X } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import type { ContactOrigin } from '@/types/crm'

type Contact = Database['public']['Tables']['crm_contacts']['Row']
type DealSummary = {
  contact_id: string
  service_id: string | null
  temperature: string
  negotiated_value: number | null
  status: string
  crm_services: { name: string } | null
}

interface ContactsTableProps {
  contacts: Contact[]
  deals: DealSummary[]
}

interface EditState {
  id: string
  name: string
  email: string
  origin: ContactOrigin
}

export function ContactsTable({ contacts, deals }: ContactsTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const openEdit = (contact: Contact) => {
    setSaveError('')
    setEditing({
      id: contact.id,
      name: contact.name,
      email: contact.email ?? '',
      origin: contact.origin as ContactOrigin,
    })
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    setSaveError('')
    const supabase = createClient()
    const { error } = await supabase
      .from('crm_contacts')
      .update({
        name: editing.name.trim(),
        email: editing.email.trim() || null,
        origin: editing.origin,
      })
      .eq('id', editing.id)
    setSaving(false)
    if (error) {
      setSaveError(error.message)
      return
    }
    setEditing(null)
    router.refresh()
  }

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
                      <Link
                        href={`/inbox?phone=${contact.phone.replace(/\D/g, '')}`}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Abrir no Inbox"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Link>
                      <a
                        href={`tel:${contact.phone}`}
                        className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors"
                        title="Ligar"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => openEdit(contact)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Editar contato"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
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

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Editar Contato</h2>
              <button onClick={() => setEditing(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {saveError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome</label>
                <input
                  value={editing.name}
                  onChange={e => setEditing(prev => prev && { ...prev, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
                <input
                  type="email"
                  value={editing.email}
                  onChange={e => setEditing(prev => prev && { ...prev, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Origem</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(originLabels) as ContactOrigin[]).map(o => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setEditing(prev => prev && { ...prev, origin: o })}
                      className={cn(
                        'py-2 px-3 rounded-lg text-sm font-medium border transition-colors',
                        editing.origin === o
                          ? 'bg-brand-500 text-white border-brand-500'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
                      )}
                    >
                      {originLabels[o]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editing.name.trim()}
                className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
