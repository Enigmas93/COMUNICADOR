import type { Room, UserProfile } from "@/types/domain";

const currentUser: UserProfile = {
  id: "user_ana",
  name: "Ana Martins",
  email: "ana@aurora.local",
  avatarUrl: "AM",
};

const bruno: UserProfile = {
  id: "user_bruno",
  name: "Bruno Costa",
  email: "bruno@aurora.local",
  avatarUrl: "BC",
};

const sara: UserProfile = {
  id: "user_sara",
  name: "Sara Lima",
  email: "sara@aurora.local",
  avatarUrl: "SL",
};

export const mockRooms: Room[] = [
  {
    id: "room_aurora",
    name: "Aurora Team",
    slug: "aurora-team",
    description: "Equipe principal com canais de operacao, anuncios e suporte interno.",
    isPublic: false,
    ownerId: currentUser.id,
    unreadCount: 6,
    members: [
      { id: "member_1", user: currentUser, role: "admin", joinedAt: "2026-06-24T10:00:00.000Z" },
      { id: "member_2", user: bruno, role: "admin", joinedAt: "2026-06-24T10:05:00.000Z" },
      { id: "member_3", user: sara, role: "member", joinedAt: "2026-06-24T11:10:00.000Z" },
    ],
    channels: [
      { id: "channel_general", name: "geral", description: "Conversas do time", kind: "general" },
      { id: "channel_ann", name: "anuncios", description: "Avisos oficiais", kind: "announcement" },
      { id: "channel_ops", name: "operacoes", description: "Topicos de execucao", kind: "topic" },
    ],
    messages: [
      {
        id: "msg_1",
        roomId: "room_aurora",
        channelId: "channel_general",
        author: currentUser,
        type: "text",
        body: "A chave da sala foi rotacionada e os envelopes foram redistribuidos com sucesso.",
        createdAt: "2026-06-26T12:15:00.000Z",
      },
      {
        id: "msg_2",
        roomId: "room_aurora",
        channelId: "channel_general",
        author: bruno,
        type: "file",
        body: "Subi o playbook operacional cifrado para o canal.",
        createdAt: "2026-06-26T12:18:00.000Z",
        attachment: {
          name: "playbook-incidentes.pdf",
          size: 2480000,
          mimeType: "application/pdf",
        },
      },
      {
        id: "msg_3",
        roomId: "room_aurora",
        channelId: "channel_ops",
        author: sara,
        type: "text",
        body: "Os convites por link expiram em 48h e cada uso revalida a policy de membros.",
        createdAt: "2026-06-26T12:21:00.000Z",
      },
    ],
    invites: [
      {
        id: "invite_1",
        roomId: "room_aurora",
        token: "aurora-48h-token",
        expiresAt: "2026-06-28T12:00:00.000Z",
        uses: 1,
        maxUses: 10,
      },
    ],
  },
  {
    id: "room_publico",
    name: "Comunidade Produto",
    slug: "comunidade-produto",
    description: "Sala publica para descobrir funcionalidades, votar em ideias e receber novidades.",
    isPublic: true,
    ownerId: bruno.id,
    unreadCount: 0,
    members: [
      { id: "member_4", user: bruno, role: "admin", joinedAt: "2026-06-20T09:00:00.000Z" },
      { id: "member_5", user: sara, role: "member", joinedAt: "2026-06-21T09:00:00.000Z" },
    ],
    channels: [
      { id: "channel_public_general", name: "geral", description: "Boas-vindas", kind: "general" },
    ],
    messages: [
      {
        id: "msg_4",
        roomId: "room_publico",
        channelId: "channel_public_general",
        author: bruno,
        type: "text",
        body: "Bem-vindo a nossa sala publica. Entre para receber a chave e acessar o historico cifrado.",
        createdAt: "2026-06-26T09:20:00.000Z",
      },
    ],
    invites: [],
  },
];

export const featuredMetrics = [
  { label: "salas ativas", value: "128" },
  { label: "mensagens/dia", value: "24k" },
  { label: "latencia realtime", value: "<250ms" },
  { label: "servidor lendo conteudo", value: "0" },
];

export const currentRoom = mockRooms[0];
export const publicDirectory = mockRooms.filter((room) => room.isPublic);
export const signedInUser = currentUser;
