export type MemberRole = "admin" | "member";
export type ChannelKind = "general" | "announcement" | "topic";
export type MessageKind = "text" | "file" | "system";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  publicKey?: string;
  lastSeenAt?: string;
  isOnline?: boolean;
}

export interface RoomChannel {
  id: string;
  roomId?: string;
  name: string;
  slug?: string;
  description: string;
  kind: ChannelKind;
  position?: number;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  reactedByCurrentUser: boolean;
}

export interface RoomMember {
  id: string;
  user: UserProfile;
  role: MemberRole;
  joinedAt: string;
  encryptedRoomKey?: string;
  currentRoomKeyId?: string;
}

export interface RoomKeyAccess {
  roomKeyId: string;
  encryptedRoomKey: string;
  createdAt?: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  channelId: string;
  roomKeyId?: string;
  author: UserProfile;
  type: MessageKind;
  body: string;
  ciphertext?: string;
  iv?: string;
  createdAt: string;
  attachment?: {
    id?: string;
    name: string;
    size: number;
    mimeType: string;
    storagePath?: string;
    iv?: string;
    encrypted?: boolean;
  };
  reactions?: MessageReaction[];
}

export interface RoomInvite {
  id: string;
  roomId: string;
  token: string;
  expiresAt: string;
  uses: number;
  maxUses: number;
  keyWrapCiphertext?: string | null;
  keyWrapIv?: string | null;
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
  currentUserId?: string;
  currentUserRole?: MemberRole | null;
  currentRoomKeyId?: string | null;
  currentRoomKeyVersion?: number | null;
  keyAccesses?: RoomKeyAccess[];
}

export interface DashboardContact {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  publicKey?: string;
  sharedRooms: number;
  directRoomSlug?: string;
  lastSeenAt?: string;
  isOnline?: boolean;
}
