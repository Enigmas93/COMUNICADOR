"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Route } from "next";
import Link from "next/link";
import { Download, LockKeyhole, Paperclip, Send, Settings, SmilePlus, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  decodeBase64,
  decryptBinaryBytes,
  decryptMessage,
  encryptBinary,
  encryptMessage,
  openRoomKeyEnvelope,
} from "@/lib/crypto/e2ee";
import { loadStoredIdentity } from "@/lib/crypto/identity-store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatBytes, formatRelativeDate } from "@/lib/utils";
import type { ChatMessage, Room } from "@/types/domain";
import type { Database } from "@/types/supabase";

const reactionOptions = ["👍", "🔥", "✅", "🚀"];

function avatarFromName(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

export function ChatShell({ room }: { room: Room }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [activeChannelId, setActiveChannelId] = useState(room.channels[0]?.id ?? "");
  const [roomKeys, setRoomKeys] = useState<Record<string, string>>({});
  const [currentRoomKeyId, setCurrentRoomKeyId] = useState<string | null>(room.currentRoomKeyId ?? null);
  const [decryptedBodies, setDecryptedBodies] = useState<Record<string, string>>({});
  const [liveMessages, setLiveMessages] = useState(() => room.messages);
  const [liveChannels, setLiveChannels] = useState(() => room.channels);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingMessageId, setDownloadingMessageId] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

  const visibleMessages = useMemo(
    () => liveMessages.filter((message) => message.channelId === activeChannelId),
    [activeChannelId, liveMessages],
  );
  const activeChannel = useMemo(
    () => liveChannels.find((channel) => channel.id === activeChannelId) ?? liveChannels[0] ?? null,
    [activeChannelId, liveChannels],
  );
  const roomKey = currentRoomKeyId ? roomKeys[currentRoomKeyId] ?? null : null;

  useEffect(() => {
    if (!supabase) return;

    let active = true;

    const bootstrapKeys = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const identity = loadStoredIdentity(user.id);
      if (!identity) return;

      const accessEntries = room.keyAccesses ?? [];
      const decryptedEntries = await Promise.all(
        accessEntries.map(async (entry) => ({
          roomKeyId: entry.roomKeyId,
          roomKey: await openRoomKeyEnvelope(entry.encryptedRoomKey, identity.publicKey, identity.privateKey),
        })),
      );

      if (active) {
        setRoomKeys(
          decryptedEntries.reduce<Record<string, string>>((accumulator, entry) => {
            accumulator[entry.roomKeyId] = entry.roomKey;
            return accumulator;
          }, {}),
        );
      }
    };

    void bootstrapKeys();

    return () => {
      active = false;
    };
  }, [room.keyAccesses, supabase]);

  useEffect(() => {
    if (Object.keys(roomKeys).length === 0) return;

    let active = true;

    const decryptAll = async () => {
      const nextBodies: Record<string, string> = {};

      for (const message of liveMessages) {
        if (message.ciphertext && message.iv) {
          try {
            const messageRoomKey = (message.roomKeyId ? roomKeys[message.roomKeyId] : null) ?? roomKey;
            if (!messageRoomKey) {
              nextBodies[message.id] = "[Chave indisponivel para esta mensagem]";
              continue;
            }
            nextBodies[message.id] = await decryptMessage(
              { ciphertext: message.ciphertext, nonce: message.iv },
              messageRoomKey,
            );
          } catch {
            nextBodies[message.id] = "[Nao foi possivel decifrar a mensagem]";
          }
        } else {
          nextBodies[message.id] = message.body;
        }
      }

      if (active) setDecryptedBodies(nextBodies);
    };

    void decryptAll();

    return () => {
      active = false;
    };
  }, [liveMessages, roomKey, roomKeys]);

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`room:${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${room.id}`,
        },
        ({ new: payload }) => {
          const row = payload as Database["public"]["Tables"]["rooms"]["Row"];
          setCurrentRoomKeyId(row.current_room_key_id);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${room.id}`,
        },
        async ({ new: payload }) => {
          const row = payload as Database["public"]["Tables"]["messages"]["Row"];
          const { data: authors } = await supabase
            .from("users")
            .select("*")
            .eq("id", row.user_id)
            .returns<Database["public"]["Tables"]["users"]["Row"][]>();
          const author = authors?.[0] ?? null;

          setLiveMessages((current) => {
            if (current.some((message) => message.id === row.id)) return current;

            return [
              ...current,
              {
                id: row.id,
                roomId: row.room_id,
                channelId: row.channel_id ?? activeChannelId,
                roomKeyId: row.room_key_id,
                author: author
                  ? {
                      id: author.id,
                      name: author.name,
                      email: author.email,
                      avatarUrl: author.avatar_url ?? avatarFromName(author.name),
                    }
                  : {
                      id: row.user_id,
                      name: "Usuario",
                      email: "",
                      avatarUrl: avatarFromName("Usuario"),
                    },
                type: row.type,
                body: "",
                ciphertext: row.ciphertext,
                iv: row.iv,
                createdAt: row.created_at,
                reactions: [],
              },
            ];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_member_keys",
          filter: `room_id=eq.${room.id}`,
        },
        async ({ new: payload }) => {
          const row = payload as Database["public"]["Tables"]["room_member_keys"]["Row"];
          if (row.user_id !== room.currentUserId) return;

          const identity = room.currentUserId ? loadStoredIdentity(room.currentUserId) : null;
          if (!identity) return;

          try {
            const decryptedRoomKey = await openRoomKeyEnvelope(
              row.encrypted_room_key,
              identity.publicKey,
              identity.privateKey,
            );
            setRoomKeys((current) => ({
              ...current,
              [row.room_key_id]: decryptedRoomKey,
            }));
          } catch {
            toast.error("Recebi uma nova chave da sala, mas nao consegui abri-la neste dispositivo.");
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "room_members",
          filter: `room_id=eq.${room.id}`,
        },
        ({ old: payload }) => {
          const row = payload as Database["public"]["Tables"]["room_members"]["Row"];
          if (row.user_id !== room.currentUserId) return;

          toast.error("Seu acesso a esta sala foi removido.");
          router.replace("/dashboard" as Route);
          router.refresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_channels",
          filter: `room_id=eq.${room.id}`,
        },
        ({ new: payload }) => {
          const row = payload as Database["public"]["Tables"]["room_channels"]["Row"];
          setActiveChannelId((current) => current || row.id);
          setLiveChannels((current) => {
            if (current.some((entry) => entry.id === row.id)) return current;
            return [
              ...current,
              {
                id: row.id,
                roomId: row.room_id,
                name: row.name,
                slug: row.slug,
                description: row.description ?? "",
                kind: row.kind,
                position: row.position,
              },
            ].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "files",
          filter: `room_id=eq.${room.id}`,
        },
        ({ new: payload }) => {
          const row = payload as Database["public"]["Tables"]["files"]["Row"];
          setLiveMessages((current) =>
            current.map((message) =>
              message.id === row.message_id
                ? {
                    ...message,
                    attachment: {
                      id: row.id,
                      name: row.name,
                      size: Number(row.size),
                      mimeType: row.type,
                      storagePath: row.storage_path,
                      iv: row.iv,
                      encrypted: row.encrypted,
                    },
                  }
                : message,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reactions",
        },
        ({ new: payload }) => {
          const row = payload as Database["public"]["Tables"]["reactions"]["Row"];
          setLiveMessages((current) =>
            current.map((message) => {
              if (message.id !== row.message_id) return message;
              const existing = message.reactions ?? [];
              const match = existing.find((entry) => entry.emoji === row.emoji);
              if (match) {
                return {
                  ...message,
                  reactions: existing.map((entry) =>
                    entry.emoji === row.emoji
                      ? {
                          ...entry,
                          count: entry.count + 1,
                          reactedByCurrentUser:
                            entry.reactedByCurrentUser || row.user_id === room.currentUserId,
                        }
                      : entry,
                  ),
                };
              }
              return {
                ...message,
                reactions: [
                  ...existing,
                  {
                    emoji: row.emoji,
                    count: 1,
                    reactedByCurrentUser: row.user_id === room.currentUserId,
                  },
                ],
              };
            }),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "reactions",
        },
        ({ old: payload }) => {
          const row = payload as Database["public"]["Tables"]["reactions"]["Row"];
          setLiveMessages((current) =>
            current.map((message) => {
              if (message.id !== row.message_id) return message;
              const existing = message.reactions ?? [];
              return {
                ...message,
                reactions: existing
                  .map((entry) =>
                    entry.emoji === row.emoji
                      ? {
                          ...entry,
                          count: Math.max(0, entry.count - 1),
                          reactedByCurrentUser:
                            row.user_id === room.currentUserId ? false : entry.reactedByCurrentUser,
                        }
                      : entry,
                  )
                  .filter((entry) => entry.count > 0),
              };
            }),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeChannelId, room.currentUserId, room.id, router, supabase]);

  const toggleReaction = async (message: ChatMessage, emoji: string) => {
    if (!supabase) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Sua sessao expirou.");
      router.push("/login" as Route);
      return;
    }

    const currentReaction = message.reactions?.find((entry) => entry.emoji === emoji);
    if (currentReaction?.reactedByCurrentUser) {
      const { error } = await supabase
        .from("reactions")
        .delete()
        .eq("message_id", message.id)
        .eq("user_id", user.id)
        .eq("emoji", emoji);
      if (error) toast.error(error.message);
      return;
    }

    const payload = [
      {
        message_id: message.id,
        user_id: user.id,
        emoji,
      } satisfies Database["public"]["Tables"]["reactions"]["Insert"],
    ];
    const { error } = await supabase.from("reactions").insert(payload as never);
    if (error) toast.error(error.message);
  };

  const downloadAttachment = async (message: ChatMessage) => {
    const messageRoomKey = (message.roomKeyId ? roomKeys[message.roomKeyId] : null) ?? roomKey;
    if (!supabase || !messageRoomKey || !message.attachment?.storagePath || !message.attachment.iv) {
      toast.error("Anexo indisponivel para download.");
      return;
    }

    setDownloadingMessageId(message.id);
    try {
      const { data, error } = await supabase.storage.from("room-files").download(message.attachment.storagePath);
      if (error || !data) {
        toast.error(error?.message ?? "Nao foi possivel baixar o arquivo cifrado.");
        return;
      }

      const encryptedBytes = await data.arrayBuffer();
      const cleartext = await decryptBinaryBytes(encryptedBytes, message.attachment.iv, messageRoomKey);
      const blob = new Blob([cleartext], {
        type: message.attachment.mimeType || "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = message.attachment.name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel decifrar o anexo.");
    } finally {
      setDownloadingMessageId(null);
    }
  };

  const submitMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim() && !selectedFile) return;
    if (!supabase || !roomKey || !activeChannel || !currentRoomKeyId) {
      toast.error("Sua chave da sala ainda nao esta disponivel.");
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Sua sessao expirou.");
        router.push("/login" as Route);
        return;
      }

      if (selectedFile) {
        const caption = draft.trim() || `Arquivo enviado: ${selectedFile.name}`;
        const encryptedCaption = await encryptMessage(caption, roomKey);
        const messageInsert = [
          {
            room_id: room.id,
            channel_id: activeChannel.id,
            room_key_id: currentRoomKeyId,
            user_id: user.id,
            ciphertext: encryptedCaption.ciphertext,
            iv: encryptedCaption.nonce,
            type: "file",
          } satisfies Database["public"]["Tables"]["messages"]["Insert"],
        ];
        const { data: rows, error: messageError } = await supabase
          .from("messages")
          .insert(messageInsert as never)
          .select("*")
          .returns<Database["public"]["Tables"]["messages"]["Row"][]>();

        const messageRow = rows?.[0];
        if (messageError || !messageRow) {
          toast.error(messageError?.message ?? "Nao foi possivel registrar a mensagem do arquivo.");
          return;
        }

        const fileBuffer = await selectedFile.arrayBuffer();
        const encryptedFile = await encryptBinary(fileBuffer, roomKey, selectedFile.type);
        const storagePath = `${room.id}/${activeChannel.id}/${messageRow.id}/${Date.now()}-${selectedFile.name}.bin`;
        const uploadPayload = new Blob([decodeBase64(encryptedFile.ciphertext)], {
          type: "application/octet-stream",
        });
        const { error: uploadError } = await supabase.storage.from("room-files").upload(storagePath, uploadPayload, {
          contentType: "application/octet-stream",
          upsert: false,
        });

        if (uploadError) {
          toast.error(uploadError.message);
          return;
        }

        const fileInsert = [
          {
            message_id: messageRow.id,
            room_id: room.id,
            channel_id: activeChannel.id,
            storage_path: storagePath,
            encrypted: true,
            iv: encryptedFile.nonce,
            size: selectedFile.size,
            type: selectedFile.type || "application/octet-stream",
            name: selectedFile.name,
          } satisfies Database["public"]["Tables"]["files"]["Insert"],
        ];
        const { error: fileError } = await supabase.from("files").insert(fileInsert as never);

        if (fileError) {
          toast.error(fileError.message);
          return;
        }

        setDraft("");
        setSelectedFile(null);
        toast.success("Arquivo cifrado e enviado.");
        return;
      }

      const payload = await encryptMessage(draft.trim(), roomKey);
      const messagePayload = [
        {
          room_id: room.id,
          channel_id: activeChannel.id,
          room_key_id: currentRoomKeyId,
          user_id: user.id,
          ciphertext: payload.ciphertext,
          iv: payload.nonce,
          type: "text",
        } satisfies Database["public"]["Tables"]["messages"]["Insert"],
      ];
      const { error } = await supabase.from("messages").insert(messagePayload as never);

      if (error) {
        toast.error(error.message);
        return;
      }

      setDraft("");
      toast.success("Mensagem cifrada e enviada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel enviar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
      <Card className="h-fit">
        <CardHeader>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Canais</p>
          <h1 className="text-2xl font-semibold text-white">{room.name}</h1>
          <p className="text-sm leading-6 text-zinc-400">{room.description}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {liveChannels.map((channel) => (
            <button
              key={channel.id}
              type="button"
              onClick={() => setActiveChannelId(channel.id)}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition ${activeChannelId === channel.id ? "border-cyan-400/60 bg-cyan-400/10" : "border-white/10 bg-white/5"}`}
            >
              <p className="font-medium text-white">#{channel.name}</p>
              <p className="mt-1 text-sm text-zinc-400">{channel.description}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="min-h-[720px]">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-white">#{activeChannel?.name ?? "canal"}</h2>
              <Badge>{room.isPublic ? "Publica" : "Privada"}</Badge>
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              Realtime via Supabase, decifragem local no cliente e historico paginado por canal.
            </p>
          </div>
          {room.currentUserRole === "admin" ? (
            <Button asChild variant="secondary">
              <Link href={`/rooms/${room.slug}/settings` as Route}>
                <Settings className="mr-2 size-4" />
                Configuracoes
              </Link>
            </Button>
          ) : null}
        </CardHeader>

        <CardContent className="flex h-full flex-col gap-5">
          <div className="flex-1 space-y-4 overflow-hidden rounded-[24px] border border-white/10 bg-black/20 p-4">
            <AnimatePresence initial={false}>
              {visibleMessages.map((message) => (
                <motion.article
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="rounded-3xl border border-white/8 bg-white/[0.03] p-4"
                >
                  <div className="flex items-start gap-3">
                    <Avatar>
                      <AvatarFallback className="flex size-full items-center justify-center bg-cyan-400/20 text-sm font-semibold text-cyan-200">
                        {message.author.avatarUrl}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-white">{message.author.name}</p>
                        <span className="text-xs text-zinc-500">{formatRelativeDate(message.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-zinc-300">
                        {decryptedBodies[message.id] ?? (message.ciphertext ? "Decifrando..." : message.body)}
                      </p>
                      {message.attachment ? (
                        <button
                          type="button"
                          onClick={() => void downloadAttachment(message)}
                          className="mt-4 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/70 p-3 text-left text-sm text-zinc-300 transition hover:border-cyan-400/30"
                        >
                          <div>
                            <p className="font-medium text-white">{message.attachment.name}</p>
                            <p className="mt-1 text-xs text-zinc-500">
                              {message.attachment.mimeType} • {formatBytes(message.attachment.size)}
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-2 text-cyan-200">
                            <Download className="size-4" />
                            {downloadingMessageId === message.id ? "Baixando..." : "Abrir"}
                          </span>
                        </button>
                      ) : null}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {(message.reactions ?? []).map((reaction) => (
                          <button
                            key={`${message.id}:${reaction.emoji}`}
                            type="button"
                            onClick={() => void toggleReaction(message, reaction.emoji)}
                            className={`rounded-full border px-3 py-1 text-xs transition ${
                              reaction.reactedByCurrentUser
                                ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-100"
                                : "border-white/10 bg-white/5 text-zinc-300"
                            }`}
                          >
                            {reaction.emoji} {reaction.count}
                          </button>
                        ))}
                        <div className="flex items-center gap-2">
                          {reactionOptions.map((emoji) => (
                            <button
                              key={`${message.id}:picker:${emoji}`}
                              type="button"
                              onClick={() => void toggleReaction(message, emoji)}
                              className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300 transition hover:border-cyan-400/30 hover:text-white"
                            >
                              {emoji}
                            </button>
                          ))}
                          <SmilePlus className="size-4 text-zinc-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>

          <form className="rounded-[24px] border border-white/10 bg-white/5 p-4" onSubmit={(event) => void submitMessage(event)}>
            <label className="mb-3 block text-sm font-medium text-zinc-200" htmlFor="draft">
              Nova mensagem
            </label>
            <div className="space-y-3">
              <div className="flex gap-3">
                <Input
                  id="draft"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={selectedFile ? "Adicione uma legenda opcional..." : "Escreva algo para o canal..."}
                />
                <Button type="submit" size="icon" aria-label="Enviar" disabled={submitting}>
                  <Send className="size-4" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200">
                  <Paperclip className="size-4" />
                  Anexar arquivo
                  <Input
                    type="file"
                    className="hidden"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  />
                </label>
                {selectedFile ? (
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100">
                    <span>{selectedFile.name}</span>
                    <button type="button" onClick={() => setSelectedFile(null)} aria-label="Remover anexo">
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">Os anexos sobem cifrados para o bucket privado `room-files`.</p>
                )}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-cyan-300">
              <LockKeyhole className="size-4" />
              <p className="text-sm uppercase tracking-[0.18em]">E2EE</p>
            </div>
            <h3 className="text-xl font-semibold text-white">A sala protege o conteudo no cliente</h3>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-zinc-400">
            <p>O servidor valida acesso com RLS, mas nunca recebe a chave da sala em texto puro.</p>
            <p>Arquivos e mensagens entram no banco como blobs cifrados, distribuindo apenas envelopes por membro.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-cyan-300">
              <Users className="size-4" />
              <p className="text-sm uppercase tracking-[0.18em]">Membros</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {room.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="size-11">
                    <AvatarFallback className="flex size-full items-center justify-center bg-white/10 text-sm font-semibold text-zinc-200">
                      {member.user.avatarUrl}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-white">{member.user.name}</p>
                    <p className="text-xs text-zinc-500">{member.user.email}</p>
                  </div>
                </div>
                <Badge className={member.role === "admin" ? "border-cyan-400/50 text-cyan-200" : ""}>{member.role}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
