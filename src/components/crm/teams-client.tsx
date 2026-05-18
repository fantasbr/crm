'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Users, Plus, Pencil, Trash2, Check, X, UserPlus } from 'lucide-react'
import type { Database } from '@/lib/supabase/types'

type User = Database['public']['Tables']['crm_users']['Row']
type Pipeline = { id: string; name: string }

type Team = {
  id: string
  name: string
  crm_team_members: { user_id: string; crm_users: { id: string; name: string; role: string } | null }[]
  crm_team_pipelines: { pipeline_id: string; crm_pipelines: { id: string; name: string } | null }[]
}

interface TeamsClientProps {
  teams: Team[]
  allUsers: User[]
  allPipelines: Pipeline[]
}

export function TeamsClient({ teams: initial, allUsers, allPipelines }: TeamsClientProps) {
  const router = useRouter()
  const [teams, setTeams] = useState(initial)
  const [addingTeam, setAddingTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [editingTeam, setEditingTeam] = useState<string | null>(null)
  const [editTeamName, setEditTeamName] = useState('')
  const [managingTeam, setManagingTeam] = useState<string | null>(null)
  const supabase = createClient()

  const createTeam = async () => {
    if (!newTeamName.trim()) return
    const { data } = await supabase.from('crm_teams').insert({ name: newTeamName.trim() }).select().single()
    if (data) {
      setTeams(prev => [...prev, { ...data, crm_team_members: [], crm_team_pipelines: [] }])
      setNewTeamName('')
      setAddingTeam(false)
    }
  }

  const saveTeamName = async (id: string) => {
    if (!editTeamName.trim()) return
    await supabase.from('crm_teams').update({ name: editTeamName.trim() }).eq('id', id)
    setTeams(prev => prev.map(t => t.id === id ? { ...t, name: editTeamName.trim() } : t))
    setEditingTeam(null)
  }

  const deleteTeam = async (id: string) => {
    if (!confirm('Excluir esta equipe?')) return
    await supabase.from('crm_teams').delete().eq('id', id)
    setTeams(prev => prev.filter(t => t.id !== id))
  }

  const toggleMember = async (teamId: string, userId: string, isMember: boolean) => {
    if (isMember) {
      await supabase.from('crm_team_members').delete().eq('team_id', teamId).eq('user_id', userId)
    } else {
      await supabase.from('crm_team_members').insert({ team_id: teamId, user_id: userId })
    }
    // Atualiza local
    const user = allUsers.find(u => u.id === userId)
    setTeams(prev => prev.map(t => {
      if (t.id !== teamId) return t
      if (isMember) {
        return { ...t, crm_team_members: t.crm_team_members.filter(m => m.user_id !== userId) }
      } else {
        return { ...t, crm_team_members: [...t.crm_team_members, { user_id: userId, crm_users: user ? { id: user.id, name: user.name, role: user.role } : null }] }
      }
    }))
  }

  const togglePipeline = async (teamId: string, pipelineId: string, hasAccess: boolean) => {
    if (hasAccess) {
      await supabase.from('crm_team_pipelines').delete().eq('team_id', teamId).eq('pipeline_id', pipelineId)
    } else {
      await supabase.from('crm_team_pipelines').insert({ team_id: teamId, pipeline_id: pipelineId })
    }
    const pipeline = allPipelines.find(p => p.id === pipelineId)
    setTeams(prev => prev.map(t => {
      if (t.id !== teamId) return t
      if (hasAccess) {
        return { ...t, crm_team_pipelines: t.crm_team_pipelines.filter(p => p.pipeline_id !== pipelineId) }
      } else {
        return { ...t, crm_team_pipelines: [...t.crm_team_pipelines, { pipeline_id: pipelineId, crm_pipelines: pipeline ?? null }] }
      }
    }))
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gerencie equipes e acesso a pipelines</p>
        </div>
        {!addingTeam && (
          <button onClick={() => setAddingTeam(true)}
            className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
            <Plus className="w-4 h-4" /> Nova Equipe
          </button>
        )}
      </div>

      {addingTeam && (
        <div className="bg-white rounded-xl border border-brand-200 p-4 flex gap-2 mb-5">
          <input autoFocus value={newTeamName} onChange={e => setNewTeamName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createTeam(); if (e.key === 'Escape') setAddingTeam(false) }}
            placeholder="Nome da equipe..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <button onClick={createTeam} className="px-3 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium">Criar</button>
          <button onClick={() => { setAddingTeam(false); setNewTeamName('') }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        {teams.map(team => {
          const members = team.crm_team_members.map(m => m.crm_users).filter(Boolean)
          const pipelines = team.crm_team_pipelines.map(p => p.crm_pipelines).filter(Boolean)
          const isManaging = managingTeam === team.id

          return (
            <div key={team.id} className="bg-white rounded-xl border border-gray-200 p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-brand-500" />
                  </div>
                  {editingTeam === team.id ? (
                    <div className="flex items-center gap-2">
                      <input autoFocus value={editTeamName} onChange={e => setEditTeamName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveTeamName(team.id); if (e.key === 'Escape') setEditingTeam(null) }}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      <button onClick={() => saveTeamName(team.id)} className="p-1 text-green-600"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingTeam(null)} className="p-1 text-gray-400"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-semibold text-gray-900">{team.name}</h3>
                      <p className="text-xs text-gray-500">{members.length} membro{members.length !== 1 ? 's' : ''}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setManagingTeam(isManaging ? null : team.id)}
                    className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors" title="Gerenciar">
                    <UserPlus className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setEditingTeam(team.id); setEditTeamName(team.name) }}
                    className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteTeam(team.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Manage mode */}
              {isManaging ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Membros</p>
                    <div className="space-y-1">
                      {allUsers.map(user => {
                        const isMember = team.crm_team_members.some(m => m.user_id === user.id)
                        return (
                          <label key={user.id} className="flex items-center gap-2.5 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                            <input type="checkbox" checked={isMember}
                              onChange={() => toggleMember(team.id, user.id, isMember)}
                              className="accent-brand-500 w-4 h-4" />
                            <div className="w-6 h-6 bg-brand-100 rounded-full flex items-center justify-center">
                              <span className="text-[10px] font-semibold text-brand-600">{user.name.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{user.name}</p>
                              <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Acesso a Pipelines</p>
                    <div className="space-y-1">
                      {allPipelines.map(pipeline => {
                        const hasAccess = team.crm_team_pipelines.some(p => p.pipeline_id === pipeline.id)
                        return (
                          <label key={pipeline.id} className="flex items-center gap-2.5 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                            <input type="checkbox" checked={hasAccess}
                              onChange={() => togglePipeline(team.id, pipeline.id, hasAccess)}
                              className="accent-brand-500 w-4 h-4" />
                            <span className="text-sm text-gray-700">{pipeline.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* View mode */}
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Membros</p>
                    {members.length === 0 ? (
                      <p className="text-xs text-gray-400">Nenhum membro</p>
                    ) : (
                      <div className="space-y-2">
                        {members.map(m => m && (
                          <div key={m.id} className="flex items-center gap-2.5">
                            <div className="w-7 h-7 bg-brand-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-semibold text-brand-600">{m.name.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{m.name}</p>
                              <p className="text-xs text-gray-500 capitalize">{m.role}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pipelines com acesso</p>
                    <div className="flex flex-wrap gap-1.5">
                      {pipelines.length === 0
                        ? <span className="text-xs text-gray-400">Nenhum pipeline atribuído</span>
                        : pipelines.map(p => p && (
                          <span key={p.id} className="text-xs bg-brand-50 text-brand-600 px-2.5 py-1 rounded-full font-medium">
                            {p.name}
                          </span>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {teams.length === 0 && !addingTeam && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-400 text-sm">Nenhuma equipe criada</p>
        </div>
      )}
    </div>
  )
}
