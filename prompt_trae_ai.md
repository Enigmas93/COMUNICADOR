# Prompt para TRAE AI — App de Comunicação (Salas Públicas/Privadas com E2EE)

Copie todo o conteúdo abaixo e cole no TRAE AI como instrução inicial do projeto.

---

## CONTEXTO DO PROJETO

Quero construir um aplicativo web de comunicação em tempo real (estilo Discord/Slack simplificado), 100% gratuito no lançamento (sem cobrança, sem Stripe por enquanto). Qualquer visitante deve conseguir acessar a landing page, se cadastrar e criar uma sala em poucos cliques.

**Stack obrigatória:**
- Frontend: Next.js (App Router) + React + TypeScript + TailwindCSS
- Backend/Infra: Supabase (Auth, Postgres, Storage, Realtime via WebSockets)
- Deploy: Vercel
- PWA: instalável em celular e desktop, com notificações push e suporte offline básico

**Conceito central — "sala como produto":**
Cada sala é uma unidade isolada de comunicação, identificada por um `slug` único (ex: `app.com/sala/minha-equipe`). Toda sala é:
- **Pública** (aparece no diretório de exploração, qualquer um pode encontrar e entrar) ou
- **Privada** (só acessível por link de convite ou e-mail; não aparece em buscas)

Quem cria a sala se torna automaticamente **administrador** (owner). O administrador pode:
- Adicionar/remover membros
- Promover qualquer membro a administrador também (múltiplos admins por sala)
- Trocar a sala entre pública/privada
- Gerenciar permissões dentro da sala

---

## REQUISITO CRÍTICO: CRIPTOGRAFIA PONTA-A-PONTA (E2EE) REAL

Isso não é "criptografia em trânsito" (HTTPS) nem apenas RLS do banco. É **end-to-end encryption real**: o servidor (Supabase) e qualquer pessoa com acesso ao banco de dados **nunca devem conseguir ler o conteúdo das mensagens**, nem os arquivos enviados. Implemente da seguinte forma:

### Modelo de chaves
1. **Par de chaves por usuário**: ao se cadastrar, o cliente gera um par de chaves assimétricas (use `libsodium.js` ou a Web Crypto API nativa — X25519 para troca de chaves, Ed25519 ou similar para assinatura, se necessário). A chave pública vai para o Supabase (tabela `users`). A chave privada **nunca sai do dispositivo**: derive-a a partir da senha do usuário (ex: via Argon2/PBKDF2 no client-side) ou armazene-a cifrada localmente (IndexedDB) com a senha como fator de desbloqueio. Avalie e documente no README a opção escolhida.
2. **Chave simétrica por sala**: cada sala tem uma "chave de sala" (symmetric key, AES-256-GCM, gerada com `crypto.subtle` ou libsodium). Essa chave nunca é enviada em texto puro ao servidor.
3. **Distribuição da chave de sala**: quando o admin adiciona um membro, o cliente do admin cifra a chave da sala com a chave pública do novo membro (asymmetric encryption) e envia esse "envelope" cifrado para o Supabase, guardado por exemplo em `room_members.encrypted_room_key`. Só o dono daquela chave privada consegue abrir o envelope e obter a chave de sala.
4. **Mensagens**: o cliente cifra o conteúdo da mensagem com a chave simétrica da sala (AES-256-GCM, com nonce/IV único por mensagem) **antes** de enviar ao Supabase. O campo `content` no banco armazena apenas o ciphertext (base64) + IV. O Supabase Realtime distribui esse ciphertext; cada cliente membro descriptografa localmente com a chave de sala que já possui.
5. **Arquivos**: antes do upload ao Supabase Storage, cifre o arquivo no cliente com a mesma chave de sala (ou uma chave derivada por arquivo, também distribuída cifrada). O Storage do Supabase armazena apenas blobs cifrados.
6. **Troca de chave ao remover membro**: ao remover um membro ou revogar admin, opcionalmente faça "rotação de chave" da sala (gere nova chave simétrica e redistribua para os membros restantes) para garantir que o removido não decifre mensagens futuras. Documente isso como melhoria de segurança, pode ser v2 se a complexidade for grande para o MVP.

### Implicações na arquitetura
- O Supabase e o RLS continuam essenciais para **controle de acesso** (quem pode ler/escrever quais linhas), mas não para "segredo" do conteúdo — o conteúdo já chega cifrado.
- Nunca implemente nada que descriptografe no backend (edge functions, triggers SQL) — isso quebraria o modelo E2EE.
- Documente claramente nos comentários do código: "Esta é uma arquitetura E2EE — o servidor não tem acesso às chaves privadas nem às chaves de sala em texto claro."

---

## PÁGINAS E TELAS

