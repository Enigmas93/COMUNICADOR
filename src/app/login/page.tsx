import { redirect } from "next/navigation";
import { KeyRound, Mail, Sparkles } from "lucide-react";

import { AuthForm } from "@/components/auth/auth-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getSession } from "@/lib/supabase/auth";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-4xl">
      <Card>
        <CardContent className="grid gap-8 p-8 lg:grid-cols-[0.95fr_1.05fr] lg:p-10">
          <div className="space-y-5">
            <Badge>Fluxo de autenticacao</Badge>
            <h1 className="text-4xl font-semibold text-white">Cadastre-se, gere o par de chaves e entre na sala</h1>
            <p className="text-sm leading-7 text-zinc-400">
              O primeiro login dispara a geracao do par assimetrico no cliente. A chave publica sobe para o Supabase
              e a chave privada permanece protegida por senha/backup cifrado.
            </p>
            <div className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-5 text-sm text-zinc-300">
              <div className="flex items-center gap-3">
                <Mail className="size-4 text-cyan-300" />
                E-mail e senha
              </div>
              <div className="flex items-center gap-3">
                <Sparkles className="size-4 text-cyan-300" />
                OAuth Google
              </div>
              <div className="flex items-center gap-3">
                <KeyRound className="size-4 text-cyan-300" />
                Magic link com bootstrap do modulo E2EE
              </div>
            </div>
          </div>
          <AuthForm />
        </CardContent>
      </Card>
    </main>
  );
}
