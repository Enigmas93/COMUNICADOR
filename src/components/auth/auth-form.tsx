"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Globe, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { env, isSupabaseConfigured } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const schema = z.object({
  name: z.string().min(2, "Informe seu nome.").optional(),
  email: z.string().email("Digite um e-mail valido."),
  password: z.string().min(8, "A senha deve ter no minimo 8 caracteres."),
});

type FormValues = z.infer<typeof schema>;

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [oauthLoading, setOauthLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!supabase) {
      toast.error("Configure o Supabase antes de autenticar.");
      return;
    }

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Sessao iniciada com sucesso.");
      router.push("/dashboard");
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        data: {
          name: values.name,
        },
      },
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Conta criada.", {
      description: "Se sua instância exigir confirmação de e-mail, verifique sua caixa de entrada.",
    });
    router.push("/dashboard");
    router.refresh();
  });

  const handleGoogleLogin = async () => {
    if (!supabase) {
      toast.error("Configure o Supabase antes de autenticar.");
      return;
    }

    setOauthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });

    if (error) {
      toast.error(error.message);
      setOauthLoading(false);
    }
  };

  return (
    <div className="space-y-5 rounded-[32px] border border-white/10 bg-black/20 p-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">
          {mode === "login" ? "Entrar no Aurora" : "Criar conta no Aurora"}
        </h2>
        <p className="text-sm text-zinc-400">
          {isSupabaseConfigured
            ? "Login real com Supabase Auth e bootstrap criptografico no primeiro acesso."
            : "Preencha o .env.local com as chaves do Supabase para ativar a autenticacao real."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/5 p-1">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`rounded-2xl px-4 py-2 text-sm ${mode === "login" ? "bg-cyan-400/20 text-white" : "text-zinc-400"}`}
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`rounded-2xl px-4 py-2 text-sm ${mode === "signup" ? "bg-cyan-400/20 text-white" : "text-zinc-400"}`}
        >
          Criar conta
        </button>
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        {mode === "signup" ? (
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-zinc-200">
              Nome
            </label>
            <Input id="name" placeholder="Seu nome" {...register("name")} />
            {errors.name ? <p className="text-sm text-rose-300">{errors.name.message}</p> : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-zinc-200">
            E-mail
          </label>
          <Input id="email" type="email" placeholder="voce@empresa.com" {...register("email")} />
          {errors.email ? <p className="text-sm text-rose-300">{errors.email.message}</p> : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-zinc-200">
            Senha
          </label>
          <Input id="password" type="password" placeholder="Digite sua senha" {...register("password")} />
          {errors.password ? <p className="text-sm text-rose-300">{errors.password.message}</p> : null}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={isSubmitting || !isSupabaseConfigured}>
            {isSubmitting ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : null}
            {mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleGoogleLogin}
            disabled={oauthLoading || !isSupabaseConfigured}
          >
            {oauthLoading ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Globe className="mr-2 size-4" />}
            Google
          </Button>
        </div>
      </form>
    </div>
  );
}
