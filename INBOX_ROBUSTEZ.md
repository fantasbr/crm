# Reforma robusta da troca de mensagens no Inbox (Evolution API v2)

Acompanhamento da implementação. Plano completo (contexto, riscos, decisões) em `C:\Users\Angelo-PC\.claude\plans\lovely-floating-koala.md` — este arquivo é só o checklist de progresso.

## Decisões confirmadas
- Envio otimista: **Opção A** (persistido no banco com `client_ref`, sobrevive a reload).
- Auto-retry: **desligado no início** — só retry manual por enquanto.
- Presença: **bidirecional** (CRM → WhatsApp e WhatsApp → CRM).
- Escopo extra confirmado: edição/revogação de mensagem (`protocolMessage`).

## Checklist

- [x] **Fase 0** — Arquivo de acompanhamento (este arquivo)
- [x] **Fase 1** — Schema: `migration_010_presence_edit_optimistic.sql` (`deleted_at`, `edited_at`, `original_body`, `read_at`, `client_ref`, enum `pending`) + `types.ts` — **⚠️ ainda precisa ser aplicada manualmente no Supabase Studio (ALTER TYPE isolado primeiro) antes do deploy**
- [x] **Fase 2** — Helpers `markMessagesAsRead` e `sendPresence` em `src/lib/evolution.ts`
- [x] **Fase 3** — Marcar como lida de verdade (`src/app/api/conversations/read/route.ts` chama `markMessageAsRead` na Evolution)
- [x] **Fase 4** — Endpoint de presença enviada (`src/app/api/whatsapp/presence/route.ts`) — **implementado, porém desligado no client** (ver "Achados contra a documentação oficial" abaixo)
- [x] **Fase 5a** — Webhook: tratar `protocolMessage` (REVOKE / edição)
- [x] **Fase 5b** — Webhook: tratar `presence.update`
- [x] **Fase 6** — SSE: `InboxEvent` tipado (`type: 'message' | 'presence'`), emissores existentes migrados
- [x] **Fase 7** — Client: enviar presença com debounce (digitando/gravando)
- [x] **Fase 8** — Client: mostrar presença recebida do contato ("digitando...")
- [x] **Fase 9** — Envio otimista + retry manual (`client_ref`, estado `pending`/`failed`)
- [x] **Fase 10** — Client: renderizar mensagem editada/apagada
- [x] **Validação** — `tsc` e `eslint` limpos (só os 5 avisos pré-existentes de sempre, nenhum novo), `npm run build` passou
- [x] **Revisão de código minuciosa** — 4 bugs reais encontrados e corrigidos (ver seção abaixo)
- [ ] **Testes manuais end-to-end** — ainda não feitos (ver checklist na seção abaixo)

## ⚠️ Antes de publicar
1. **Migration já aplicada** ✅ (confirmado via query de leitura contra o banco).
2. Testar manualmente contra a instância Evolution real (ver "Riscos técnicos" abaixo) antes de confiar 100% em presença e edição/revogação.

## Revisão de código — bugs encontrados e corrigidos
1. **[Alto]** `conversations/read/route.ts` gravava `read_at` mesmo quando a chamada à Evolution falhava, quebrando o retry automático na próxima abertura da conversa. Corrigido: só grava `read_at` se `markMessagesAsRead` retornar sucesso.
2. **[Médio]** `startRecording` não cancelava o timer de "parou de digitar" herdado de uma digitação recente — podia mandar `paused` pro WhatsApp segundos depois de já termos mandado `recording`. Corrigido: `startRecording` cancela esse timer.
3. **[Médio]** A checagem de idempotência do `client_ref` em `send/route.ts` não filtrava por `conversation_id` — defesa em profundidade contra reaproveitar a linha errada se o estado do client algum dia dessincronizar. Corrigido: filtro adicional por `conversation_id`.
4. **[Baixo/médio]** Reviver um envio "pending morto" zerava o `wa_message_id` incondicionalmente, mesmo quando ele já indicava que o envio anterior tinha sido bem-sucedido (processo caiu antes de gravar o status final). Corrigido: se já existe `wa_message_id`, marca como `sent` direto sem reenviar.

## Achados contra a documentação oficial (docs.evolutionfoundation.com.br)
Consultamos a documentação real depois da implementação inicial. Achados:

