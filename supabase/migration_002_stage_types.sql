-- ============================================================
-- CRM AutoEscola - Migration 002
-- Adiciona tipo às etapas do pipeline
-- ============================================================

ALTER TABLE crm_stages
  ADD COLUMN type TEXT NOT NULL DEFAULT 'normal'
  CHECK (type IN ('initial', 'won', 'lost', 'normal'));

-- Índice para busca rápida por tipo dentro de um pipeline
CREATE INDEX idx_crm_stages_type ON crm_stages(pipeline_id, type);

-- Comentário
COMMENT ON COLUMN crm_stages.type IS
  'Tipo da etapa: initial = entrada padrão de novos deals, won = deal ganho, lost = deal perdido, normal = etapa intermediária';
