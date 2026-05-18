-- ============================================================
-- CRM AutoEscola - Migration 001
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ============================================================
-- 1. ENUMS
-- ============================================================

CREATE TYPE crm_contact_origin    AS ENUM ('whatsapp', 'presencial', 'indicacao', 'site');
CREATE TYPE crm_deal_temperature  AS ENUM ('frio', 'morno', 'quente', 'fechando');
CREATE TYPE crm_deal_status       AS ENUM ('open', 'won', 'lost');
CREATE TYPE crm_payment_method    AS ENUM ('pix', 'cartao_credito', 'cartao_debito', 'boleto', 'dinheiro');
CREATE TYPE crm_service_interest  AS ENUM ('cnh_a', 'cnh_b', 'cnh_ab', 'cnh_c', 'cnh_d', 'cnh_e', 'adicao_categoria', 'reciclagem', 'acc');
CREATE TYPE crm_user_role         AS ENUM ('admin', 'manager', 'seller');
CREATE TYPE crm_activity_type     AS ENUM ('note', 'stage_change', 'status_change', 'call', 'whatsapp', 'email');

-- ============================================================
-- 2. TABELAS
-- ============================================================

-- Perfil estendido de usuário (vinculado ao auth.users)
CREATE TABLE crm_users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  role        crm_user_role NOT NULL DEFAULT 'seller',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Equipes
CREATE TABLE crm_teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Membros das equipes (usuário ↔ equipe N:N)
CREATE TABLE crm_team_members (
  team_id  UUID NOT NULL REFERENCES crm_teams(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, user_id)
);

-- Funis de venda
CREATE TABLE crm_pipelines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Acesso equipe ↔ pipeline (N:N)
CREATE TABLE crm_team_pipelines (
  team_id      UUID NOT NULL REFERENCES crm_teams(id) ON DELETE CASCADE,
  pipeline_id  UUID NOT NULL REFERENCES crm_pipelines(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, pipeline_id)
);

-- Etapas dos pipelines
CREATE TABLE crm_stages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id  UUID NOT NULL REFERENCES crm_pipelines(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  color        TEXT NOT NULL DEFAULT '#6366f1',
  "order"      SMALLINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contatos / Leads
CREATE TABLE crm_contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL,
  email        TEXT,
  origin       crm_contact_origin NOT NULL DEFAULT 'presencial',
  chatwoot_id  TEXT UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (phone)
);

-- Negócios (deal = contato em um pipeline)
CREATE TABLE crm_deals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id           UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  pipeline_id          UUID NOT NULL REFERENCES crm_pipelines(id) ON DELETE CASCADE,
  stage_id             UUID NOT NULL REFERENCES crm_stages(id),
  assigned_to          UUID REFERENCES crm_users(id) ON DELETE SET NULL,
  service_interest     crm_service_interest NOT NULL,
  urgency              SMALLINT NOT NULL DEFAULT 3 CHECK (urgency BETWEEN 1 AND 5),
  temperature          crm_deal_temperature NOT NULL DEFAULT 'morno',
  interest_point       TEXT,
  objection            TEXT,
  previous_experience  TEXT,
  payment_method       crm_payment_method,
  negotiated_value     DECIMAL(10, 2),
  status               crm_deal_status NOT NULL DEFAULT 'open',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Histórico de atividades por deal
CREATE TABLE crm_deal_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES crm_users(id) ON DELETE SET NULL,
  type        crm_activity_type NOT NULL,
  content     TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tags livres
CREATE TABLE crm_tags (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name   TEXT NOT NULL UNIQUE,
  color  TEXT NOT NULL DEFAULT '#6366f1'
);

