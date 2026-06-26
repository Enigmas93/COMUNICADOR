import { mockRooms, publicDirectory, signedInUser } from "@/lib/data/mock";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ChatMessage, DashboardContact, MessageReadReceipt, MessageReaction, Room, RoomChannel, RoomInvite, RoomKeyAccess, RoomMember, UserProfile } from "@/types/domain";
import type { Database } from "@/types/supabase";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
type RoomRow = Database["public"]["Tables"]["rooms"]["Row"];
type MemberRow = Database["public"]["Tables"]["room_members"]["Row"];
type RoomKeyRow = Database["public"]["Tables"]["room_keys"]["Row"];
type RoomMemberKeyRow = Database["public"]["Tables"]["room_member_keys"]["Row"];
type ChannelRow = Database["public"]["Tables"]["room_channels"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type FileRow = Database["public"]["Tables"]["files"]["Row"];
type ReactionRow = Database["public"]["Tables"]["reactions"]["Row"];
type MessageReadRow = Database["public"]["Tables"]["message_reads"]["Row"];
type InviteRow = Database["public"]["Tables"]["room_invites"]["Row"];

function isUserOnline(lastSeenAt?: string | null) {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() <= 1000 * 60 * 2;
}

function avatarFromName(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function toUserProfile(user: UserRow): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatar_url ?? avatarFromName(user.name),
    publicKey: user.public_key,
    lastSeenAt: user.last_seen_at,
    isOnline: isUserOnline(user.last_seen_at),
  };
}

function fallbackProfile(id: string, label = "Usuario"): UserProfile {
  return {
    id,
    name: label,
    email: "",
    avatarUrl: avatarFromName(label),
    isOnline: false,
  };
}

function toChannel(channel: ChannelRow): RoomChannel {
  return {
    id: channel.id,
    roomId: channel.room_id,
    name: channel.name,
    slug: channel.slug,
    description: channel.description ?? "",
    kind: channel.kind,
    position: channel.position,
  };
}

function toMessage(
  message: MessageRow,
  author: UserProfile,
  attachment: ChatMessage["attachment"],
  reactions: MessageReaction[],
  readReceipts: MessageReadReceipt[],
): ChatMessage {
  return {
    id: message.id,
    roomId: message.room_id,
    channelId: message.channel_id ?? "",
    roomKeyId: message.room_key_id,
    author,
    type: message.type,
    body: message.ciphertext,
    ciphertext: message.ciphertext,
    iv: message.iv,
    createdAt: message.created_at,
    attachment,
    reactions,
    readReceipts,
  };
}

function toInvite(invite: InviteRow): RoomInvite {
  return {
    id: invite.id,
    roomId: invite.room_id,
    token: invite.token,
    expiresAt: invite.expires_at,
    maxUses: invite.max_uses,
    uses: invite.uses,
    keyWrapCiphertext: invite.key_wrap_ciphertext,
    keyWrapIv: invite.key_wrap_iv,
  };
}

function toRoomSummary(room: RoomRow): Room {
  return {
    id: room.id,
    name: room.name,
    slug: room.slug,
    description: room.description ?? "",
    isPublic: room.is_public,
    ownerId: room.owner_id,
    members: [],
    channels: [],
    messages: [],
    invites: [],
    unreadCount: 0,
    currentRoomKeyId: room.current_room_key_id,
  };
}

