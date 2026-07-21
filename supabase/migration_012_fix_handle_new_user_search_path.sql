-- migration_012: corrige crm_handle_new_user() que impedia a criação de
-- novos usuários.
--
-- BUG: a função é SECURITY DEFINER mas não fixava o search_path. O trigger
-- dispara em AFTER INSERT ON auth.users, ou seja, roda no contexto do GoTrue
-- (serviço de Auth), cujo search_path é restrito (tipicamente só `auth`, sem
-- `public`). Com isso, as referências SEM schema dentro da função —
-- a tabela `crm_users` E o cast `::crm_user_role`, ambos em `public` — não
-- resolviam. O INSERT do trigger falhava e, por ser AFTER INSERT, abortava a
-- transação inteira do signup: nenhum usuário novo era criado.
--
-- CORREÇÃO: fixa `SET search_path = public` na função (robusto e boa prática
-- de segurança pra SECURITY DEFINER) e qualifica os símbolos com `public.`
-- (defensivo). CREATE OR REPLACE preserva o trigger existente
-- (trg_crm_on_auth_user_created), que referencia a função pelo nome.

CREATE OR REPLACE FUNCTION crm_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.crm_users (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.crm_user_role, 'seller')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
