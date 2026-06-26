"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Route } from "next";
import Link from "next/link";
import {
  Check,
  CheckCheck,
  Download,
  FileAudio,
  FileImage,
  FileText,
  FileUp,
  LockKeyhole,
  Mic,
  Paperclip,
  Send,
  SmilePlus,
  Square,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

function getAttachmentKind(mimeType: string) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.includes("pdf")) return "pdf";
  return "file";
}

function getAttachmentLabel(mimeType: string) {
  const kind = getAttachmentKind(mimeType);
  if (kind === "image") return "Foto";
  if (kind === "audio") return "Audio";
  if (kind === "pdf") return "PDF";
  return "Arquivo";
}

export function ChatShell({ room }: { room: Room }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [activeChannelId, setActiveChannelId] = useState(room.channels[0]?.id ?? "");
  const [currentRoomKeyId, setCurrentRoomKeyId] = useState<string | null>(room.currentRoomKeyId ?? null);
  const [liveMessages, setLiveMessages] = useState(() => room.messages);
  const [liveChannels, setLiveChannels] = useState(() => room.channels);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingMessageId, setDownloadingMessageId] = useState<string | null>(null);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<Record<string, string>>({});
  const [audioPreviewUrls, setAudioPreviewUrls] = useState<Record<string, string>>({});
  const [expandedImage, setExpandedImage] = useState<{ src: string; name: string } | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [recording, setRecording] = useState(false);
  const supabase = createSupabaseBrowserClient();
  const roomChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingActiveRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const visibleMessages = useMemo(
    () => liveMessages.filter((message) => message.channelId === activeChannelId),
    [activeChannelId, liveMessages],
  );
  const activeChannel = useMemo(
    () => liveChannels.find((channel) => channel.id === activeChannelId) ?? liveChannels[0] ?? null,
    [activeChannelId, liveChannels],
  );
  const decryptedBodies = useMemo(
    () =>
      liveMessages.reduce<Record<string, string>>((accumulator, message) => {
      accumulator[message.id] = message.body || message.ciphertext || "";
      return accumulator;
      }, {}),
    [liveMessages],
  );
  const activePeerNames = room.members
    .filter((member) => member.user.id !== room.currentUserId)
    .map((member) => member.user.name)
    .join(", ");
  const currentMember = room.members.find((member) => member.user.id === room.currentUserId) ?? null;
  const peerUserIds = useMemo(
    () => room.members.filter((member) => member.user.id !== room.currentUserId).map((member) => member.user.id),
    [room.currentUserId, room.members],
  );
  const typingLabel = useMemo(() => {
    const names = Object.entries(typingUsers)
      .filter(([userId]) => userId !== room.currentUserId)
      .map(([, name]) => name);
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} esta digitando...`;
    return `${names.slice(0, 2).join(", ")} estao digitando...`;
  }, [room.currentUserId, typingUsers]);

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    const createdImageUrls: string[] = [];
    const createdAudioUrls: string[] = [];

    const loadPreviews = async () => {
      const entries = await Promise.all(
        visibleMessages.map(async (message) => {
          if (!message.attachment?.storagePath) return null;
          const kind = getAttachmentKind(message.attachment.mimeType);
          if (kind !== "image" && kind !== "audio") return null;

          const { data, error } = await supabase.storage.from("room-files").download(message.attachment.storagePath);
          if (error || !data) return null;

          const url = URL.createObjectURL(data);
          if (kind === "image") {
            createdImageUrls.push(url);
          } else {
            createdAudioUrls.push(url);
          }
          return [message.id, url, kind] as const;
        }),
      );

      if (!active) {
        createdImageUrls.forEach((url) => URL.revokeObjectURL(url));
        createdAudioUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      setImagePreviewUrls((current) => {
        Object.values(current).forEach((url) => URL.revokeObjectURL(url));
        const imageEntries = entries.flatMap((entry) => (entry && entry[2] === "image" ? [[entry[0], entry[1]] as const] : []));
        return Object.fromEntries(
          imageEntries,
        );
      });
      setAudioPreviewUrls((current) => {
        Object.values(current).forEach((url) => URL.revokeObjectURL(url));
        const audioEntries = entries.flatMap((entry) => (entry && entry[2] === "audio" ? [[entry[0], entry[1]] as const] : []));
        return Object.fromEntries(
          audioEntries,
        );
      });
    };

    void loadPreviews();

    return () => {
      active = false;
      createdImageUrls.forEach((url) => URL.revokeObjectURL(url));
      createdAudioUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [supabase, visibleMessages]);

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`room:${room.id}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const data = payload as { userId?: string; name?: string; isTyping?: boolean };
        const userId = data.userId;
        const name = data.name;
        if (!userId || !name) return;

        setTypingUsers((current) => {
          if (!data.isTyping) {
            const next = { ...current };
            delete next[userId];
            return next;
          }
          return {
            ...current,
            [userId]: name,
          };
        });
      })
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
                      lastSeenAt: author.last_seen_at,
                      isOnline: Date.now() - new Date(author.last_seen_at).getTime() <= 1000 * 60 * 2,
                    }
                  : {
                      id: row.user_id,
                      name: "Usuario",
                      email: "",
                      avatarUrl: avatarFromName("Usuario"),
                    },
                type: row.type,
                body: row.ciphertext,
                ciphertext: row.ciphertext,
                iv: row.iv,
                createdAt: row.created_at,
                reactions: [],
                readReceipts: [],
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
          table: "message_reads",
        },
        ({ new: payload }) => {
          const row = payload as Database["public"]["Tables"]["message_reads"]["Row"];
          setLiveMessages((current) =>
            current.map((message) => {
              if (message.id !== row.message_id) return message;
              const existing = message.readReceipts ?? [];
              if (existing.some((entry) => entry.userId === row.user_id)) return message;
              return {
                ...message,
                readReceipts: [
                  ...existing,
                  {
                    userId: row.user_id,
                    readAt: row.read_at,
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
          event: "INSERT",
          schema: "public",
          table: "room_member_keys",
          filter: `room_id=eq.${room.id}`,
        },
        async ({ new: payload }) => {
          const row = payload as Database["public"]["Tables"]["room_member_keys"]["Row"];
          if (row.user_id !== room.currentUserId) return;
          setCurrentRoomKeyId(row.room_key_id);
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
    roomChannelRef.current = channel;

    return () => {
      roomChannelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [activeChannelId, room.currentUserId, room.id, router, supabase]);

  useEffect(() => {
    const currentUserId = room.currentUserId;
    if (!supabase || !currentUserId || visibleMessages.length === 0) return;

    const unreadIncoming = visibleMessages
      .filter((message) => message.author.id !== currentUserId)
      .filter((message) => !(message.readReceipts ?? []).some((entry) => entry.userId === currentUserId))
      .map((message) => ({
        message_id: message.id,
        user_id: currentUserId,
      } satisfies Database["public"]["Tables"]["message_reads"]["Insert"]));

    if (unreadIncoming.length === 0) return;

    void supabase.from("message_reads").insert(unreadIncoming as never);
  }, [room.currentUserId, supabase, visibleMessages]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const sendTypingState = useCallback(
    async (isTyping: boolean) => {
      const channel = roomChannelRef.current;
      if (!channel || !room.currentUserId || !currentMember) return;

      await channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId: room.currentUserId,
          name: currentMember.user.name,
          isTyping,
        },
      });
    },
    [currentMember, room.currentUserId],
  );

  useEffect(() => {
    if (!draft.trim()) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (typingActiveRef.current) {
        typingActiveRef.current = false;
        void sendTypingState(false);
      }
      return;
    }

    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      void sendTypingState(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      typingActiveRef.current = false;
      void sendTypingState(false);
    }, 1800);
  }, [draft, sendTypingState]);

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
    if (!supabase || !message.attachment?.storagePath) {
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

      const blob = data;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = message.attachment.name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel baixar o anexo.");
    } finally {
      setDownloadingMessageId(null);
    }
  };

  const submitMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim() && !selectedFile) return;
    if (!supabase || !activeChannel || !currentRoomKeyId) {
      toast.error("Esta conversa ainda nao esta pronta para enviar mensagens.");
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
        const messageInsert = [
          {
            room_id: room.id,
            channel_id: activeChannel.id,
            room_key_id: currentRoomKeyId,
            user_id: user.id,
            ciphertext: caption,
            iv: "plain",
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

        const storagePath = `${room.id}/${activeChannel.id}/${messageRow.id}/${Date.now()}-${selectedFile.name}`;
        const { error: uploadError } = await supabase.storage.from("room-files").upload(storagePath, selectedFile, {
          contentType: selectedFile.type || "application/octet-stream",
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
            encrypted: false,
            iv: "plain",
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
        toast.success("Arquivo enviado.");
        return;
      }

      const messagePayload = [
        {
          room_id: room.id,
          channel_id: activeChannel.id,
          room_key_id: currentRoomKeyId,
          user_id: user.id,
          ciphertext: draft.trim(),
          iv: "plain",
          type: "text",
        } satisfies Database["public"]["Tables"]["messages"]["Insert"],
      ];
      const { error } = await supabase.from("messages").insert(messagePayload as never);

      if (error) {
        toast.error(error.message);
        return;
      }

      setDraft("");
      if (typingActiveRef.current) {
        typingActiveRef.current = false;
        void sendTypingState(false);
      }
      toast.success("Mensagem enviada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel enviar.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAudioRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Seu navegador nao suporta gravacao de audio.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const extension = mimeType.includes("ogg") ? "ogg" : "webm";
        const audioFile = new File([blob], `audio-${Date.now()}.${extension}`, { type: mimeType });
        setSelectedFile(audioFile);
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        recordedChunksRef.current = [];
        toast.success("Audio gravado e pronto para envio.");
      };

      mediaRecorder.start();
      setRecording(true);
      toast.success("Gravacao iniciada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel iniciar a gravacao.");
    }
  };

  const peerMembers = room.members.filter((member) => member.user.id !== room.currentUserId);
  const getMessageStatus = (message: ChatMessage) => {
    const readByPeers = (message.readReceipts ?? []).filter((entry) => peerUserIds.includes(entry.userId));
    if (readByPeers.length > 0) {
      return {
        label: "Lida",
        icon: CheckCheck,
        className: "text-cyan-200",
      };
    }

    return {
      label: "Enviada",
      icon: Check,
      className: "text-zinc-400",
    };
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
      <Card className="h-fit">
        <CardHeader>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Conversa</p>
          <h1 className="text-2xl font-semibold text-white">{room.name}</h1>
          <p className="text-sm leading-6 text-zinc-400">{room.description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Participantes</p>
            <div className="mt-3 space-y-3">
              {peerMembers.slice(0, 3).map((member) => (
                <div key={member.id} className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarFallback className="flex size-full items-center justify-center bg-cyan-400/15 text-sm font-semibold text-cyan-100">
                      {member.user.avatarUrl}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{member.user.name}</p>
                    <p className="truncate text-xs text-zinc-500">{member.user.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
              <Badge>Privada</Badge>
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              Realtime via Supabase com historico simples, envio de arquivos e leitura imediata.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {activePeerNames || "Conversa particular"} {peerMembers.some((member) => member.user.isOnline) ? "• online agora" : ""}
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href={"/dashboard" as Route}>Voltar</Link>
          </Button>
        </CardHeader>

        <CardContent className="flex h-full flex-col gap-5">
          <div className="flex items-center justify-between rounded-[24px] border border-white/10 bg-white/5 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-white">{peerMembers.length > 0 ? peerMembers.map((member) => member.user.name).join(", ") : room.name}</p>
              <p className="text-xs text-zinc-500">
                {room.isPublic ? "Conversa publicada" : "Conversa privada pronta para mensagens e anexos"}
              </p>
              {typingLabel ? <p className="mt-1 text-xs text-cyan-200">{typingLabel}</p> : null}
            </div>
            <Badge className="border-white/10 text-zinc-300">{visibleMessages.length} mensagens</Badge>
          </div>

          <div className="flex-1 space-y-4 overflow-hidden rounded-[24px] border border-white/10 bg-black/20 p-4">
            <AnimatePresence initial={false}>
              {visibleMessages.map((message) => (
                <motion.article
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className={`max-w-[92%] rounded-3xl border p-4 ${
                    message.author.id === room.currentUserId
                      ? "ml-auto border-cyan-400/20 bg-cyan-400/10"
                      : "border-white/8 bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {message.author.id === room.currentUserId ? null : (
                      <Avatar>
                        <AvatarFallback className="flex size-full items-center justify-center bg-cyan-400/20 text-sm font-semibold text-cyan-200">
                          {message.author.avatarUrl}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-white">
                          {message.author.id === room.currentUserId ? "Voce" : message.author.name}
                        </p>
                        <span className="text-xs text-zinc-500">{formatRelativeDate(message.createdAt)}</span>
                        {message.author.id === room.currentUserId ? (
                          <span className={`inline-flex items-center gap-1 text-xs ${getMessageStatus(message).className}`}>
                            {(() => {
                              const StatusIcon = getMessageStatus(message).icon;
                              return <StatusIcon className="size-3.5" />;
                            })()}
                            {getMessageStatus(message).label}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-zinc-300">
                        {decryptedBodies[message.id] ?? (message.ciphertext ? "Decifrando..." : message.body)}
                      </p>
                      {message.attachment ? (
                        <div className="mt-4 space-y-3">
                          {message.attachment.mimeType.startsWith("image/") && imagePreviewUrls[message.id] ? (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedImage({
                                  src: imagePreviewUrls[message.id],
                                  name: message.attachment?.name ?? "Imagem",
                                })
                              }
                              className="block overflow-hidden rounded-2xl border border-white/10 bg-black/20"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imagePreviewUrls[message.id]}
                                alt={message.attachment.name}
                                className="max-h-72 w-full object-cover"
                              />
                            </button>
                          ) : null}
                          {message.attachment.mimeType.startsWith("audio/") && audioPreviewUrls[message.id] ? (
                            <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
                              <div className="mb-3 flex items-center gap-3">
                                <div className="flex size-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                                  <FileAudio className="size-5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-white">{message.attachment.name}</p>
                                  <p className="text-xs text-zinc-500">{formatBytes(message.attachment.size)}</p>
                                </div>
                              </div>
                              <audio controls preload="metadata" className="w-full" src={audioPreviewUrls[message.id]}>
                                <track kind="captions" />
                              </audio>
                            </div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void downloadAttachment(message)}
                            className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/70 p-3 text-left text-sm text-zinc-300 transition hover:border-cyan-400/30"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex size-10 items-center justify-center rounded-2xl bg-white/5 text-zinc-200">
                                {getAttachmentKind(message.attachment.mimeType) === "image" ? (
                                  <FileImage className="size-5" />
                                ) : getAttachmentKind(message.attachment.mimeType) === "audio" ? (
                                  <FileAudio className="size-5" />
                                ) : getAttachmentKind(message.attachment.mimeType) === "pdf" ? (
                                  <FileText className="size-5" />
                                ) : (
                                  <FileUp className="size-5" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-white">{message.attachment.name}</p>
                                <p className="mt-1 text-xs text-zinc-500">
                                  {getAttachmentLabel(message.attachment.mimeType)} • {formatBytes(message.attachment.size)}
                                </p>
                              </div>
                            </div>
                            <span className="inline-flex items-center gap-2 text-cyan-200">
                              <Download className="size-4" />
                              {downloadingMessageId === message.id ? "Baixando..." : "Abrir"}
                            </span>
                          </button>
                        </div>
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
                  placeholder={selectedFile ? "Adicione uma legenda opcional..." : "Digite sua mensagem..."}
                />
                <Button type="submit" size="icon" aria-label="Enviar" disabled={submitting}>
                  <Send className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant={recording ? "secondary" : "ghost"}
                  aria-label={recording ? "Parar gravacao" : "Gravar audio"}
                  onClick={() => void toggleAudioRecording()}
                >
                  {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
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
                  <p className="text-sm text-zinc-500">
                    Envie fotos, prints, PDFs, documentos ou grave um audio rapido.
                  </p>
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
              <p className="text-sm uppercase tracking-[0.18em]">Seguranca</p>
            </div>
            <h3 className="text-xl font-semibold text-white">Modo simples para acelerar o uso real</h3>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-zinc-400">
            <p>As conversas continuam restritas por autenticacao e relacionamento conhecido entre contatos.</p>
            <p>Mensagens e arquivos entram no fluxo direto para priorizar estabilidade enquanto fechamos a UX principal.</p>
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
                    <p className="text-[11px] text-zinc-500">
                      {member.user.isOnline
                        ? "Online agora"
                        : member.user.lastSeenAt
                          ? `Visto por ultimo em ${new Date(member.user.lastSeenAt).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`
                          : "Offline"}
                    </p>
                  </div>
                </div>
                <Badge className={member.role === "admin" ? "border-cyan-400/50 text-cyan-200" : ""}>{member.role}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <AnimatePresence>
        {expandedImage ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
            onClick={() => setExpandedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="relative w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-zinc-950"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setExpandedImage(null)}
                className="absolute right-4 top-4 z-10 rounded-full border border-white/10 bg-black/40 p-2 text-white"
              >
                <X className="size-4" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={expandedImage.src} alt={expandedImage.name} className="max-h-[80vh] w-full object-contain" />
              <div className="flex items-center justify-between gap-4 border-t border-white/10 p-4">
                <p className="truncate text-sm text-zinc-200">{expandedImage.name}</p>
                <a
                  href={expandedImage.src}
                  download={expandedImage.name}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200"
                >
                  <Download className="size-4" />
                  Baixar
                </a>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
