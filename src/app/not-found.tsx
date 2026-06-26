import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl">
      <Card>
        <CardContent className="space-y-6 p-10 text-center">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">404</p>
            <h1 className="text-4xl font-semibold text-white">Nao encontramos esta sala</h1>
            <p className="text-sm leading-6 text-zinc-400">
              Verifique o slug ou retorne para o dashboard para entrar em uma sala existente.
            </p>
          </div>
          <div className="flex justify-center gap-3">
            <Button asChild>
              <Link href="/dashboard">Ir para o dashboard</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/">Voltar a landing</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