-- Contato ↔ Tag (N:N)
CREATE TABLE crm_contact_tags (
  contact_id  UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  tag_id      UUID NOT NULL REFERENCES crm_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

-- ============================================================
-- 3. ÍNDICES
-- ============================================================

CREATE INDEX idx_crm_deals_pipeline   ON crm_deals(pipeline_id);
CREATE INDEX idx_crm_deals_stage      ON crm_deals(stage_id);
CREATE INDEX idx_crm_deals_contact    ON crm_deals(contact_id);
CREATE INDEX idx_crm_deals_assigned   ON crm_deals(assigned_to);
CREATE INDEX idx_crm_deals_status     ON crm_deals(status);
CREATE INDEX idx_crm_stages_pipeline  ON crm_stages(pipeline_id);
CREATE INDEX idx_crm_activities_deal  ON crm_deal_activities(deal_id);
CREATE INDEX idx_crm_contacts_phone   ON crm_contacts(phone);

-- ============================================================
-- 4. FUNÇÃO updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION crm_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_crm_users_updated_at
  BEFORE UPDATE ON crm_users
  FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();

CREATE TRIGGER trg_crm_teams_updated_at
  BEFORE UPDATE ON crm_teams
  FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();

CREATE TRIGGER trg_crm_pipelines_updated_at
  BEFORE UPDATE ON crm_pipelines
  FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();

CREATE TRIGGER trg_crm_contacts_updated_at
  BEFORE UPDATE ON crm_contacts
  FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();

CREATE TRIGGER trg_crm_deals_updated_at
  BEFORE UPDATE ON crm_deals
  FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();

-- ============================================================
-- 5. FUNÇÃO HELPER - verificar se usuário é admin
-- ============================================================

CREATE OR REPLACE FUNCTION crm_is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM crm_users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 6. FUNÇÃO HELPER - pipelines acessíveis ao usuário
-- ============================================================

CREATE OR REPLACE FUNCTION crm_accessible_pipeline_ids()
RETURNS SETOF UUID AS $$
  SELECT DISTINCT tp.pipeline_id
  FROM crm_team_pipelines tp
  JOIN crm_team_members tm ON tm.team_id = tp.team_id
  WHERE tm.user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE crm_users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_teams            ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_team_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_pipelines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_team_pipelines   ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_stages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deal_activities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tags             ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contact_tags     ENABLE ROW LEVEL SECURITY;

-- crm_users: todo autenticado vê todos (necessário para dropdowns de responsável)
CREATE POLICY "crm_users_select" ON crm_users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "crm_users_update_own" ON crm_users
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- crm_teams: usuário vê equipes que pertence; admin vê tudo
CREATE POLICY "crm_teams_select" ON crm_teams
  FOR SELECT TO authenticated USING (
    crm_is_admin() OR
    EXISTS (SELECT 1 FROM crm_team_members WHERE team_id = id AND user_id = auth.uid())
  );

CREATE POLICY "crm_teams_all_admin" ON crm_teams
  FOR ALL TO authenticated USING (crm_is_admin()) WITH CHECK (crm_is_admin());

-- crm_team_members
CREATE POLICY "crm_team_members_select" ON crm_team_members
  FOR SELECT TO authenticated USING (
    crm_is_admin() OR user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM crm_team_members tm2 WHERE tm2.team_id = team_id AND tm2.user_id = auth.uid())
  );

CREATE POLICY "crm_team_members_all_admin" ON crm_team_members
  FOR ALL TO authenticated USING (crm_is_admin()) WITH CHECK (crm_is_admin());

-- crm_pipelines: usuário vê pipelines das suas equipes; admin vê tudo
CREATE POLICY "crm_pipelines_select" ON crm_pipelines
  FOR SELECT TO authenticated USING (
    crm_is_admin() OR id IN (SELECT crm_accessible_pipeline_ids())
  );

CREATE POLICY "crm_pipelines_all_admin" ON crm_pipelines
  FOR ALL TO authenticated USING (crm_is_admin()) WITH CHECK (crm_is_admin());

-- crm_team_pipelines
CREATE POLICY "crm_team_pipelines_select" ON crm_team_pipelines
  FOR SELECT TO authenticated USING (
    crm_is_admin() OR pipeline_id IN (SELECT crm_accessible_pipeline_ids())
  );

CREATE POLICY "crm_team_pipelines_all_admin" ON crm_team_pipelines
  FOR ALL TO authenticated USING (crm_is_admin()) WITH CHECK (crm_is_admin());

