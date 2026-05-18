-- Migration 005: corrige recursão infinita nas policies de crm_team_members
--
-- Problema: crm_team_members_select consultava crm_team_members dentro de si
-- mesma, causando recursão quando qualquer query em crm_teams ou crm_team_members
-- era executada (especialmente INSERT com RETURNING *).
--
-- Solução: função SECURITY DEFINER que lê crm_team_members sem acionar RLS,
-- usada como base segura nas policies que precisam checar membros do time.

-- 1. Função helper: retorna os team_ids do usuário logado (sem acionar RLS)
CREATE OR REPLACE FUNCTION crm_user_team_ids()
RETURNS SETOF UUID AS $$
  SELECT team_id FROM crm_team_members WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Recria a policy de SELECT em crm_team_members sem auto-referência
DROP POLICY IF EXISTS "crm_team_members_select" ON crm_team_members;

CREATE POLICY "crm_team_members_select" ON crm_team_members
  FOR SELECT TO authenticated USING (
    crm_is_admin()
    OR user_id = auth.uid()
    OR team_id IN (SELECT crm_user_team_ids())
  );
