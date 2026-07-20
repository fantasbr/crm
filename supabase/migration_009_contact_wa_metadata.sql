-- migration_009: metadados do WhatsApp no contato, separados do que o
-- usuário edita no CRM.
--
-- wa_push_name: nome que o próprio contato define no WhatsApp (pushName),
-- sempre atualizado a partir do que a Evolution API reporta — independente
-- do campo `name`, que é o nome editável pelo usuário no CRM.
--
-- avatar_url / avatar_synced_at: foto de perfil do WhatsApp sincronizada via
-- Evolution API (POST /chat/fetchProfilePictureUrl). A URL é guardada como
-- veio da Evolution, sem re-hospedar (mesmo padrão já usado pra mídia de
-- mensagens em crm_messages.media_url).

ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS wa_push_name TEXT;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS avatar_synced_at TIMESTAMPTZ;
