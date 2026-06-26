# Aurora Chat

Aplicativo web de comunicacao em tempo real com salas publicas/privadas, arquitetura E2EE real no cliente e backend baseado em Supabase.

## Direcao Visual

Adotei uma interface densa e funcional, inspirada em Linear e Slack, com superficies escuras translucidas, acentos em ciano/violeta e hierarquia tipografica forte para transmitir operacao, seguranca e velocidade. O tema claro e escuro nascem juntos a partir dos mesmos tokens de cor, evitando a sensacao de template generico.

## Stack Escolhida

- `Next.js 16` com `App Router`, `React 19` e `TypeScript strict`.
- `Tailwind CSS v4` como base de estilo.
- `shadcn/ui` alinhado a `Radix UI` para acessibilidade nativa e customizacao profunda.
- `TanStack Query` para estado de servidor e sincronizacao com Supabase Realtime.
- `Zustand` reservado para estado efemero de UI e sessao criptografica local.
- `React Hook Form + Zod` para formularios com validacao forte.
- `Framer Motion` para transicoes e microinteracoes.
- `Vitest` para testes unitarios.
- `Playwright` para os fluxos criticos E2E.

## Por Que Query + Zustand

O app separa claramente estado de servidor e estado local:

- `TanStack Query`: cache, invalidação e sincronizacao de dados remotos como salas, membros, mensagens e convites.
- `Zustand`: sessao ativa, preferencia de canal, rascunhos e material criptografico temporario que nao deve ser misturado ao cache remoto.

Essa divisao evita componentes inchados e prepara o app para uso intenso de `Supabase Realtime`.

## Modelo E2EE

Esta e uma arquitetura E2EE: o servidor nao tem acesso as chaves privadas nem as chaves de sala em texto claro.

1. Cada usuario gera no cliente um par assimetrico.
2. A chave publica e enviada ao Supabase.
3. A chave privada permanece local e pode ser protegida por senha usando derivacao forte e backup cifrado.
4. Cada sala gera uma chave simetrica propria.
5. A chave da sala e distribuida por envelopes cifrados para cada membro.
6. Mensagens e arquivos sao cifrados localmente antes de subir ao banco ou storage.
7. O backend aplica RLS para acesso, mas nao conhece o conteudo.

## Estrutura Principal

```text
src/
  app/
  components/
  lib/
    crypto/
    data/
    supabase/
  types/
supabase/
  migrations/
tests/
  e2e/
```

## Variaveis de Ambiente

Copie `.env.example` para `.env.local` com:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Como Rodar

1. Instale as dependencias.
2. Aplique as migrations no projeto Supabase.
3. Suba o ambiente local do Next.

```bash
npm install
npx supabase db push
npm run dev
```

## Fluxos Implementados

O repositório ja entrega uma base funcional conectada ao Supabase:

- autenticacao real com e-mail/senha, Google OAuth e magic link
- callback de autenticacao com `exchangeCodeForSession` e `verifyOtp`
- bootstrap da identidade criptografica do usuario no primeiro acesso
- criacao de salas com canais padrao `geral` e `anuncios`
- dashboard real com salas do usuario e diretorio publico
- chat por canal com mensagens E2EE, reacoes e realtime
- upload e download de anexos cifrados via `Supabase Storage`
- convites E2EE com segredo no fragmento da URL (`#k=...`)
- painel administrativo para membros, cargos, convites e canais
- PWA basico com manifesto, service worker e rota offline
- CI com lint, typecheck, build, testes unitarios e smoke E2E

## Autenticacao

Os fluxos de login ficam em `src/components/auth/auth-form.tsx` e `src/app/auth/callback/route.ts`.

- `Entrar`: usa `signInWithPassword`
- `Criar conta`: usa `signUp` com `emailRedirectTo`
- `Google`: usa `signInWithOAuth`
- `Magic link`: usa `signInWithOtp`
- `Callback`: aceita tanto `code` quanto `token_hash` + `type`

## Modelo E2EE Em Producao

O pipeline criptografico principal fica em `src/lib/crypto/e2ee.ts`:

- identidade assimetrica por usuario gerada no cliente
- chave simetrica unica por sala
- envelopes RSA-OAEP para distribuir a chave da sala por membro
- convites com wrap da chave da sala baseado em segredo temporario
- mensagens e anexos protegidos com AES-GCM antes de sair do cliente
- armazenamento local da identidade para reabrir a sala sem depender do servidor

## Banco, Storage e RLS

As migrations relevantes estao em `supabase/migrations`:

- `0001_initial_schema.sql`: schema inicial, enums, tabelas centrais e RLS
- `0003_invite_key_wrap.sql`: suporte a convites E2EE com chave da sala envelopada
- `0004_channels_files_and_storage.sql`: canais, `channel_id` em mensagens, bucket `room-files` e policies do storage

Hoje o banco cobre:

- `users`, `rooms`, `room_members`, `room_channels`
- `messages`, `files`, `reactions`, `room_invites`
- policies de leitura/escrita por membro
- storage privado para anexos cifrados

## Proxy Do Next

O refresh de sessao do Supabase SSR agora usa `src/proxy.ts`, substituindo o antigo `middleware.ts` e removendo o aviso de deprecacao do Next 16.

## Testes E Validacao

Scripts principais:

```bash
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
```

Validacao mais recente desta etapa:

- `npm run lint`: ok
- `npm run typecheck`: ok
- `npm run build`: ok
- `npm run test`: ok
- `npm run test:e2e`: smoke ajustado para rotas deterministicas locais

## Estado Atual

Este app ja esta em um ponto de base comercial funcional para continuar endurecimento:

- frontend comercial em `Next.js 16` com App Router
- backend real em `Supabase Auth`, Postgres, Realtime e Storage
- convites E2EE reais e aceite no cliente
- canais persistidos com administracao por sala
- anexos e reacoes persistidos no banco
- tipagem forte de dominio e banco
- suite inicial de testes automatizados

## Proximos Passos Recomendados

- implementar rotacao de chave da sala quando um membro for removido
- adicionar notificacoes push reais para PWA
- expandir E2E autenticado com seed de usuario/sala de teste
- reforcar observabilidade e telemetria de erros para producao
- preparar billing, trial e limites de plano para comercializacao SaaS
