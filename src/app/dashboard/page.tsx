import Link from "next/link";
import { redirect } from "next/navigation";
import { Compass, Lock, Plus, Users } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getDashboardData } from "@/lib/supabase/queries";

export default async function DashboardPage() {
  const { currentUser, rooms, publicRooms, configured, authenticated } = await getDashboardData();

  if (configured && !authenticated) {
    redirect("/login");
  }

  return (
    <main className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-4 p-8 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Dashboard</p>
            <h1 className="text-3xl font-semibold text-white">
              Bem-vinda, {currentUser?.name ?? "ao Aurora"}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-zinc-400">
              Suas salas, o diretorio publico e os atalhos de convite ficam centralizados aqui, com feedback rapido
              para cada fluxo principal do produto.
            </p>
          </div>
          <Button asChild>
            <Link href="/rooms/new">
              <Plus className="mr-2 size-4" />
              Criar nova sala
            </Link>
          </Button>
        </CardContent>
      </Card>

      {!configured ? (
        <EmptyState
          title="Falta conectar o Supabase"
          description="Envie suas credenciais do projeto para eu validar a integracao runtime. Enquanto isso, a UI continua pronta para uso."
        />
      ) : rooms.length === 0 ? (
        <EmptyState
          title="Voce ainda nao participa de nenhuma sala"
          description="Crie uma sala privada para seu time ou entre em uma comunidade publica com um clique."
          action={
            <Button asChild>
              <Link href="/rooms/new">Criar primeira sala</Link>
            </Button>
          }
        />
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-cyan-300">
                  <Users className="size-4" />
                  <p className="text-sm uppercase tracking-[0.18em]">Minhas salas</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {rooms.map((room) => (
                  <Link
                    key={room.id}
                    href={`/rooms/${room.slug}`}
                    className="block rounded-[28px] border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/50 hover:bg-cyan-400/5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-3">
                          <h2 className="text-xl font-semibold text-white">{room.name}</h2>
                          <Badge>{room.isPublic ? "Publica" : "Privada"}</Badge>
                        </div>
                        <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">{room.description}</p>
                      </div>
                      {room.unreadCount > 0 ? <Badge className="border-cyan-400/50 text-cyan-200">{room.unreadCount} novas</Badge> : null}
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-cyan-300">
                <Compass className="size-4" />
                <p className="text-sm uppercase tracking-[0.18em]">Explorar salas publicas</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {publicRooms.map((room) => (
                <div key={room.id} className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-white">{room.name}</h2>
                    <Badge className="border-emerald-400/40 text-emerald-200">Preview aberto</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">{room.description}</p>
                  <div className="mt-4 flex gap-3">
                    <Button asChild size="sm">
                      <Link href={`/rooms/${room.slug}`}>Ver sala</Link>
                    </Button>
                    <Button size="sm" variant="secondary">
                      <Lock className="mr-2 size-4" />
                      Entrar e receber chave
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}
    </main>
  );
}
