-- Migration 004: torna service_id opcional em crm_deals
-- Motivo: deals criados via automação (n8n/Chatwoot) chegam sem serviço definido;
-- o vendedor preenche durante a qualificação do lead.

ALTER TABLE crm_deals
  ALTER COLUMN service_id DROP NOT NULL;
