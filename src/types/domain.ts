export type MemberRole = "admin" | "member";
export type ChannelKind = "general" | "announcement" | "topic";
export type MessageKind = "text" | "file" | "system";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  publicKey?: string;
}

export interface RoomChannel {
  id: string;
  name: string;
  description: string;
  kind: ChannelKind;
}

export interface RoomMember {
  id: string;
  user: UserProfile;
  role: MemberRole;
  joinedAt: string;
  encryptedRoomKey?: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  channelId: string;
  author: UserProfile;
  type: MessageKind;
  body: string;
  ciphertext?: string;
  iv?: string;
  createdAt: string;
  attachment?: {
    name: string;
    size: number;
    mimeType: string;
  };
}

export interface RoomInvite {
  id: string;
  roomId: string;
  token: string;
  expiresAt: string;
  uses: number;
  maxUses: number;
}

export interface Room {
  id: string;
  name: string;
  slug: string;
  description: string;
  isPublic: boolean;
  ownerId: string;
  members: RoomMember[];
  channels: RoomChannel[];
  messages: ChatMessage[];
  invites: RoomInvite[];
  unreadCount: number;
}