- **`sendPresence` estava com endpoint E formato errados** — corrigido. Era `POST /chat/sendPresence/{instance}` com `{number, presence, delay}`; o correto, confirmado no schema OpenAPI da doc, é `POST /instance/setPresence/{instance}` com **só** `{presence}` — **sem campo de destinatário**.
- **Implicação importante**: presença é do **instance inteiro**, não por conversa. Se dois atendimentos rolarem ao mesmo tempo no mesmo inbox, o indicador podia aparecer pro contato errado. Por decisão do usuário, **o envio automático de presença (digitando/gravando) foi desligado** no client (`SEND_PRESENCE_ENABLED = false` em `inbox-client.tsx`) — o código fica pronto, é só religar quando fizer sentido (ex: se cada inbox só tiver 1 atendimento ativo por vez na prática). O **recebimento** de presença do contato (mostrar "digitando..." no cabeçalho) não tem esse problema — continua ativo.
- `paused` não consta no enum oficial documentado (só `available`, `unavailable`, `composing`, `recording`) — mantido no código pois é um valor válido do protocolo WhatsApp/Baileys; se a Evolution rejeitar, falha silenciosamente (best-effort). Vale confirmar quando for religar a feature.
- `markMessageAsRead`: a doc confirma o endpoint (`POST /chat/markMessageAsRead/{instance}`) e o formato externo (`{readMessages: [...]}`), mas **não detalha os campos internos de cada item** — `remoteJid`/`fromMe`/`id` continuam sendo a melhor suposição (convenção conhecida da comunidade), não 100% confirmados pela doc.
- `presence.update` (recebido) e `protocolMessage`/`messages.delete` (edição/revogação): a documentação **não tem exemplos de payload** pra esses eventos — segue sem confirmação, com logging defensivo. Também adicionei tratamento pro evento `messages.delete` (dedicado, além do REVOKE via `protocolMessage`), já que a lista de eventos da sua instância mostrou que ele existe separadamente.
- Confirmamos que os nomes de evento no payload usam `lowercase.dot.case` (`messages.upsert`, etc) — mesma convenção já usada no código antes desta sessão, então `presence.update`/`messages.delete` devem seguir o mesmo padrão.

## Refinamentos feitos durante a implementação (ajustes ao plano original)
- **Sem bolha "otimista" local separada**: como a mensagem já é persistida como `pending` no banco *antes* de chamar a Evolution API, e o SSE já é emitido nesse momento, o próprio mecanismo de `refreshMessages` (disparado pelo SSE) já mostra a mensagem pendente quase instantaneamente — não foi necessário um estado React paralelo só pra isso. Simplifica o código sem perder a robustez pedida (persistência + reconciliação).
- **Retry manual reaproveita o `client_ref` da própria mensagen quando existe**, em vez de sempre gerar um novo. Isso é mais seguro que o previsto no plano original: se a tentativa anterior tiver sido enviada de verdade apesar de um erro ambíguo de rede, o backend detecta pelo `client_ref` já usado e não reenvia duplicado — só gera um `client_ref` novo como fallback para mensagens antigas que não têm esse campo (anteriores à migration).
- Mensagens com falha **não restauram mais o texto/mídia no campo de digitação** — ficam como uma bolha "failed" na própria conversa com botão de retry ao lado do ícone `!`. Evita o usuário acabar mandando a mesma mensagem duas vezes (uma pelo retry, outra reescrevendo no campo).

## Testes manuais end-to-end pendentes (usar uma conversa de teste, número próprio)
- [ ] Mark as read: abrir conversa não lida no CRM, conferir "✓✓ azul" no WhatsApp real.
- [ ] ~~Presença enviada~~ — desligada por enquanto, não precisa testar (ver "Achados" acima).
- [ ] Presença recebida: digitar no WhatsApp de teste, conferir "digitando..." no cabeçalho do CRM.
- [ ] Edição/revogação: editar e apagar uma mensagem do lado do WhatsApp de teste (testar os dois: apagar "pra todos" e editar), conferir reflexo no CRM — vale conferir no console/logs do servidor se caiu no branch esperado (REVOKE/MESSAGE_EDIT/messages.delete) ou no "formato inesperado".
- [ ] Envio otimista: enviar com rede lenta (DevTools throttle), conferir bolha "pending" (relógio) e reconciliação; forçar falha (desligar Evolution API) e testar o botão de retry.
