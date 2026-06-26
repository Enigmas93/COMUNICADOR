"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Copy, LockKeyhole, Send, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { decryptMessage, encryptMessage, openRoomKeyEnvelope } from "@/lib/crypto/e2ee";
import { loadStoredIdentity } from "@/lib/crypto/identity-store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatBytes, formatRelativeDate } from "@/lib/utils";
import type { Room } from "@/types/domain";
import type { Database } from "@/types/supabase";

export function ChatShell({ room }: { room: Room }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [activeChannelId, setActiveChannelId] = useState(room.channels[0]?.id ?? "");
  const [roomKey, setRoomKey] = useState<string | null>(null);
  const [decryptedBodies, setDecryptedBodies] = useState<Record<string, string>>({});
  const [liveMessages, setLiveMessages] = useState(() => room.messages);
  const supabase = createSupabaseBrowserClient();

  const visibleMessages = useMemo(
    () => liveMessages.filter((message) => message.channelId === activeChannelId),
    [activeChannelId, liveMessages],
  );

  useEffect(() => {
    if (!supabase) return;

    let active = true;

    const bootstrapKeys = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const identity = loadStoredIdentity(user.id);
      const member = room.members.find((entry) => entry.user.id === user.id);

      if (!identity || !member?.encryptedRoomKey) return;

      const decryptedRoomKey = await openRoomKeyEnvelope(
        member.encryptedRoomKey,
        identity.publicKey,
        identity.privateKey,
      );

      if (active) setRoomKey(decryptedRoomKey);
    };

    void bootstrapKeys();

    return () => {
      active = false;
    };
  }, [room.members, supabase]);

  useEffect(() => {
    if (!roomKey) return;

    let active = true;

    const decryptAll = async () => {
      const nextBodies: Record<string, string> = {};

      for (const message of liveMessages) {
        if (message.type === "text" && message.ciphertext && message.iv) {
          try {
            nextBodies[message.id] = await decryptMessage(
              { ciphertext: message.ciphertext, nonce: message.iv },
              roomKey,
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
  }, [liveMessages, roomKey]);

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`room:${room.id}`)
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
                channelId: "general",
                author: author
                  ? {
                      id: author.id,
                      name: author.name,
                      email: author.email,
                      avatarUrl: author.avatar_url ?? author.name.slice(0, 2).toUpperCase(),
                    }
                  : {
                      id: row.user_id,
                      name: "Usuario",
                      email: "",
                      avatarUrl: "US",
                    },
                type: row.type,
                body: "",
                ciphertext: row.ciphertext,
                iv: row.iv,
                createdAt: row.created_at,
              },
            ];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [room.id, supabase]);

  return (
    <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
      <Card className="h-fit">
        <CardHeader>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Canais</p>
          <h1 className="text-2xl font-semibold text-white">{room.name}</h1>
          <p className="text-sm leading-6 text-zinc-400">{room.description}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {room.channels.map((channel) => (
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
              <h2 className="text-2xl font-semibold text-white">
                #{room.channels.find((channel) => channel.id === activeChannelId)?.name}
              </h2>
              <Badge>{room.isPublic ? "Publica" : "Privada"}</Badge>
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              Realtime via Supabase, decifragem local no cliente e historico paginado por canal.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(`${window.location.origin}/invite/${room.invites[0]?.token ?? ""}`);
              toast.success("Link de convite copiado.");
            }}
          >
            <Copy className="mr-2 size-4" />
            Copiar convite
          </Button>
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
                        <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/70 p-3 text-sm text-zinc-300">
                          <p className="font-medium text-white">{message.attachment.name}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {message.attachment.mimeType} • {formatBytes(message.attachment.size)}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>

          <form
            className="rounded-[24px] border border-white/10 bg-white/5 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!draft.trim()) return;
              if (!supabase || !roomKey) {
                toast.error("Sua chave da sala ainda nao esta disponivel.");
                return;
              }

              void (async () => {
                const {
                  data: { user },
                } = await supabase.auth.getUser();

                if (!user) {
                  toast.error("Sua sessao expirou.");
                  router.push("/login");
                  return;
                }

                const payload = await encryptMessage(draft.trim(), roomKey);
                const messagePayload = [
                  {
                    room_id: room.id,
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
              })();
            }}
          >
            <label className="mb-3 block text-sm font-medium text-zinc-200" htmlFor="draft">
              Nova mensagem
            </label>
            <div className="flex gap-3">
              <Input id="draft" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escreva algo para o canal..." />
              <Button type="submit" size="icon" aria-label="Enviar">
                <Send className="size-4" />
              </Button>
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