export async function getDashboardData() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      currentUser: signedInUser,
      rooms: mockRooms,
      publicRooms: publicDirectory,
      contacts: mockRooms[0]?.members
        .filter((member) => member.user.id !== signedInUser.id)
        .map((member) => ({
          id: member.user.id,
          name: member.user.name,
          email: member.user.email,
          avatarUrl: member.user.avatarUrl,
          sharedRooms: 1,
          isOnline: member.user.isOnline ?? false,
          lastSeenAt: member.user.lastSeenAt,
        })) satisfies DashboardContact[],
      configured: false,
      authenticated: false,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      currentUser: null,
      rooms: [],
      publicRooms: publicDirectory,
      contacts: [] as DashboardContact[],
      configured: true,
      authenticated: false,
    };
  }

  const [{ data: profile }, { data: memberships }, { data: publicRooms }] = await Promise.all([
    supabase.from("users").select("*").eq("id", user.id).maybeSingle<UserRow>(),
    supabase.from("room_members").select("*").eq("user_id", user.id).returns<MemberRow[]>(),
    supabase.from("rooms").select("*").eq("is_public", true).returns<RoomRow[]>(),
  ]);

  const roomIds = memberships?.map((membership) => membership.room_id) ?? [];
  const [{ data: roomRows }, { data: channelsRows }, { data: memberRows }, { data: latestMessageRows }] = await Promise.all([
    roomIds.length > 0
      ? supabase.from("rooms").select("*").in("id", roomIds).returns<RoomRow[]>()
      : Promise.resolve({ data: [] as RoomRow[] }),
    roomIds.length > 0
      ? supabase.from("room_channels").select("*").in("room_id", roomIds).order("position", { ascending: true }).returns<ChannelRow[]>()
      : Promise.resolve({ data: [] as ChannelRow[] }),
    roomIds.length > 0
      ? supabase.from("room_members").select("*").in("room_id", roomIds).returns<MemberRow[]>()
      : Promise.resolve({ data: [] as MemberRow[] }),
    roomIds.length > 0
      ? supabase
          .from("messages")
          .select("*")
          .in("room_id", roomIds)
          .order("created_at", { ascending: false })
          .returns<MessageRow[]>()
      : Promise.resolve({ data: [] as MessageRow[] }),
  ]);

  const knownUserIds = Array.from(
    new Set((memberRows ?? []).map((member) => member.user_id)),
  );
  const { data: userRows } =
    knownUserIds.length > 0
      ? await supabase.from("users").select("*").in("id", knownUserIds).returns<UserRow[]>()
      : { data: [] as UserRow[] };

  const currentUser = profile ? toUserProfile(profile) : null;
  const channelsByRoom = new Map<string, RoomChannel[]>();
  for (const channel of channelsRows ?? []) {
    const current = channelsByRoom.get(channel.room_id) ?? [];
    current.push(toChannel(channel));
    channelsByRoom.set(channel.room_id, current);
  }
  const latestMessageByRoom = new Map<string, MessageRow>();
  for (const message of latestMessageRows ?? []) {
    if (!latestMessageByRoom.has(message.room_id)) {
      latestMessageByRoom.set(message.room_id, message);
    }
  }
  const userMap = new Map((userRows ?? []).map((entry) => [entry.id, toUserProfile(entry)]));
  const membersByRoom = new Map<string, RoomMember[]>();
  for (const member of memberRows ?? []) {
    const current = membersByRoom.get(member.room_id) ?? [];
    current.push({
      id: `${member.room_id}:${member.user_id}`,
      user: userMap.get(member.user_id) ?? fallbackProfile(member.user_id, "Contato"),
      role: member.role,
      joinedAt: member.joined_at,
      encryptedRoomKey: member.encrypted_room_key,
      currentRoomKeyId: member.current_room_key_id,
    });
    membersByRoom.set(member.room_id, current);
  }

  const rooms: Room[] = (roomRows ?? []).map((room) => ({
    ...toRoomSummary(room),
    channels: channelsByRoom.get(room.id) ?? [],
    members: membersByRoom.get(room.id) ?? [],
    messages: latestMessageByRoom.has(room.id)
      ? [
          toMessage(
            latestMessageByRoom.get(room.id) as MessageRow,
            userMap.get((latestMessageByRoom.get(room.id) as MessageRow).user_id) ??
              fallbackProfile((latestMessageByRoom.get(room.id) as MessageRow).user_id),
            undefined,
            [],
            [],
          ),
        ]
      : [],
  }));

  const directRoomByUserId = new Map<string, string>();
  for (const room of rooms) {
    if (room.isPublic || room.members.length !== 2 || !currentUser) continue;
    const peer = room.members.find((member) => member.user.id !== currentUser.id);
    if (peer) directRoomByUserId.set(peer.user.id, room.slug);
  }

  const contactsById = new Map<string, DashboardContact>();
  for (const room of rooms) {
    for (const member of room.members) {
      if (!currentUser || member.user.id === currentUser.id) continue;
      const existing = contactsById.get(member.user.id);
      contactsById.set(member.user.id, {
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        avatarUrl: member.user.avatarUrl,
        publicKey: member.user.publicKey,
        sharedRooms: (existing?.sharedRooms ?? 0) + 1,
        directRoomSlug: directRoomByUserId.get(member.user.id),
        lastSeenAt: member.user.lastSeenAt,
        isOnline: member.user.isOnline,
      });
    }
  }
  const contacts = Array.from(contactsById.values()).sort((a, b) => a.name.localeCompare(b.name));

  return {
    currentUser,
    rooms,
    publicRooms: publicRooms?.map(toRoomSummary) ?? [],
    contacts,
    configured: true,
    authenticated: true,
  };
}

