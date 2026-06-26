import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { getDashboardData } from "@/lib/supabase/queries";

export default async function DashboardPage() {
  const { currentUser, rooms, contacts, configured, authenticated } = await getDashboardData();

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
      ) : <DashboardShell currentUser={currentUser} rooms={rooms} contacts={contacts} />}
    </main>
  );
}
