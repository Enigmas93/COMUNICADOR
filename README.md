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

```bash
npm install
npm run dev
```

## Testes

```bash
npm run test
npm run test:e2e
```

## Banco e RLS

O schema inicial esta em `supabase/migrations/0001_initial_schema.sql` e cobre:

- `users`, `rooms`, `room_members`, `messages`, `files`, `reactions`, `room_invites`
- RLS em todas as tabelas sensiveis
- select/insert de `messages` restrito a membros da sala
- promocao e manutencao de `room_members` apenas por admins
- salas publicas visiveis no diretorio e privadas visiveis apenas para membros

## Estado Atual

Este repositório ja inclui:

- landing page
- dashboard
- fluxo de criacao de sala
- tela de chat
- fluxo de convite
- modulo de criptografia com testes unitarios
- testes E2E de fluxos principais
- service worker basico
- workflow de CI

## Proximos Passos Naturais

- conectar `Supabase Auth` real nas telas de login
- substituir o mock local por queries reais com `TanStack Query`
- configurar buckets e policies de `Storage`
- adicionar rotacao de chave por remocao de membro
- completar push notifications com Edge Functions
