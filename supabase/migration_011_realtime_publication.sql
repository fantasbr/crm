-- migration_011: habilita Supabase Realtime (postgres_changes) para
-- crm_messages e crm_conversations — substitui o SSE customizado
-- (src/lib/realtime-bus.ts) como mecanismo de entrega de mensagens em tempo
-- real do Inbox, removendo a limitação de "só funciona com 1 réplica Docker"
-- documentada naquele arquivo.
--
-- RLS de ambas as tabelas já é `USING (true)` pra `authenticated`
-- (migration_007) — nenhuma mudança de RLS necessária aqui, o
-- postgres_changes respeita a mesma policy do SELECT.

-- Garante que a publication existe. Instalações padrão self-hosted já vêm
-- com ela criada no bootstrap do container Postgres — este bloco é só uma
-- rede de segurança; se cair na exceção, é sinal de setup não-padrão.
DO $$
BEGIN
  CREATE PUBLICATION supabase_realtime;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ALTER PUBLICATION ... ADD TABLE não tem IF NOT EXISTS nativo — checa via
-- pg_publication_tables antes de cada ADD (idempotente, pode rodar de novo).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'crm_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'crm_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_conversations;
  END IF;
END $$;
