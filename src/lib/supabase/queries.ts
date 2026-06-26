import { mockRooms, publicDirectory, signedInUser } from "@/lib/data/mock";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ChatMessage, MessageReaction, Room, RoomChannel, RoomInvite, RoomMember, UserProfile } from "@/types/domain";
import type { Database } from "@/types/supabase";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
type RoomRow = Database["public"]["Tables"]["rooms"]["Row"];
type MemberRow = Database["public"]["Tables"]["room_members"]["Row"];
type ChannelRow = Database["public"]["Tables"]["room_channels"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type FileRow = Database["public"]["Tables"]["files"]["Row"];
type ReactionRow = Database["public"]["Tables"]["reactions"]["Row"];
type InviteRow = Database["public"]["Tables"]["room_invites"]["Row"];

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
  };
}

function fallbackProfile(id: string, label = "Usuario"): UserProfile {
  return {
    id,
    name: label,
    email: "",
    avatarUrl: avatarFromName(label),
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
): ChatMessage {
  return {
    id: message.id,
    roomId: message.room_id,
    channelId: message.channel_id ?? "",
    author,
    type: message.type,
    body: "",
    ciphertext: message.ciphertext,
    iv: message.iv,
    createdAt: message.created_at,
    attachment,
    reactions,
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
  };
}

export async function getDashboardData() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      currentUser: signedInUser,
      rooms: mockRooms,
      publicRooms: publicDirectory,
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
  const [{ data: roomRows }, { data: channelsRows }] = await Promise.all([
    roomIds.length > 0
      ? supabase.from("rooms").select("*").in("id", roomIds).returns<RoomRow[]>()
      : Promise.resolve({ data: [] as RoomRow[] }),
    roomIds.length > 0
      ? supabase.from("room_channels").select("*").in("room_id", roomIds).order("position", { ascending: true }).returns<ChannelRow[]>()
      : Promise.resolve({ data: [] as ChannelRow[] }),
  ]);

  const currentUser = profile ? toUserProfile(profile) : null;
  const channelsByRoom = new Map<string, RoomChannel[]>();
  for (const channel of channelsRows ?? []) {
    const current = channelsByRoom.get(channel.room_id) ?? [];
    current.push(toChannel(channel));
    channelsByRoom.set(channel.room_id, current);
  }

  const rooms: Room[] = (roomRows ?? []).map((room) => ({
    ...toRoomSummary(room),
    channels: channelsByRoom.get(room.id) ?? [],
  }));

  return {
    currentUser,
    rooms,
    publicRooms: publicRooms?.map(toRoomSummary) ?? [],
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

  const [{ data: memberRows }, { data: channelRows }, { data: messageRows }, { data: inviteRows }] = await Promise.all([
    supabase.from("room_members").select("*").eq("room_id", room.id).returns<MemberRow[]>(),
    supabase.from("room_channels").select("*").eq("room_id", room.id).order("position", { ascending: true }).returns<ChannelRow[]>(),
    supabase
      .from("messages")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
      .returns<MessageRow[]>(),
    supabase.from("room_invites").select("*").eq("room_id", room.id).returns<InviteRow[]>(),
  ]);

  const messageIds = messageRows?.map((message) => message.id) ?? [];
  const [{ data: fileRows }, { data: reactionRows }] = await Promise.all([
    messageIds.length > 0
      ? supabase.from("files").select("*").in("message_id", messageIds).returns<FileRow[]>()
      : Promise.resolve({ data: [] as FileRow[] }),
    messageIds.length > 0
      ? supabase.from("reactions").select("*").in("message_id", messageIds).returns<ReactionRow[]>()
      : Promise.resolve({ data: [] as ReactionRow[] }),
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
    );
  });

  const currentMembership = members.find((member) => member.user.id === user?.id);

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
    },
    authenticated: Boolean(user),
    isMember: (members ?? []).length > 0,
  };
}
