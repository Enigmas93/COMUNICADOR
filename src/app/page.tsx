import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LockKeyhole, Radio, ShieldCheck, Smartphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { featuredMetrics } from "@/lib/data/mock";

const features = [
  {
    icon: LockKeyhole,
    title: "E2EE real por sala",
    description: "A chave simetrica nasce no cliente e so trafega em envelopes cifrados para cada membro.",
  },
  {
    icon: Radio,
    title: "Realtime com controle de acesso",
    description: "Supabase Realtime distribui ciphertext; RLS limita leitura e escrita por membro da sala.",
  },
  {
    icon: ShieldCheck,
    title: "RLS em 100% das tabelas sensiveis",
    description: "Mensagens, convites, membros e storage obedecem policies isoladas por room_id.",
  },
  {
    icon: Smartphone,
    title: "PWA pronto para celular e desktop",
    description: "Manifesto, service worker, shell offline e base para notificacoes push.",
  },
];

export default function HomePage() {
  return (
    <main className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden">
          <CardContent className="grid gap-10 p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
            <div className="space-y-6">
              <Badge>Interface densa, elegante e orientada a operacao</Badge>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-5xl font-semibold leading-tight text-white">
                  Comunicacao em tempo real com salas publicas e privadas, sem abrir mao da privacidade.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-zinc-300">
                  Aurora combina a exploracao de comunidades publicas com a disciplina de espacos privados,
                  distribuindo chaves por membro e mantendo o servidor cego ao conteudo das mensagens.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/dashboard">
                    Entrar no dashboard
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <Link href="/login">Ver fluxo de login</Link>
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {featuredMetrics.map((metric) => (
                  <div key={metric.label} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <p className="text-2xl font-semibold text-white">{metric.value}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-zinc-500">{metric.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 rounded-[36px] bg-gradient-to-br from-cyan-400/15 to-violet-500/20 blur-3xl" />
              <Image
                src="/hero-illustration.svg"
                alt="Painel ilustrado do Aurora Chat"
                width={640}
                height={480}
                className="relative rounded-[36px] border border-white/10 bg-black/30 p-4"
                priority
              />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-4">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.title}>
              <CardContent className="space-y-4 p-6">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-300">
                  <Icon className="size-5" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-white">{feature.title}</h2>
                  <p className="text-sm leading-6 text-zinc-400">{feature.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </main>
  );
}