export async function getRoomBySlug(slug: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockRooms.find((room) => room.slug === slug) ?? null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: room } = await supabase.from("rooms").select("*").eq("slug", slug).maybeSingle<RoomRow>();
  if (!room) return null;

  const [{ data: memberRows }, { data: channelRows }, { data: messageRows }, { data: inviteRows }, { data: roomKeyRows }, { data: memberKeyRows }] = await Promise.all([
    supabase.from("room_members").select("*").eq("room_id", room.id).returns<MemberRow[]>(),
    supabase.from("room_channels").select("*").eq("room_id", room.id).order("position", { ascending: true }).returns<ChannelRow[]>(),
    supabase
      .from("messages")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
      .returns<MessageRow[]>(),
    supabase.from("room_invites").select("*").eq("room_id", room.id).returns<InviteRow[]>(),
    supabase.from("room_keys").select("*").eq("room_id", room.id).order("version", { ascending: true }).returns<RoomKeyRow[]>(),
    user
      ? supabase.from("room_member_keys").select("*").eq("room_id", room.id).eq("user_id", user.id).returns<RoomMemberKeyRow[]>()
      : Promise.resolve({ data: [] as RoomMemberKeyRow[] }),
  ]);

  const messageIds = messageRows?.map((message) => message.id) ?? [];
  const [{ data: fileRows }, { data: reactionRows }, { data: readRows }] = await Promise.all([
    messageIds.length > 0
      ? supabase.from("files").select("*").in("message_id", messageIds).returns<FileRow[]>()
      : Promise.resolve({ data: [] as FileRow[] }),
    messageIds.length > 0
      ? supabase.from("reactions").select("*").in("message_id", messageIds).returns<ReactionRow[]>()
      : Promise.resolve({ data: [] as ReactionRow[] }),
    messageIds.length > 0
      ? supabase.from("message_reads").select("*").in("message_id", messageIds).returns<MessageReadRow[]>()
      : Promise.resolve({ data: [] as MessageReadRow[] }),
  ]);

  const userIds = Array.from(new Set([...(memberRows?.map((member) => member.user_id) ?? []), ...(messageRows?.map((message) => message.user_id) ?? [])]));
  const { data: userRows } =
    userIds.length > 0
      ? await supabase.from("users").select("*").in("id", userIds).returns<UserRow[]>()
      : { data: [] as UserRow[] };

  const userMap = new Map((userRows ?? []).map((user) => [user.id, toUserProfile(user)]));
  const channels = (channelRows ?? []).map(toChannel);
  const members: RoomMember[] = (memberRows ?? []).map((member) => ({
    id: `${member.room_id}:${member.user_id}`,
    user: userMap.get(member.user_id) ?? fallbackProfile(member.user_id, "Membro"),
    role: member.role,
    joinedAt: member.joined_at,
    encryptedRoomKey: member.encrypted_room_key,
    currentRoomKeyId: member.current_room_key_id,
  }));
  const keyAccesses: RoomKeyAccess[] = (memberKeyRows ?? []).map((entry) => ({
    roomKeyId: entry.room_key_id,
    encryptedRoomKey: entry.encrypted_room_key,
    createdAt: entry.created_at,
  }));

  const fileByMessageId = new Map(
    (fileRows ?? []).map((file) => [
      file.message_id,
      {
        id: file.id,
        name: file.name,
        size: Number(file.size),
        mimeType: file.type,
        storagePath: file.storage_path,
        iv: file.iv,
        encrypted: file.encrypted,
      } satisfies ChatMessage["attachment"],
    ]),
  );

  const reactionsByMessageId = new Map<string, ReactionRow[]>();
  for (const reaction of reactionRows ?? []) {
    const current = reactionsByMessageId.get(reaction.message_id) ?? [];
    current.push(reaction);
    reactionsByMessageId.set(reaction.message_id, current);
  }
  const readsByMessageId = new Map<string, MessageReadRow[]>();
  for (const readEntry of readRows ?? []) {
    const current = readsByMessageId.get(readEntry.message_id) ?? [];
    current.push(readEntry);
    readsByMessageId.set(readEntry.message_id, current);
  }

  const messages = (messageRows ?? []).map((message) => {
    const grouped = reactionsByMessageId.get(message.id) ?? [];
    const groupedReactions = new Map<string, ReactionRow[]>();
    for (const reaction of grouped) {
      const current = groupedReactions.get(reaction.emoji) ?? [];
      current.push(reaction);
      groupedReactions.set(reaction.emoji, current);
    }

    return toMessage(
      message,
      userMap.get(message.user_id) ?? fallbackProfile(message.user_id),
      fileByMessageId.get(message.id),
      Array.from(groupedReactions.entries()).map(
        ([emoji, entries]) =>
          ({
            emoji,
            count: entries.length,
            reactedByCurrentUser: entries.some((entry) => entry.user_id === user?.id),
          }) satisfies MessageReaction,
      ),
      (readsByMessageId.get(message.id) ?? []).map(
        (entry) =>
          ({
            userId: entry.user_id,
            readAt: entry.read_at,
          }) satisfies MessageReadReceipt,
      ),
    );
  });

  const currentMembership = members.find((member) => member.user.id === user?.id);
  const currentRoomKey = (roomKeyRows ?? []).find((entry) => entry.id === room.current_room_key_id) ?? null;

  return {
    id: room.id,
    name: room.name,
    slug: room.slug,
    description: room.description ?? "",
    isPublic: room.is_public,
    ownerId: room.owner_id,
    members,
    channels,
    messages,
    invites: (inviteRows ?? []).map(toInvite),
    unreadCount: 0,
    currentUserId: user?.id,
    currentUserRole: currentMembership?.role ?? null,
    currentRoomKeyId: room.current_room_key_id,
    currentRoomKeyVersion: currentRoomKey?.version ?? null,
    keyAccesses,
  } satisfies Room;
}

export async function getInviteByToken(token: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: invite } = await supabase.from("room_invites").select("*").eq("token", token).maybeSingle<InviteRow>();
  if (!invite) return null;

  const { data: room } = await supabase.from("rooms").select("*").eq("id", invite.room_id).maybeSingle<RoomRow>();
  if (!room) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: members } = user
    ? await supabase
        .from("room_members")
        .select("*")
        .eq("room_id", room.id)
        .eq("user_id", user.id)
        .returns<MemberRow[]>()
    : { data: [] as MemberRow[] };

  return {
    invite: toInvite(invite),
    room: {
      id: room.id,
      name: room.name,
      slug: room.slug,
      description: room.description ?? "",
      isPublic: room.is_public,
      currentRoomKeyId: room.current_room_key_id,
    },
    authenticated: Boolean(user),
    isMember: (members ?? []).length > 0,
  };
}
