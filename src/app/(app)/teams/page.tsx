import { redirect } from 'next/navigation'

export default function TeamsPage() {
  redirect('/settings?tab=equipes')
}
