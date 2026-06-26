import Link from "next/link";
import { KeyRound, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { currentRoom } from "@/lib/data/mock";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-cyan-300">
            <Link2 className="size-4" />
            <p className="text-sm uppercase tracking-[0.18em]">Convite</p>
          </div>
          <h1 className="text-3xl font-semibold text-white">Voce foi convidado para {currentRoom.name}</h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-400">
            Ao aceitar, o cliente gera ou recupera sua identidade criptografica, recebe o envelope da sala e libera o
            historico a partir do momento da entrada.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href="/login">
              <KeyRound className="mr-2 size-4" />
              Acessar e aceitar convite
            </Link>
          </Button>
          <p className="text-sm text-zinc-500">Token detectado: {token}</p>
        </CardContent>
      </Card>
    </main>
  );
}
