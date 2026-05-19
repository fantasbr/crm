-- ============================================================
-- migration_007: WhatsApp Multi-Inbox via Evolution API
-- ============================================================

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE crm_message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE crm_message_status    AS ENUM ('sent', 'delivered', 'read', 'failed');
CREATE TYPE crm_conv_status       AS ENUM ('open', 'resolved', 'archived');

-- ─── crm_inboxes ──────────────────────────────────────────────────────────────
-- Cada linha representa um número WhatsApp / instância Evolution API

CREATE TABLE crm_inboxes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  wa_instance TEXT NOT NULL UNIQUE,
  phone       TEXT,
  color       TEXT NOT NULL DEFAULT '#6366f1',
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── crm_conversations ────────────────────────────────────────────────────────

CREATE TABLE crm_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id        UUID NOT NULL REFERENCES crm_inboxes(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  wa_jid          TEXT NOT NULL,
  UNIQUE (inbox_id, wa_jid),
  status          crm_conv_status NOT NULL DEFAULT 'open',
  unread_count    SMALLINT NOT NULL DEFAULT 0,
  last_message    TEXT,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── crm_messages ─────────────────────────────────────────────────────────────

CREATE TABLE crm_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES crm_conversations(id) ON DELETE CASCADE,
  wa_message_id   TEXT UNIQUE,
  direction       crm_message_direction NOT NULL,
  body            TEXT NOT NULL,
  media_url       TEXT,
  media_type      TEXT,
  status          crm_message_status NOT NULL DEFAULT 'sent',
  sender_name     TEXT,
  sent_by         UUID REFERENCES crm_users(id) ON DELETE SET NULL,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Alterações em tabelas existentes ─────────────────────────────────────────

ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS wa_phone TEXT;
UPDATE crm_contacts SET wa_phone = regexp_replace(phone, '\D', '', 'g') WHERE wa_phone IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_contacts_wa_phone ON crm_contacts(wa_phone) WHERE wa_phone IS NOT NULL;

ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS wa_conversation_id UUID REFERENCES crm_conversations(id) ON DELETE SET NULL;

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_crm_conversations_inbox    ON crm_conversations(inbox_id);
CREATE INDEX idx_crm_conversations_contact  ON crm_conversations(contact_id);
CREATE INDEX idx_crm_conversations_last_msg ON crm_conversations(last_message_at DESC NULLS LAST);
CREATE INDEX idx_crm_messages_conversation  ON crm_messages(conversation_id, created_at);

-- ─── Trigger updated_at ───────────────────────────────────────────────────────

CREATE TRIGGER trg_crm_conversations_updated_at
  BEFORE UPDATE ON crm_conversations
  FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE crm_inboxes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_messages      ENABLE ROW LEVEL SECURITY;

-- Todos os autenticados leem todos os inboxes (controle de visibilidade na UI)
-- Webhook usa service_role, que bypassa RLS automaticamente
CREATE POLICY "crm_inboxes_select"       ON crm_inboxes       FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_inboxes_insert"       ON crm_inboxes       FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crm_inboxes_update"       ON crm_inboxes       FOR UPDATE TO authenticated USING (true);

CREATE POLICY "crm_conversations_select" ON crm_conversations  FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_conversations_insert" ON crm_conversations  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crm_conversations_update" ON crm_conversations  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "crm_messages_select"      ON crm_messages       FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_messages_insert"      ON crm_messages       FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crm_messages_update"      ON crm_messages       FOR UPDATE TO authenticated USING (true);

-- ─── Dados iniciais (editar conforme suas instâncias) ─────────────────────────
-- INSERT INTO crm_inboxes (name, wa_instance, phone, color) VALUES
--   ('Vendas',  'instancia-vendas',  '(62) 99999-0001', '#6366f1'),
--   ('Suporte', 'instancia-suporte', '(62) 99999-0002', '#10b981');
