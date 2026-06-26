"use client";

import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Link2, MailSearch, MessageCircleMore, Pin, Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createDirectConversation, createInviteConversation } from "@/lib/chat/direct-conversations";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DashboardContact, Room, UserProfile } from "@/types/domain";
import type { Database } from "@/types/supabase";

const pinnedRoomsStorageKey = "aurora:pinned-rooms";

function formatLastActivity(room: Room) {
  const latestMessage = room.messages.at(-1);
  return latestMessage?.createdAt
    ? new Date(latestMessage.createdAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      })
    : "Agora";
}

function formatPresenceLabel(lastSeenAt?: string, isOnline?: boolean) {
  if (isOnline) return "Online agora";
  if (!lastSeenAt) return "Offline";

  return `Visto por ultimo em ${new Date(lastSeenAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatConversationPreview(room: Room) {
  const latestMessage = room.messages.at(-1);
  if (!latestMessage) return room.description || "Conversa pronta para receber mensagens";
  if (latestMessage.attachment) {
    const mimeType = latestMessage.attachment.mimeType.toLowerCase();
    if (mimeType.startsWith("image/")) return "Foto enviada";
    if (mimeType.includes("pdf")) return "PDF enviado";
    return "Arquivo enviado";
  }
  return latestMessage.body || room.description || "Conversa pronta para receber mensagens";
}

export function DashboardShell({
  currentUser,
  rooms,
  contacts,
}: {
  currentUser: UserProfile | null;
  rooms: Room[];
  contacts: DashboardContact[];
}) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [search, setSearch] = useState("");
  const [creatingContactId, setCreatingContactId] = useState<string | null>(null);
  const [emailSearch, setEmailSearch] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailResult, setEmailResult] = useState<DashboardContact | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [latestInviteLink, setLatestInviteLink] = useState<string | null>(null);
  const [pinnedRoomIds, setPinnedRoomIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = window.localStorage.getItem(pinnedRoomsStorageKey);
    if (!stored) return [];

    try {
      const parsed = JSON.parse(stored) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      window.localStorage.removeItem(pinnedRoomsStorageKey);
      return [];
    }
  });

  const filteredRooms = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = !term
      ? rooms
      : rooms.filter(
      (room) =>
        room.name.toLowerCase().includes(term) ||
        room.description.toLowerCase().includes(term) ||
        room.members.some((member) => member.user.name.toLowerCase().includes(term)),
      );

    return [...source].sort((left, right) => {
      const leftPinned = pinnedRoomIds.includes(left.id);
      const rightPinned = pinnedRoomIds.includes(right.id);
      if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;
      const leftDate = left.messages.at(-1)?.createdAt ?? "";
      const rightDate = right.messages.at(-1)?.createdAt ?? "";
      return rightDate.localeCompare(leftDate);
    });
  }, [pinnedRoomIds, rooms, search]);

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return contacts;
    return contacts.filter(
      (contact) => contact.name.toLowerCase().includes(term) || contact.email.toLowerCase().includes(term),
    );
  }, [contacts, search]);

  const startDirectConversation = async (contact: DashboardContact) => {
    if (contact.directRoomSlug) {
      router.push(`/rooms/${contact.directRoomSlug}` as Route);
      return;
    }
    if (!supabase || !currentUser) {
      toast.error("Sua sessao nao esta pronta para iniciar a conversa.");
      return;
    }

    setCreatingContactId(contact.id);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Sua sessao expirou.");
        router.push("/login" as Route);
        return;
      }

      const { slug } = await createDirectConversation({
        supabase,
        currentUserId: user.id,
        currentUserName: currentUser.name,
        contactId: contact.id,
        contactName: contact.name,
      });

      toast.success("Conversa privada criada.");
      router.push(`/rooms/${slug}` as Route);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel criar a conversa.");
    } finally {
      setCreatingContactId(null);
    }
  };

  const searchContactByEmail = async () => {
    if (!supabase || !currentUser) return;
    const email = emailSearch.trim().toLowerCase();
    if (!email) {
      toast.error("Informe um e-mail para buscar.");
      return;
    }

    setEmailLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from("users")
        .select("*")
        .ilike("email", email)
        .returns<Database["public"]["Tables"]["users"]["Row"][]>();

      if (error) {
        toast.error(error.message);
        return;
      }

      const found = (rows ?? []).find((entry) => entry.email.toLowerCase() === email && entry.id !== currentUser.id) ?? null;
      if (!found) {
        setEmailResult(null);
        toast.error("Nenhum usuario conhecido com esse e-mail.");
        return;
      }

      const knownContact = contacts.find((contact) => contact.id === found.id);
      setEmailResult({
        id: found.id,
        name: found.name,
        email: found.email,
        avatarUrl:
          found.avatar_url ??
          found.name
            .split(" ")
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? "")
            .join(""),
        sharedRooms: knownContact?.sharedRooms ?? 0,
        directRoomSlug: knownContact?.directRoomSlug,
      });
    } finally {
      setEmailLoading(false);
    }
  };

  const createInviteLink = async () => {
    if (!supabase || !currentUser) return;
    setInviteLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sua sessao expirou.");
        router.push("/login" as Route);
        return;
      }

      const { token } = await createInviteConversation({
        supabase,
        currentUserId: user.id,
        currentUserName: currentUser.name,
      });
      const inviteLink = `${window.location.origin}/invite/${token}`;
      setLatestInviteLink(inviteLink);
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Link de convite copiado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel gerar o convite.");
    } finally {
      setInviteLoading(false);
    }
  };

  const togglePinnedRoom = (roomId: string) => {
    setPinnedRoomIds((current) => {
      const next = current.includes(roomId) ? current.filter((entry) => entry !== roomId) : [roomId, ...current];
      if (typeof window !== "undefined") {
        window.localStorage.setItem(pinnedRoomsStorageKey, JSON.stringify(next));
      }
      return next;
    });
  };

  return (
    <main className="grid gap-6 xl:grid-cols-[270px_minmax(0,1fr)_360px]">
      <Card className="h-fit">
        <CardHeader>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Mensageiro</p>
          <div className="flex items-center gap-3">
            <Avatar className="size-14">
              <AvatarFallback className="flex size-full items-center justify-center bg-cyan-400/20 text-lg font-semibold text-cyan-100">
                {currentUser?.avatarUrl ?? "AU"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-semibold text-white">{currentUser?.name ?? "Aurora"}</h1>
              <p className="text-sm text-zinc-400">{currentUser?.email ?? "Sessao ativa"}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button asChild className="w-full justify-start">
            <Link href="/rooms/new">
              <Plus className="mr-2 size-4" />
              Nova conversa
            </Link>
          </Button>
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-zinc-400">
            <p className="font-medium text-white">Experiencia mais familiar</p>
            <p className="mt-2 leading-6">
              A lista central mostra suas conversas privadas e o painel lateral ajuda a encontrar contatos pelo e-mail ou por convite.
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Acesso rapido</p>
            <Button asChild variant="ghost" className="w-full justify-start">
              <Link href="/dashboard">Conversas</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full justify-start">
              <Link href="/rooms/new">Novo contato</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Conversas</p>
              <h2 className="text-3xl font-semibold text-white">Caixa de entrada</h2>
            </div>
            <Badge className="border-cyan-400/30 bg-cyan-400/10 text-cyan-100">
              {filteredRooms.length} conversas
            </Badge>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por conversa, pessoa ou e-mail..."
              className="pl-11"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredRooms.map((room) => {
            const peerNames = room.members
              .filter((member) => member.user.id !== currentUser?.id)
              .map((member) => member.user.name)
              .slice(0, 3)
              .join(", ");

            return (
              <Link
                key={room.id}
                href={`/rooms/${room.slug}`}
                className="flex items-center gap-4 rounded-[26px] border border-white/10 bg-white/5 p-4 transition hover:border-cyan-400/40 hover:bg-cyan-400/5"
              >
                <Avatar className="size-14">
                  <AvatarFallback className="flex size-full items-center justify-center bg-white/10 text-base font-semibold text-white">
                    {room.name
                      .split(" ")
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase() ?? "")
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-white">{room.name}</p>
                        {pinnedRoomIds.includes(room.id) ? (
                          <Pin className="size-3.5 fill-cyan-300 text-cyan-300" />
                        ) : null}
                      </div>
                      <p className="truncate text-sm text-zinc-500">
                        {peerNames || "Sem outros participantes ainda"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-zinc-500">{formatLastActivity(room)}</span>
                  </div>
                  <p className="mt-2 truncate text-sm text-zinc-300">
                    {formatConversationPreview(room)}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge className="border-white/10 text-zinc-300">Privada</Badge>
                    <Badge className="border-white/10 text-zinc-300">{room.members.length} participantes</Badge>
                    {room.unreadCount > 0 ? <Badge className="border-cyan-400/40 text-cyan-100">{room.unreadCount} novas</Badge> : null}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={pinnedRoomIds.includes(room.id) ? "Desafixar conversa" : "Fixar conversa"}
                  onClick={(event) => {
                    event.preventDefault();
                    void event.stopPropagation();
                    togglePinnedRoom(room.id);
                  }}
                  className={`rounded-full border p-2 transition ${
                    pinnedRoomIds.includes(room.id)
                      ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-100"
                      : "border-white/10 bg-black/20 text-zinc-400 hover:border-cyan-400/30 hover:text-white"
                  }`}
                >
                  <Pin className={`size-4 ${pinnedRoomIds.includes(room.id) ? "fill-cyan-100" : ""}`} />
                </button>
              </Link>
            );
          })}
          {filteredRooms.length === 0 ? (
            <div className="rounded-[26px] border border-dashed border-white/10 bg-white/5 p-6 text-sm text-zinc-400">
              Nenhuma conversa encontrada com esse termo.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-cyan-300">
              <Users className="size-4" />
              <p className="text-sm uppercase tracking-[0.18em]">Contatos</p>
            </div>
            <h3 className="text-xl font-semibold text-white">Pessoas conhecidas e busca por e-mail</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 rounded-[24px] border border-white/10 bg-white/5 p-4">
              <label className="text-sm font-medium text-white" htmlFor="contact-email">
                Buscar contato por e-mail
              </label>
              <div className="flex gap-3">
                <Input
                  id="contact-email"
                  value={emailSearch}
                  onChange={(event) => setEmailSearch(event.target.value)}
                  placeholder="email@dominio.com"
                />
                <Button onClick={() => void searchContactByEmail()} disabled={emailLoading}>
                  <MailSearch className="mr-2 size-4" />
                  {emailLoading ? "Buscando..." : "Buscar"}
                </Button>
              </div>
              {emailResult ? (
                <div className="rounded-[20px] border border-cyan-400/20 bg-cyan-400/10 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-11">
                      <AvatarFallback className="flex size-full items-center justify-center bg-cyan-400/15 font-semibold text-cyan-100">
                        {emailResult.avatarUrl}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">{emailResult.name}</p>
                      <p className="truncate text-sm text-zinc-300">{emailResult.email}</p>
                    </div>
                    <Button onClick={() => void startDirectConversation(emailResult)} disabled={creatingContactId === emailResult.id}>
                      <MessageCircleMore className="mr-2 size-4" />
                      {creatingContactId === emailResult.id ? "Abrindo..." : "Conversar"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            {filteredContacts.map((contact) => (
              <div key={contact.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="size-12">
                    <AvatarFallback className="flex size-full items-center justify-center bg-cyan-400/15 font-semibold text-cyan-100">
                      {contact.avatarUrl}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${contact.isOnline ? "bg-emerald-400" : "bg-zinc-500"}`} />
                      <p className="truncate font-medium text-white">{contact.name}</p>
                    </div>
                    <p className="truncate text-sm text-zinc-500">{contact.email}</p>
                    <p className="mt-1 text-xs text-zinc-500">{formatPresenceLabel(contact.lastSeenAt, contact.isOnline)}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-zinc-500">{contact.sharedRooms} conversa(s) em comum</p>
                  <Button
                    size="sm"
                    variant={contact.directRoomSlug ? "secondary" : "default"}
                    onClick={() => void startDirectConversation(contact)}
                    disabled={creatingContactId === contact.id}
                  >
                    <MessageCircleMore className="mr-2 size-4" />
                    {creatingContactId === contact.id
                      ? "Criando..."
                      : contact.directRoomSlug
                        ? "Abrir conversa"
                        : "Conversar"}
                  </Button>
                </div>
              </div>
            ))}
            {filteredContacts.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 p-4 text-sm text-zinc-400">
                Seus contatos aparecem aqui quando voce conversa com eles ou encontra por e-mail.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-cyan-300">
              <Link2 className="size-4" />
              <p className="text-sm uppercase tracking-[0.18em]">Convite</p>
            </div>
            <h3 className="text-xl font-semibold text-white">Adicionar contato por link</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-zinc-400">
              Gere um link unico para a pessoa entrar no app, aceitar o convite e virar um contato conhecido.
            </p>
            <Button onClick={() => void createInviteLink()} disabled={inviteLoading} className="w-full">
              <Copy className="mr-2 size-4" />
              {inviteLoading ? "Gerando link..." : "Gerar convite por link"}
            </Button>
            {latestInviteLink ? (
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Ultimo convite</p>
                <p className="mt-2 break-all text-sm text-zinc-300">{latestInviteLink}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
