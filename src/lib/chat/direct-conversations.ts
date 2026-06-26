"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

const PLAIN_KEY = "plain-mode";

type BrowserSupabase = SupabaseClient<Database>;

function buildDirectConversationName(currentUserName: string, contactName: string) {
  return `${currentUserName} + ${contactName}`;
}

export async function createDirectConversation({
  supabase,
  currentUserId,
  currentUserName,
  contactId,
  contactName,
}: {
  supabase: BrowserSupabase;
  currentUserId: string;
  currentUserName: string;
  contactId: string;
  contactName: string;
}) {
  const roomId = crypto.randomUUID();
  const roomKeyId = crypto.randomUUID();
  const channelId = crypto.randomUUID();
  const slug = `chat-${crypto.randomUUID().slice(0, 8)}`;

  const roomPayload = [
    {
      id: roomId,
      name: buildDirectConversationName(currentUserName, contactName),
      slug,
      description: `Conversa privada entre ${currentUserName} e ${contactName}.`,
      is_public: false,
      owner_id: currentUserId,
    } satisfies Database["public"]["Tables"]["rooms"]["Insert"],
  ];
  const { error: roomError } = await supabase.from("rooms").insert(roomPayload as never);
  if (roomError) throw roomError;

  const roomKeyPayload = [
    {
      id: roomKeyId,
      room_id: roomId,
      version: 1,
      created_by: currentUserId,
    } satisfies Database["public"]["Tables"]["room_keys"]["Insert"],
  ];
  const { error: roomKeyError } = await supabase.from("room_keys").insert(roomKeyPayload as never);
  if (roomKeyError) throw roomKeyError;

  const memberPayload = [
    {
      room_id: roomId,
      user_id: currentUserId,
      role: "admin",
      encrypted_room_key: PLAIN_KEY,
      current_room_key_id: roomKeyId,
    },
    {
      room_id: roomId,
      user_id: contactId,
      role: "member",
      encrypted_room_key: PLAIN_KEY,
      current_room_key_id: roomKeyId,
    },
  ] satisfies Database["public"]["Tables"]["room_members"]["Insert"][];
  const { error: memberError } = await supabase.from("room_members").insert(memberPayload as never);
  if (memberError) throw memberError;

  const { error: roomUpdateError } = await supabase
    .from("rooms")
    .update({ current_room_key_id: roomKeyId } as never)
    .eq("id", roomId);
  if (roomUpdateError) throw roomUpdateError;

  const memberKeyPayload = [
    {
      room_key_id: roomKeyId,
      room_id: roomId,
      user_id: currentUserId,
      encrypted_room_key: PLAIN_KEY,
    },
    {
      room_key_id: roomKeyId,
      room_id: roomId,
      user_id: contactId,
      encrypted_room_key: PLAIN_KEY,
    },
  ] satisfies Database["public"]["Tables"]["room_member_keys"]["Insert"][];
  const { error: memberKeyError } = await supabase.from("room_member_keys").insert(memberKeyPayload as never);
  if (memberKeyError) throw memberKeyError;

  const channelPayload = [
    {
      id: channelId,
      room_id: roomId,
      name: "mensagens",
      slug: "mensagens",
      description: "Conversa privada entre contatos conhecidos.",
      kind: "general",
      position: 0,
      created_by: currentUserId,
    } satisfies Database["public"]["Tables"]["room_channels"]["Insert"],
  ];
  const { error: channelError } = await supabase.from("room_channels").insert(channelPayload as never);
  if (channelError) throw channelError;

  return { roomId, roomKeyId, slug };
}

export async function createInviteConversation({
  supabase,
  currentUserId,
  currentUserName,
}: {
  supabase: BrowserSupabase;
  currentUserId: string;
  currentUserName: string;
}) {
  const roomId = crypto.randomUUID();
  const roomKeyId = crypto.randomUUID();
  const channelId = crypto.randomUUID();
  const slug = `chat-${crypto.randomUUID().slice(0, 8)}`;
  const token = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

  const roomPayload = [
    {
      id: roomId,
      name: `Convite de ${currentUserName}`,
      slug,
      description: "Conversa privada criada a partir de convite por link.",
      is_public: false,
      owner_id: currentUserId,
    } satisfies Database["public"]["Tables"]["rooms"]["Insert"],
  ];
  const { error: roomError } = await supabase.from("rooms").insert(roomPayload as never);
  if (roomError) throw roomError;

  const roomKeyPayload = [
    {
      id: roomKeyId,
      room_id: roomId,
      version: 1,
      created_by: currentUserId,
    } satisfies Database["public"]["Tables"]["room_keys"]["Insert"],
  ];
  const { error: roomKeyError } = await supabase.from("room_keys").insert(roomKeyPayload as never);
  if (roomKeyError) throw roomKeyError;

  const memberPayload = [
    {
      room_id: roomId,
      user_id: currentUserId,
      role: "admin",
      encrypted_room_key: PLAIN_KEY,
      current_room_key_id: roomKeyId,
    } satisfies Database["public"]["Tables"]["room_members"]["Insert"],
  ];
  const { error: memberError } = await supabase.from("room_members").insert(memberPayload as never);
  if (memberError) throw memberError;

  const { error: roomUpdateError } = await supabase
    .from("rooms")
    .update({ current_room_key_id: roomKeyId } as never)
    .eq("id", roomId);
  if (roomUpdateError) throw roomUpdateError;

  const memberKeyPayload = [
    {
      room_key_id: roomKeyId,
      room_id: roomId,
      user_id: currentUserId,
      encrypted_room_key: PLAIN_KEY,
    } satisfies Database["public"]["Tables"]["room_member_keys"]["Insert"],
  ];
  const { error: memberKeyError } = await supabase.from("room_member_keys").insert(memberKeyPayload as never);
  if (memberKeyError) throw memberKeyError;

  const channelPayload = [
    {
      id: channelId,
      room_id: roomId,
      name: "mensagens",
      slug: "mensagens",
      description: "Conversa privada criada por convite.",
      kind: "general",
      position: 0,
      created_by: currentUserId,
    } satisfies Database["public"]["Tables"]["room_channels"]["Insert"],
  ];
  const { error: channelError } = await supabase.from("room_channels").insert(channelPayload as never);
  if (channelError) throw channelError;

  const invitePayload = [
    {
      room_id: roomId,
      token,
      created_by: currentUserId,
      expires_at: expiresAt,
      max_uses: 1,
      key_wrap_ciphertext: null,
      key_wrap_iv: null,
    } satisfies Database["public"]["Tables"]["room_invites"]["Insert"],
  ];
  const { error: inviteError } = await supabase.from("room_invites").insert(invitePayload as never);
  if (inviteError) throw inviteError;

  return { slug, token };
}
