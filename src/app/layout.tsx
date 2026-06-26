import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";

import { AuthBootstrap } from "@/components/auth/auth-bootstrap";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/supabase/auth";
import "@/app/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-heading" });

export const metadata: Metadata = {
  title: "Aurora Chat",
  description: "App de comunicacao em tempo real com salas publicas, privadas e E2EE real.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} ${grotesk.variable} bg-background font-sans text-foreground antialiased`}>
        <Providers>
          <AuthBootstrap />
          <ServiceWorkerRegister />
          <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <header className="mb-6 flex items-center justify-between rounded-full border border-white/10 bg-black/20 px-4 py-3 backdrop-blur xl:px-6">
              <Link href="/" className="flex items-center gap-3 text-sm font-medium text-white">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-cyan-400/20 text-cyan-200">
                  A
                </span>
                Aurora Chat
              </Link>
              <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="sm">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/rooms/new">Nova sala</Link>
                </Button>
                {session ? (
                  <form action="/auth/signout" method="post">
                    <Button type="submit" variant="ghost" size="sm">
                      Sair
                    </Button>
                  </form>
                ) : (
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/login">Entrar</Link>
                  </Button>
                )}
                <ThemeToggle />
              </div>
            </header>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
