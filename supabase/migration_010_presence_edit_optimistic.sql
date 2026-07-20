-- migration_010: robustez na troca de mensagens do Inbox
--
-- deleted_at / edited_at / original_body: suporte a REVOKE (apagar pra todos)
-- e edição de mensagem vindos do webhook (protocolMessage).
--
-- read_at: quando uma mensagem inbound foi de fato marcada como lida na
-- Evolution API (separado do campo `status`, que é sobre o ACK de mensagens
-- outbound — sent/delivered/read do lado de quem enviou).
--
-- client_ref: chave de idempotência do envio otimista — a mensagem é gravada
-- como 'pending' no banco ANTES de chamar a Evolution API, e o client_ref
-- evita reenvio duplicado real ao WhatsApp em caso de retry.
--
-- ATENÇÃO: rode o ALTER TYPE abaixo ISOLADO (statement/execução separada do
-- resto do arquivo). Postgres não permite referenciar um valor de enum
-- recém-adicionado em DML dentro da mesma transação em que foi criado.

ALTER TYPE crm_message_status ADD VALUE IF NOT EXISTS 'pending';

-- Rode o restante abaixo depois que o ALTER TYPE acima já tiver sido
-- commitado (ex: em uma segunda execução no SQL editor do Supabase Studio).

ALTER TABLE crm_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE crm_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE crm_messages ADD COLUMN IF NOT EXISTS original_body TEXT;
ALTER TABLE crm_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE crm_messages ADD COLUMN IF NOT EXISTS client_ref TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_messages_client_ref
  ON crm_messages(client_ref) WHERE client_ref IS NOT NULL;
