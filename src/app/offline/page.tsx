import Image from "next/image";

import { Card, CardContent } from "@/components/ui/card";

export default function OfflinePage() {
  return (
    <main className="mx-auto max-w-3xl">
      <Card>
        <CardContent className="flex flex-col items-center gap-6 p-10 text-center">
          <Image src="/offline-fallback.svg" alt="" width={220} height={160} />
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold text-white">Voce esta offline</h1>
            <p className="text-sm leading-6 text-zinc-400">
              O shell do app continua acessivel e as ultimas mensagens em cache podem ser mostradas assim que o
              service worker estiver ativo no navegador.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
