"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Link2, MailSearch, MessageCircleMore } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createDirectConversation, createInviteConversation } from "@/lib/chat/direct-conversations";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";

function initialsFromName(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function NewConversationForm() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState<Database["public"]["Tables"]["users"]["Row"] | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [latestInviteLink, setLatestInviteLink] = useState<string | null>(null);

  const searchByEmail = async () => {
    if (!supabase) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error("Informe um e-mail para buscar.");
      return;
    }

    setSearching(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sua sessao expirou.");
        router.push("/login" as Route);
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .ilike("email", normalizedEmail)
        .returns<Database["public"]["Tables"]["users"]["Row"][]>();

      if (error) {
        toast.error(error.message);
        return;
      }

      const found = (data ?? []).find((entry) => entry.email.toLowerCase() === normalizedEmail && entry.id !== user.id) ?? null;
      setResult(found);
      if (!found) {
        toast.error("Nao encontrei nenhum usuario com esse e-mail.");
      }
    } finally {
      setSearching(false);
    }
  };

  const startConversation = async () => {
    if (!supabase || !result) return;
    setStarting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sua sessao expirou.");
        router.push("/login" as Route);
        return;
      }

      const { data: currentRows, error: currentError } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .returns<Database["public"]["Tables"]["users"]["Row"][]>();
      const current = currentRows?.[0] ?? null;
      if (currentError || !current) {
        toast.error(currentError?.message ?? "Nao foi possivel carregar seu perfil.");
        return;
      }

      const { slug } = await createDirectConversation({
        supabase,
        currentUserId: user.id,
        currentUserName: current.name,
        contactId: result.id,
        contactName: result.name,
      });

      toast.success("Conversa criada com sucesso.");
      router.push(`/rooms/${slug}` as Route);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel iniciar a conversa.");
    } finally {
      setStarting(false);
    }
  };

  const createInvite = async () => {
    if (!supabase) return;
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

      const { data: currentRows, error: currentError } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .returns<Database["public"]["Tables"]["users"]["Row"][]>();
      const current = currentRows?.[0] ?? null;
      if (currentError || !current) {
        toast.error(currentError?.message ?? "Nao foi possivel carregar seu perfil.");
        return;
      }

      const { token } = await createInviteConversation({
        supabase,
        currentUserId: user.id,
        currentUserName: current.name,
      });

      const inviteLink = `${window.location.origin}/invite/${token}`;
      setLatestInviteLink(inviteLink);
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Convite copiado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel criar o convite.");
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <Button asChild variant="ghost" className="w-fit px-0">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 size-4" />
            Voltar para conversas
          </Link>
        </Button>
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Nova conversa</p>
        <h1 className="text-3xl font-semibold text-white">Encontre um contato ou gere um convite</h1>
        <p className="max-w-2xl text-sm leading-6 text-zinc-400">
          O foco agora e conversar de forma simples: texto, emojis, fotos, prints, PDFs e arquivos sem travar em criptografia.
        </p>
      </CardHeader>
      <CardContent className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-200" htmlFor="email">
              Buscar usuario por e-mail
            </label>
            <div className="flex gap-3">
              <Input
                id="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="contato@empresa.com"
              />
              <Button onClick={() => void searchByEmail()} disabled={searching}>
                <MailSearch className="mr-2 size-4" />
                {searching ? "Buscando..." : "Buscar"}
              </Button>
            </div>
          </div>

          {result ? (
            <div className="rounded-[28px] border border-cyan-400/20 bg-cyan-400/10 p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 font-semibold text-white">
                  {result.avatar_url ?? initialsFromName(result.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold text-white">{result.name}</p>
                  <p className="truncate text-sm text-zinc-300">{result.email}</p>
                </div>
              </div>
              <Button className="mt-4" onClick={() => void startConversation()} disabled={starting}>
                <MessageCircleMore className="mr-2 size-4" />
                {starting ? "Abrindo..." : "Iniciar conversa"}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="space-y-5">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 text-cyan-300">
              <Link2 className="size-4" />
              <p className="text-sm uppercase tracking-[0.18em]">Convite por link</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Crie um link para alguém entrar no aplicativo, aceitar e virar um contato conhecido.
            </p>
            <Button className="mt-4 w-full" onClick={() => void createInvite()} disabled={inviteLoading}>
              <Copy className="mr-2 size-4" />
              {inviteLoading ? "Gerando..." : "Gerar link de convite"}
            </Button>
            {latestInviteLink ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Ultimo link</p>
                <p className="mt-2 break-all">{latestInviteLink}</p>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
