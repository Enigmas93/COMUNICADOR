import { mockRooms, publicDirectory, signedInUser } from "@/lib/data/mock";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ChatMessage, Room, RoomInvite, RoomMember, UserProfile } from "@/types/domain";
import type { Database } from "@/types/supabase";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
type RoomRow = Database["public"]["Tables"]["rooms"]["Row"];
type MemberRow = Database["public"]["Tables"]["room_members"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
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

function toMessage(message: MessageRow, author: UserProfile): ChatMessage {
  return {
    id: message.id,
    roomId: message.room_id,
    channelId: "general",
    author,
    type: message.type,
    body: "",
    ciphertext: message.ciphertext,
    iv: message.iv,
    createdAt: message.created_at,
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
  const { data: roomRows } =
    roomIds.length > 0
      ? await supabase.from("rooms").select("*").in("id", roomIds).returns<RoomRow[]>()
      : { data: [] as RoomRow[] };

  const currentUser = profile ? toUserProfile(profile) : null;
  const rooms: Room[] = (roomRows ?? []).map((room) => ({
    id: room.id,
    name: room.name,
    slug: room.slug,
    description: room.description ?? "",
    isPublic: room.is_public,
    ownerId: room.owner_id,
    members: [],
    channels: [{ id: "general", name: "geral", description: "Canal principal da sala", kind: "general" }],
    messages: [],
    invites: [],
    unreadCount: 0,
  }));

  return {
    currentUser,
    rooms,
    publicRooms:
      publicRooms?.map((room) => ({
        id: room.id,
        name: room.name,
        slug: room.slug,
        description: room.description ?? "",
        isPublic: room.is_public,
        ownerId: room.owner_id,
        members: [],
        channels: [{ id: "general", name: "geral", description: "Canal principal da sala", kind: "general" }],
        messages: [],
        invites: [],
        unreadCount: 0,
      })) ?? [],
    configured: true,
    authenticated: true,
  };
}

export async function getRoomBySlug(slug: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockRooms.find((room) => room.slug === slug) ?? null;
  }

  const { data: room } = await supabase.from("rooms").select("*").eq("slug", slug).maybeSingle<RoomRow>();
  if (!room) return null;

  const [{ data: memberRows }, { data: messageRows }, { data: inviteRows }] = await Promise.all([
    supabase.from("room_members").select("*").eq("room_id", room.id).returns<MemberRow[]>(),
    supabase
      .from("messages")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
      .returns<MessageRow[]>(),
    supabase.from("room_invites").select("*").eq("room_id", room.id).returns<InviteRow[]>(),
  ]);

  const userIds = Array.from(new Set([...(memberRows?.map((member) => member.user_id) ?? []), ...(messageRows?.map((message) => message.user_id) ?? [])]));
  const { data: userRows } =
    userIds.length > 0
      ? await supabase.from("users").select("*").in("id", userIds).returns<UserRow[]>()
      : { data: [] as UserRow[] };

  const userMap = new Map((userRows ?? []).map((user) => [user.id, toUserProfile(user)]));
  const members: RoomMember[] = (memberRows ?? []).map((member) => ({
    id: `${member.room_id}:${member.user_id}`,
    user: userMap.get(member.user_id) ?? {
      id: member.user_id,
      name: "Membro",
      email: "",
      avatarUrl: "MB",
    },
    role: member.role,
    joinedAt: member.joined_at,
    encryptedRoomKey: member.encrypted_room_key,
  }));

  const messages = (messageRows ?? []).map((message) =>
    toMessage(
      message,
      userMap.get(message.user_id) ?? {
        id: message.user_id,
        name: "Usuario",
        email: "",
        avatarUrl: "US",
      },
    ),
  );

  return {
    id: room.id,
    name: room.name,
    slug: room.slug,
    description: room.description ?? "",
    isPublic: room.is_public,
    ownerId: room.owner_id,
    members,
    channels: [{ id: "general", name: "geral", description: "Canal principal da sala", kind: "general" }],
    messages,
    invites: (inviteRows ?? []).map(toInvite),
    unreadCount: 0,
  } satisfies Room;
}
