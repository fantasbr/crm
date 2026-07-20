'use client'

import { useState, useEffect } from 'react'
import { X, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { originLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { ContactOrigin } from '@/types/crm'

interface ContactData {
  id: string
  name: string
  email: string | null
  origin: string
  wa_push_name?: string | null
  avatar_url?: string | null
}

interface EditContactModalProps {
  contact: ContactData | null
  onClose: () => void
  onSaved: (updated: ContactData) => void
}

export function EditContactModal({ contact, onClose, onSaved }: EditContactModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [origin, setOrigin] = useState<ContactOrigin>('whatsapp')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(null)
  const [syncingAvatar, setSyncingAvatar] = useState(false)

  useEffect(() => {
    if (contact) {
      setName(contact.name)
      setEmail(contact.email ?? '')
      setOrigin(contact.origin as ContactOrigin)
      setAvatarUrl(contact.avatar_url)
      setError('')
    }
  }, [contact])

  const handleSyncAvatar = async () => {
    if (!contact || syncingAvatar) return
    setSyncingAvatar(true)
    try {
      const res = await fetch('/api/whatsapp/contacts/sync-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: contact.id }),
      })
      const data = await res.json() as { avatarUrl?: string | null; error?: string }
      if (res.ok) {
        setAvatarUrl(data.avatarUrl ?? null)
        onSaved({ ...contact, avatar_url: data.avatarUrl ?? null })
      } else {
        setError(data.error ?? 'Não foi possível atualizar a foto')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setSyncingAvatar(false)
    }
  }

  const handleSave = async () => {
    if (!contact || !name.trim()) return
    setSaving(true)
    setError('')
    const supabase = createClient()
    const updated = {
      name: name.trim(),
      email: email.trim() || null,
      origin,
    }
    const { error: err } = await supabase
      .from('crm_contacts')
      .update(updated)
      .eq('id', contact.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved({ ...contact, ...updated })
    onClose()
  }

  if (!contact) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Editar Contato</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Foto de perfil (sincronizada do WhatsApp) */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg font-bold text-brand-600">{name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleSyncAvatar}
            disabled={syncingAvatar}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', syncingAvatar && 'animate-spin')} />
            {syncingAvatar ? 'Sincronizando...' : 'Atualizar foto do WhatsApp'}
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {contact.wa_push_name && contact.wa_push_name !== contact.name && (
              <p className="text-xs text-gray-400 mt-1">Nome WhatsApp: {contact.wa_push_name}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
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
                  onClick={() => setOrigin(o)}
                  className={cn(
                    'py-2 px-3 rounded-lg text-sm font-medium border transition-colors',
                    origin === o
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
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
