-- Migration 006: vincula deals a conversas do Chatwoot
ALTER TABLE crm_deals
  ADD COLUMN chatwoot_conversation_id TEXT;
