-- Adiciona inbox_id em crm_messages para rastrear por qual canal
-- cada mensagem foi enviada/recebida (necessário porque 1 conversa pode
-- transitar entre inboxes ao longo do tempo).

ALTER TABLE crm_messages
  ADD COLUMN inbox_id UUID REFERENCES crm_inboxes(id) ON DELETE SET NULL;

CREATE INDEX idx_crm_messages_inbox ON crm_messages(inbox_id);

-- RLS: mesmas políticas das demais colunas (authenticated vê tudo)
-- Nenhuma policy nova necessária — a coluna herda as policies existentes.
