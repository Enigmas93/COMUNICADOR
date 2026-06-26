"use client";

import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { decryptInviteRoomKey, sealRoomKeyForMember } from "@/lib/crypto/e2ee";
import { loadStoredIdentity } from "@/lib/crypto/identity-store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RoomInvite } from "@/types/domain";
import type { Database } from "@/types/supabase";

const inviteSecretStoragePrefix = "aurora:invite-secret:";

function parseInviteSecret(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.get("k");
}

export function AcceptInviteCard({
  token,
  invite,
  room,
  authenticated,
  isMember,
}: {
  token: string;
  invite: RoomInvite;
  room: {
    id: string;
    name: string;
    slug: string;
    description: string;
    isPublic: boolean;
  };
  authenticated: boolean;
  isMember: boolean;
}) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [inviteSecret] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;

    const key = `${inviteSecretStoragePrefix}${token}`;
    const fromHash = parseInviteSecret(window.location.hash);
    if (fromHash) {
      window.localStorage.setItem(key, fromHash);
      return fromHash;
    }

    return window.localStorage.getItem(key);
  });
  const [submitting, setSubmitting] = useState(false);
  const [openedAt] = useState(() => Date.now());

  const inviteState = useMemo(() => {
    if (new Date(invite.expiresAt).getTime() <= openedAt) return "expired";
    if (invite.uses >= invite.maxUses) return "exhausted";
    return "active";
  }, [invite.expiresAt, invite.maxUses, invite.uses, openedAt]);

  const acceptInvite = async () => {
    if (!supabase) {
      toast.error("Configure o Supabase antes de aceitar o convite.");
      return;
    }
    if (!invite.keyWrapCiphertext || !invite.keyWrapIv || !inviteSecret) {
      toast.error("Este link de convite esta incompleto ou perdeu o segredo criptografico.");
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
        return;
      }

      const identity = loadStoredIdentity(user.id);
      if (!identity) {
        toast.error("Sua identidade criptografica ainda nao foi preparada. Tente recarregar a pagina.");
        return;
      }

      if (isMember) {
        router.replace(`/rooms/${room.slug}` as Route);
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .returns<Database["public"]["Tables"]["users"]["Row"][]>();

      if (profileError) {
        toast.error(profileError.message);
        return;
      }

      const profile = profiles?.[0];
      if (!profile?.public_key) {
        toast.error("Sua chave publica ainda nao esta disponivel no perfil.");
        return;
      }

      const roomKey = await decryptInviteRoomKey(
        {
          ciphertext: invite.keyWrapCiphertext,
          nonce: invite.keyWrapIv,
        },
        inviteSecret,
      );
      const encryptedRoomKey = await sealRoomKeyForMember(roomKey, profile.public_key);

      const { error: memberError } = await supabase.from("room_members").upsert(
        [
          {
          room_id: room.id,
          user_id: user.id,
          role: "member",
          encrypted_room_key: encryptedRoomKey,
          } satisfies Database["public"]["Tables"]["room_members"]["Insert"],
        ] as never,
        {
          onConflict: "room_id,user_id",
        },
      );

      if (memberError) {
        toast.error(memberError.message);
        return;
      }

      const { error: inviteError } = await supabase
        .from("room_invites")
        .update({ uses: invite.uses + 1 } as never)
        .eq("id", invite.id);

      if (inviteError) {
        toast.error(inviteError.message);
        return;
      }

      window.localStorage.removeItem(`${inviteSecretStoragePrefix}${token}`);
      toast.success("Convite aceito com sucesso.");
      router.replace(`/rooms/${room.slug}` as Route);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel aceitar o convite.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-cyan-300">
          <ShieldCheck className="size-4" />
          <p className="text-sm uppercase tracking-[0.18em]">Convite E2EE</p>
        </div>
        <h1 className="text-3xl font-semibold text-white">Voce foi convidado para {room.name}</h1>
        <p className="max-w-2xl text-sm leading-6 text-zinc-400">
          O link contem um segredo temporario para abrir a chave da sala no cliente. O servidor continua sem acesso ao
          conteudo em texto puro.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
          <p className="font-medium text-white">{room.name}</p>
          <p className="mt-1 text-zinc-400">{room.description || "Sala privada para colaboracao segura."}</p>
          <p className="mt-3 text-xs text-zinc-500">
            Token: {token} | Expira em: {new Date(invite.expiresAt).toLocaleString("pt-BR")}
          </p>
        </div>

        {isMember ? (
          <div className="flex items-center justify-between gap-3 rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-5 text-emerald-300" />
              <p className="text-sm text-emerald-50">Sua conta ja faz parte desta sala.</p>
            </div>
            <Button asChild>
              <Link href={`/rooms/${room.slug}` as Route}>Abrir sala</Link>
            </Button>
          </div>
        ) : null}

        {inviteState !== "active" ? (
          <div className="rounded-[24px] border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
            {inviteState === "expired"
              ? "Este convite expirou. Gere um novo link nas configuracoes da sala."
              : "Este convite atingiu o limite de usos e nao pode mais ser aceito."}
          </div>
        ) : null}

        {!inviteSecret ? (
          <div className="rounded-[24px] border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
            O segredo criptografico do convite nao foi encontrado. Abra novamente o link original completo.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {authenticated ? (
            <Button onClick={() => void acceptInvite()} disabled={submitting || inviteState !== "active" || !inviteSecret || isMember}>
              {submitting ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <KeyRound className="mr-2 size-4" />}
              Aceitar convite
            </Button>
          ) : (
            <Button asChild>
              <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}` as Route}>
                <KeyRound className="mr-2 size-4" />
                Entrar para aceitar
              </Link>
            </Button>
          )}
          <p className="text-sm text-zinc-500">
            O segredo fica salvo apenas neste navegador para concluir o aceite apos o login.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
