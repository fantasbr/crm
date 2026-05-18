-- ============================================================
-- CRM AutoEscola - Migration 003
-- Serviços com planos, orçamentos e migração do ENUM antigo
-- ============================================================

-- ── 1. Tabela de serviços (categorias) ────────────────────────────────────────
CREATE TABLE crm_services (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT true,
  "order"    SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_crm_services_updated_at
  BEFORE UPDATE ON crm_services
  FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();

-- ── 2. Tabela de planos por serviço ───────────────────────────────────────────
CREATE TABLE crm_service_plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id       UUID NOT NULL REFERENCES crm_services(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  table_price      DECIMAL(10, 2),
  max_discount_pct DECIMAL(5, 2) NOT NULL DEFAULT 0
    CHECK (max_discount_pct BETWEEN 0 AND 100),
  active           BOOLEAN NOT NULL DEFAULT true,
  "order"          SMALLINT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crm_service_plans_service ON crm_service_plans(service_id);

CREATE TRIGGER trg_crm_service_plans_updated_at
  BEFORE UPDATE ON crm_service_plans
  FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();

-- ── 3. RLS para serviços e planos ─────────────────────────────────────────────
ALTER TABLE crm_services      ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_service_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_services_select"    ON crm_services      FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_services_all_admin" ON crm_services      FOR ALL    TO authenticated USING (crm_is_admin()) WITH CHECK (crm_is_admin());
CREATE POLICY "crm_plans_select"       ON crm_service_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_plans_all_admin"    ON crm_service_plans FOR ALL    TO authenticated USING (crm_is_admin()) WITH CHECK (crm_is_admin());

-- ── 4. Seed: serviços e planos iniciais ───────────────────────────────────────
-- (Ajuste preços conforme sua tabela real)
DO $$
DECLARE
  id_cnh_a  UUID; id_cnh_b UUID; id_cnh_ab UUID;
  id_cnh_c  UUID; id_cnh_d  UUID; id_cnh_e  UUID;
  id_adicao UUID; id_rec    UUID; id_acc     UUID;
BEGIN
  INSERT INTO crm_services (name, "order") VALUES ('CNH Categoria A',     1) RETURNING id INTO id_cnh_a;
  INSERT INTO crm_services (name, "order") VALUES ('CNH Categoria B',     2) RETURNING id INTO id_cnh_b;
  INSERT INTO crm_services (name, "order") VALUES ('CNH Categoria AB',    3) RETURNING id INTO id_cnh_ab;
  INSERT INTO crm_services (name, "order") VALUES ('CNH Categoria C',     4) RETURNING id INTO id_cnh_c;
  INSERT INTO crm_services (name, "order") VALUES ('CNH Categoria D',     5) RETURNING id INTO id_cnh_d;
  INSERT INTO crm_services (name, "order") VALUES ('CNH Categoria E',     6) RETURNING id INTO id_cnh_e;
  INSERT INTO crm_services (name, "order") VALUES ('Adição de Categoria', 7) RETURNING id INTO id_adicao;
  INSERT INTO crm_services (name, "order") VALUES ('Reciclagem',          8) RETURNING id INTO id_rec;
  INSERT INTO crm_services (name, "order") VALUES ('ACC',                 9) RETURNING id INTO id_acc;

  -- CNH-A
  INSERT INTO crm_service_plans (service_id, name, "order") VALUES
    (id_cnh_a, 'Pacote 2 Aulas',    1),
    (id_cnh_a, 'Pacote 5 Aulas',    2),
    (id_cnh_a, 'Pacote 10 Aulas',   3),
    (id_cnh_a, 'Moto Automática',   4);

  -- CNH-B
  INSERT INTO crm_service_plans (service_id, name, "order") VALUES
    (id_cnh_b, 'Pacote 2 Aulas',       1),
    (id_cnh_b, 'Pacote 5 Aulas',       2),
    (id_cnh_b, 'Pacote 10 Aulas',      3),
    (id_cnh_b, 'Câmbio Automático',    4);

  -- CNH-AB
  INSERT INTO crm_service_plans (service_id, name, "order") VALUES
    (id_cnh_ab, 'Pacote 2 Aulas',      1),
    (id_cnh_ab, 'Pacote 5 Aulas',      2),
    (id_cnh_ab, 'Pacote 10 Aulas',     3),
    (id_cnh_ab, 'Câmbio Automático',   4),
    (id_cnh_ab, 'Moto Automática',     5);

  -- CNH-C, D, E
  INSERT INTO crm_service_plans (service_id, name, "order") VALUES
    (id_cnh_c, 'Pacote 2 Aulas',    1),
    (id_cnh_c, 'Pacote 5 Aulas',    2),
    (id_cnh_c, 'Pacote 10 Aulas',   3);

  INSERT INTO crm_service_plans (service_id, name, "order") VALUES
    (id_cnh_d, 'Pacote 2 Aulas',    1),
    (id_cnh_d, 'Pacote 5 Aulas',    2),
    (id_cnh_d, 'Pacote 10 Aulas',   3);

  INSERT INTO crm_service_plans (service_id, name, "order") VALUES
    (id_cnh_e, 'Pacote 2 Aulas',    1),
    (id_cnh_e, 'Pacote 5 Aulas',    2),
    (id_cnh_e, 'Pacote 10 Aulas',   3);

  -- Adição, Reciclagem, ACC (planos simples)
  INSERT INTO crm_service_plans (service_id, name, "order") VALUES
    (id_adicao, 'Padrão',    1),
    (id_adicao, 'Câmbio Automático', 2);

  INSERT INTO crm_service_plans (service_id, name, "order") VALUES
    (id_rec, 'Padrão',       1),
    (id_rec, 'Intensivo',    2);

  INSERT INTO crm_service_plans (service_id, name, "order") VALUES
    (id_acc, 'Padrão',       1);
END $$;

-- ── 5. Migra crm_deals: ENUM → service_id + plan_id ──────────────────────────
ALTER TABLE crm_deals
  ADD COLUMN service_id UUID REFERENCES crm_services(id),
  ADD COLUMN plan_id    UUID REFERENCES crm_service_plans(id);

-- Mapeia valores antigos do ENUM para os novos service_id
WITH mapping(old_val, svc_name) AS (VALUES
  ('cnh_a',            'CNH Categoria A'),
  ('cnh_b',            'CNH Categoria B'),
  ('cnh_ab',           'CNH Categoria AB'),
  ('cnh_c',            'CNH Categoria C'),
  ('cnh_d',            'CNH Categoria D'),
  ('cnh_e',            'CNH Categoria E'),
  ('adicao_categoria', 'Adição de Categoria'),
  ('reciclagem',       'Reciclagem'),
  ('acc',              'ACC')
)
UPDATE crm_deals d
SET service_id = s.id
FROM mapping m
JOIN crm_services s ON s.name = m.svc_name
WHERE d.service_interest::TEXT = m.old_val;

ALTER TABLE crm_deals ALTER COLUMN service_id SET NOT NULL;
ALTER TABLE crm_deals DROP COLUMN service_interest;
DROP TYPE IF EXISTS crm_service_interest;

CREATE INDEX idx_crm_deals_service ON crm_deals(service_id);
CREATE INDEX idx_crm_deals_plan    ON crm_deals(plan_id);

-- ── 6. Orçamentos ─────────────────────────────────────────────────────────────
CREATE TABLE crm_budgets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id    UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  valid_days SMALLINT NOT NULL DEFAULT 7,
  notes      TEXT,
  created_by UUID REFERENCES crm_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE crm_budget_plans (
  budget_id    UUID NOT NULL REFERENCES crm_budgets(id) ON DELETE CASCADE,
  plan_id      UUID NOT NULL REFERENCES crm_service_plans(id) ON DELETE CASCADE,
  custom_price DECIMAL(10, 2),
  PRIMARY KEY (budget_id, plan_id)
);

CREATE INDEX idx_crm_budgets_deal ON crm_budgets(deal_id);

ALTER TABLE crm_budgets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_budget_plans ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_crm_budgets_updated_at
  BEFORE UPDATE ON crm_budgets
  FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();

-- Vendedores do pipeline podem criar/ver orçamentos do deal
CREATE POLICY "crm_budgets_select" ON crm_budgets
  FOR SELECT TO authenticated USING (
    crm_is_admin() OR
    EXISTS (
      SELECT 1 FROM crm_deals d
      WHERE d.id = deal_id AND (crm_is_admin() OR d.pipeline_id IN (SELECT crm_accessible_pipeline_ids()))
    )
  );

CREATE POLICY "crm_budgets_insert" ON crm_budgets
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_deals d
      WHERE d.id = deal_id AND (crm_is_admin() OR d.pipeline_id IN (SELECT crm_accessible_pipeline_ids()))
    )
  );

CREATE POLICY "crm_budgets_update" ON crm_budgets
  FOR UPDATE TO authenticated USING (created_by = auth.uid() OR crm_is_admin());

CREATE POLICY "crm_budgets_delete" ON crm_budgets
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR crm_is_admin());

CREATE POLICY "crm_budget_plans_select" ON crm_budget_plans
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM crm_budgets b WHERE b.id = budget_id)
  );

CREATE POLICY "crm_budget_plans_all" ON crm_budget_plans
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM crm_budgets b WHERE b.id = budget_id AND (b.created_by = auth.uid() OR crm_is_admin()))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM crm_budgets b WHERE b.id = budget_id AND (b.created_by = auth.uid() OR crm_is_admin()))
  );