-- crm_stages: segue a visibilidade do pipeline
CREATE POLICY "crm_stages_select" ON crm_stages
  FOR SELECT TO authenticated USING (
    crm_is_admin() OR pipeline_id IN (SELECT crm_accessible_pipeline_ids())
  );

CREATE POLICY "crm_stages_all_admin" ON crm_stages
  FOR ALL TO authenticated USING (crm_is_admin()) WITH CHECK (crm_is_admin());

-- crm_contacts: todo autenticado pode ver e criar contatos
CREATE POLICY "crm_contacts_select" ON crm_contacts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "crm_contacts_insert" ON crm_contacts
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "crm_contacts_update" ON crm_contacts
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "crm_contacts_delete_admin" ON crm_contacts
  FOR DELETE TO authenticated USING (crm_is_admin());

-- crm_deals: usuário vê deals dos seus pipelines; pode criar/editar; admin faz tudo
CREATE POLICY "crm_deals_select" ON crm_deals
  FOR SELECT TO authenticated USING (
    crm_is_admin() OR pipeline_id IN (SELECT crm_accessible_pipeline_ids())
  );

CREATE POLICY "crm_deals_insert" ON crm_deals
  FOR INSERT TO authenticated WITH CHECK (
    crm_is_admin() OR pipeline_id IN (SELECT crm_accessible_pipeline_ids())
  );

CREATE POLICY "crm_deals_update" ON crm_deals
  FOR UPDATE TO authenticated USING (
    crm_is_admin() OR pipeline_id IN (SELECT crm_accessible_pipeline_ids())
  );

CREATE POLICY "crm_deals_delete_admin" ON crm_deals
  FOR DELETE TO authenticated USING (crm_is_admin());

-- crm_deal_activities
CREATE POLICY "crm_activities_select" ON crm_deal_activities
  FOR SELECT TO authenticated USING (
    crm_is_admin() OR
    EXISTS (
      SELECT 1 FROM crm_deals d
      WHERE d.id = deal_id AND d.pipeline_id IN (SELECT crm_accessible_pipeline_ids())
    )
  );

CREATE POLICY "crm_activities_insert" ON crm_deal_activities
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_deals d
      WHERE d.id = deal_id AND (crm_is_admin() OR d.pipeline_id IN (SELECT crm_accessible_pipeline_ids()))
    )
  );

-- crm_tags: todos veem, admin gerencia
CREATE POLICY "crm_tags_select" ON crm_tags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "crm_tags_all_admin" ON crm_tags
  FOR ALL TO authenticated USING (crm_is_admin()) WITH CHECK (crm_is_admin());

-- crm_contact_tags
CREATE POLICY "crm_contact_tags_select" ON crm_contact_tags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "crm_contact_tags_insert" ON crm_contact_tags
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "crm_contact_tags_delete" ON crm_contact_tags
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 8. FUNÇÃO: criar perfil crm_users automaticamente no signup
-- ============================================================

CREATE OR REPLACE FUNCTION crm_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO crm_users (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::crm_user_role, 'seller')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_crm_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION crm_handle_new_user();

-- ============================================================
-- 9. SEED INICIAL (ajuste os UUIDs depois do primeiro login)
-- ============================================================

-- Descomente e ajuste após criar o primeiro usuário admin:

-- UPDATE crm_users SET role = 'admin' WHERE id = '<seu-user-id>';

-- INSERT INTO crm_pipelines (name) VALUES ('Vendas CNH'), ('Reciclagem e Adição');

-- INSERT INTO crm_stages (pipeline_id, name, color, "order") VALUES
--   ('<pipeline-id>', 'Novo Lead',           '#6366f1', 1),
--   ('<pipeline-id>', 'Qualificado',          '#f59e0b', 2),
--   ('<pipeline-id>', 'Proposta Enviada',     '#3b82f6', 3),
--   ('<pipeline-id>', 'Negociação',           '#8b5cf6', 4),
--   ('<pipeline-id>', 'Matrícula Realizada',  '#10b981', 5);
