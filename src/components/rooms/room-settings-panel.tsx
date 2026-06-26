"use client";

import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Link2, LoaderCircle, Shield, ShieldAlert, UserMinus } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { encryptRoomKeyForInvite, generateInviteSecret, openRoomKeyEnvelope } from "@/lib/crypto/e2ee";
import { loadStoredIdentity } from "@/lib/crypto/identity-store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";
import type { Room, RoomMember } from "@/types/domain";
import type { Database } from "@/types/supabase";

function defaultInviteExpiry() {
  return new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
}

export function RoomSettingsPanel({ room }: { room: Room }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [members, setMembers] = useState(room.members);
  const [latestInviteLink, setLatestInviteLink] = useState<string | null>(null);
  const [maxUses, setMaxUses] = useState("10");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);
  const [channels, setChannels] = useState(room.channels);
  const [channelName, setChannelName] = useState("");
  const [channelDescription, setChannelDescription] = useState("");
  const [channelKind, setChannelKind] = useState<"announcement" | "topic">("topic");
  const [channelLoading, setChannelLoading] = useState(false);

  const currentMember = useMemo(
    () => members.find((member) => member.user.id === room.currentUserId) ?? null,
    [members, room.currentUserId],
  );
  const isAdmin = currentMember?.role === "admin";

  const createChannel = async () => {
    if (!supabase || !isAdmin || !room.currentUserId) return;

    const name = channelName.trim();
    if (name.length < 2) {
      toast.error("Informe um nome de canal valido.");
      return;
    }

    setChannelLoading(true);
    try {
      const channelSlug = slugify(name);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Sua sessao expirou.");
        router.push("/login" as Route);
        return;
      }

      const payload = [
        {
          room_id: room.id,
          name,
          slug: channelSlug,
          description: channelDescription.trim() || null,
          kind: channelKind,
          position: channels.length,
          created_by: user.id,
        } satisfies Database["public"]["Tables"]["room_channels"]["Insert"],
      ];
      const { data, error } = await supabase
        .from("room_channels")
        .insert(payload as never)
        .select("*")
        .returns<Database["public"]["Tables"]["room_channels"]["Row"][]>();

      if (error) {
        toast.error(error.message);
        return;
      }

      const created = data?.[0];
      if (!created) {
        toast.error("Nao foi possivel confirmar a criacao do canal.");
        return;
      }

      setChannels((current) => [
        ...current,
        {
          id: created.id,
          roomId: created.room_id,
          name: created.name,
          slug: created.slug,
          description: created.description ?? "",
          kind: created.kind,
          position: created.position,
        },
      ]);
      setChannelName("");
      setChannelDescription("");
      setChannelKind("topic");
      toast.success("Canal criado com sucesso.");
      router.refresh();
    } finally {
      setChannelLoading(false);
    }
  };

  const updateMemberRole = async (member: RoomMember, nextRole: "admin" | "member") => {
    if (!supabase || !isAdmin) return;
    setMemberActionId(member.id);

    try {
      const { error } = await supabase
        .from("room_members")
        .update({ role: nextRole } as never)
        .eq("room_id", room.id)
        .eq("user_id", member.user.id);

      if (error) {
        toast.error(error.message);
        return;
      }

      setMembers((current) =>
        current.map((entry) => (entry.id === member.id ? { ...entry, role: nextRole } : entry)),
      );
      toast.success(nextRole === "admin" ? "Membro promovido para admin." : "Admin rebaixado para membro.");
    } finally {
      setMemberActionId(null);
    }
  };

  const removeMember = async (member: RoomMember) => {
    if (!supabase || !isAdmin) return;
    if (member.user.id === room.ownerId) {
      toast.error("O owner da sala nao pode ser removido.");
      return;
    }

    setMemberActionId(member.id);

    try {
      const { error } = await supabase
        .from("room_members")
        .delete()
        .eq("room_id", room.id)
        .eq("user_id", member.user.id);

      if (error) {
        toast.error(error.message);
        return;
      }

      setMembers((current) => current.filter((entry) => entry.id !== member.id));
      toast.success("Membro removido da sala.");
    } finally {
      setMemberActionId(null);
    }
  };

  const createInvite = async () => {
    if (!supabase || !room.currentUserId || !currentMember?.encryptedRoomKey) {
      toast.error("Sua chave da sala ainda nao esta disponivel.");
      return;
    }

    setInviteLoading(true);

    try {
      const identity = loadStoredIdentity(room.currentUserId);
      if (!identity) {
        toast.error("Sua identidade local nao foi encontrada.");
        return;
      }

      const roomKey = await openRoomKeyEnvelope(currentMember.encryptedRoomKey, identity.publicKey, identity.privateKey);
      const inviteSecret = await generateInviteSecret();
      const wrappedRoomKey = await encryptRoomKeyForInvite(roomKey, inviteSecret);
      const token = crypto.randomUUID().replace(/-/g, "");
      const maxUsesValue = Number.parseInt(maxUses, 10);

      if (!Number.isFinite(maxUsesValue) || maxUsesValue <= 0) {
        toast.error("Defina um limite de usos valido.");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Sua sessao expirou.");
        router.push("/login" as Route);
        return;
      }

      const { error } = await supabase.from("room_invites").insert([
        {
          room_id: room.id,
          token,
          created_by: user.id,
          expires_at: defaultInviteExpiry(),
          max_uses: maxUsesValue,
          uses: 0,
          key_wrap_ciphertext: wrappedRoomKey.ciphertext,
          key_wrap_iv: wrappedRoomKey.nonce,
        } satisfies Database["public"]["Tables"]["room_invites"]["Insert"],
      ] as never);

      if (error) {
        toast.error(error.message);
        return;
      }

      const inviteLink = `${window.location.origin}/invite/${token}#k=${encodeURIComponent(inviteSecret)}`;
      setLatestInviteLink(inviteLink);
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Convite criado e copiado para a area de transferencia.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel gerar o convite.");
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-cyan-300">Configuracoes da sala</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">{room.name}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                Painel inicial de administracao para convites, papeis e governanca da sala.
              </p>
            </div>
            <Button asChild variant="secondary">
              <Link href={`/rooms/${room.slug}` as Route}>
                <ArrowLeft className="mr-2 size-4" />
                Voltar ao chat
              </Link>
            </Button>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-cyan-300">
              <Shield className="size-4" />
              <p className="text-sm uppercase tracking-[0.18em]">Membros e papeis</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {members.map((member) => {
              const isOwner = member.user.id === room.ownerId;
              const isSelf = member.user.id === room.currentUserId;
              const loading = memberActionId === member.id;

              return (
                <div key={member.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-11">
                        <AvatarFallback className="bg-white/10 text-zinc-200">{member.user.avatarUrl}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white">{member.user.name}</p>
                          {isOwner ? <Badge>owner</Badge> : null}
                          {isSelf ? <Badge className="border-cyan-400/20 bg-cyan-400/10 text-cyan-100">voce</Badge> : null}
                        </div>
                        <p className="text-sm text-zinc-400">{member.user.email}</p>
                      </div>
                    </div>
                    <Badge className={member.role === "admin" ? "border-cyan-400/50 text-cyan-200" : ""}>{member.role}</Badge>
                  </div>

                  {isAdmin && !isOwner ? (
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button
                        variant="secondary"
                        onClick={() => void updateMemberRole(member, member.role === "admin" ? "member" : "admin")}
                        disabled={loading}
                      >
                        {loading ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <ShieldAlert className="mr-2 size-4" />}
                        {member.role === "admin" ? "Rebaixar para membro" : "Promover para admin"}
                      </Button>
                      <Button variant="ghost" onClick={() => void removeMember(member)} disabled={loading}>
                        <UserMinus className="mr-2 size-4" />
                        Remover
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-cyan-300">
              <Shield className="size-4" />
              <p className="text-sm uppercase tracking-[0.18em]">Canais</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_160px]">
              <Input placeholder="Ex: operacoes" value={channelName} onChange={(event) => setChannelName(event.target.value)} />
              <Input
                placeholder="Descricao curta do canal"
                value={channelDescription}
                onChange={(event) => setChannelDescription(event.target.value)}
              />
              <select
                value={channelKind}
                onChange={(event) => setChannelKind(event.target.value as "announcement" | "topic")}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 outline-none"
              >
                <option value="topic">Topico</option>
                <option value="announcement">Anuncio</option>
              </select>
            </div>
            <Button onClick={() => void createChannel()} disabled={!isAdmin || channelLoading}>
              {channelLoading ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : null}
              Criar canal
            </Button>
            <div className="space-y-3">
              {channels.map((channel) => (
                <div key={channel.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-medium text-white">#{channel.name}</p>
                  <p className="mt-1 text-sm text-zinc-400">{channel.description || "Canal sem descricao."}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-cyan-300">
              <Link2 className="size-4" />
              <p className="text-sm uppercase tracking-[0.18em]">Convites</p>
            </div>
            <h2 className="text-xl font-semibold text-white">Gerar link com envelope E2EE</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="maxUses" className="text-sm font-medium text-zinc-200">
                Limite de usos
              </label>
              <Input id="maxUses" value={maxUses} onChange={(event) => setMaxUses(event.target.value)} />
            </div>

            <Button onClick={() => void createInvite()} disabled={!isAdmin || inviteLoading}>
              {inviteLoading ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Copy className="mr-2 size-4" />}
              Criar convite e copiar link
            </Button>

            {latestInviteLink ? (
              <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-50">
                <p className="font-medium">Ultimo convite gerado</p>
                <p className="mt-2 break-all text-emerald-100">{latestInviteLink}</p>
              </div>
            ) : (
              <p className="text-sm leading-6 text-zinc-400">
                O segredo do convite vai no fragmento da URL (`#k=`), entao o servidor nao recebe a chave necessaria
                para abrir o envelope da sala.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