1. **Landing Page**: explica o produto, botão de cadastro/login. Cadastro via e-mail/senha, OAuth Google, e magic link (Supabase Auth nativo, exceto que a geração do par de chaves E2EE acontece no client-side após o primeiro login).
2. **Dashboard do usuário**: lista "Minhas salas", aba "Explorar salas públicas" (diretório com busca/filtro), botão "Criar nova sala".
3. **Tela de criação de sala**: nome, slug (auto-gerado, editável), pública ou privada, descrição opcional. Ao confirmar: gera a chave simétrica da sala no client-side, cifra-a com a própria chave pública do criador, salva o envelope, cria a entrada em `room_members` com `role = admin`.
4. **Interface da sala (chat)**: lista de mensagens em tempo real (decifradas no client), input de mensagem, upload de arquivos/imagens (cifrados), emojis/reações, painel lateral de membros com indicação de quem é admin, suporte a subcanais/grupos dentro da sala (ex: canal geral, anúncios, tópicos customizados).
5. **Tela de configurações da sala** (somente admin): alternar pública/privada, gerenciar membros (adicionar por e-mail/link de convite, remover, promover/despromover admin), gerar link de convite, deletar sala.
6. **Fluxo de convite**: admin gera link único de convite (com token); convidado clica, faz cadastro/login rápido, e ao entrar recebe o envelope da chave de sala (cifrado para sua chave pública) automaticamente.

---

## ESTRUTURA DE DADOS (Supabase / Postgres)

Adapte o desenho abaixo, mantendo a regra de que **nenhum campo de conteúdo sensível guarda texto plano**:

```
users
  id, email, name, avatar_url, created_at
  public_key            -- chave pública E2EE do usuário (texto, base64)
  encrypted_private_key -- chave privada cifrada localmente com senha (opcional, se optar por backup sincronizável)

rooms
  id, name, slug, is_public (bool), owner_id → users, description, created_at

room_members
  room_id → rooms, user_id → users, role (admin/member)
  encrypted_room_key   -- chave simétrica da sala, cifrada para a chave pública deste usuário
  joined_at

messages
  id, room_id → rooms, user_id → users
  ciphertext            -- conteúdo da mensagem, cifrado (base64)
  iv                     -- nonce/IV usado na cifragem (base64)
  type (text/file/system), created_at

files
  id, message_id → messages
  storage_path, encrypted (bool, sempre true), iv, size, type, name

reactions
  message_id → messages, user_id → users, emoji, created_at

room_invites
  id, room_id → rooms, token (único), created_by → users, expires_at, max_uses, uses
```

**Row Level Security (RLS):** ative em todas as tabelas. Regras essenciais:
- `messages`: SELECT/INSERT só para quem tem linha correspondente em `room_members` para aquele `room_id`.
- `room_members`: UPDATE de `role` só permitido se o usuário autenticado já for `admin` daquela sala.
- `rooms`: SELECT pública para `is_public = true`; SELECT de salas privadas só para membros.
- `files`: acesso ao Storage controlado por policy equivalente (vincular ao `room_id` da mensagem).

**Supabase Realtime**: escute mudanças (`INSERT`) na tabela `messages` filtradas por `room_id`, e decifre no client ao receber.

---

## FLUXOS PRINCIPAIS (replicar exatamente)

**Fluxo 1 — Criar uma sala:**
Cadastro/Login → Dashboard ("+ Nova sala") → Configura sala (nome, pública/privada) → Sala criada (link gerado, chave de sala gerada e auto-distribuída ao criador).

**Fluxo 2 — Descobrir e entrar em sala pública:**
Explorar (filtro/busca) → Ver sala (preview público, sem acesso ao histórico cifrado até entrar) → Entrar (1 clique) → Membro (chat liberado, recebe envelope da chave de sala).

**Fluxo 3 — Convidar para sala privada:**
Dono da sala gera link de convite → Compartilha (WhatsApp/e-mail) → Convidado clica no link → Login rápido → Acessa (recebe envelope da chave de sala cifrado para sua chave pública).

---

## REQUISITOS NÃO FUNCIONAIS

- **Gratuito por padrão**: sem paywall, sem limite artificial de salas/membros nesta fase — não implemente lógica de billing nem Stripe.
- **PWA completo**: manifest.json, service worker para cache básico offline (ao menos o shell do app e mensagens já carregadas), suporte a notificações push (Web Push API + Supabase Edge Function ou serviço externo para o envio).
- **Responsivo**: mobile-first, funcional em desktop.
- **Performance**: paginação/scroll infinito nas mensagens (carregar mensagens cifradas em lotes, decifrar sob demanda).
- **Segurança adicional**: rate limiting básico em criação de salas/convites para evitar abuso; sanitização de inputs; validação de slug único.

---

## ENTREGÁVEIS ESPERADOS

1. Projeto Next.js completo, organizado (app router, componentes, hooks, lib de criptografia isolada em `lib/crypto/`).
2. Schema SQL completo do Supabase (migrations) incluindo todas as policies de RLS.
3. Documentação no README explicando: como rodar localmente, variáveis de ambiente do Supabase, e principalmente **como funciona o modelo de E2EE implementado** (geração de chaves, fluxo de distribuição, o que o servidor vê e o que não vê).
4. Sem integração de pagamento nesta etapa.

Comece gerando a estrutura de pastas do projeto e o schema SQL do Supabase com as policies de RLS, depois a lib de criptografia (`lib/crypto/`), e só então as telas, seguindo a ordem dos fluxos descritos acima.
