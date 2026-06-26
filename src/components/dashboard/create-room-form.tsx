"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateRoomKey, sealRoomKeyForMember } from "@/lib/crypto/e2ee";
import { slugify } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";

const schema = z.object({
  name: z.string().min(3, "Informe ao menos 3 caracteres."),
  slug: z.string().min(3, "Slug muito curto."),
  description: z.string().min(10, "Descreva rapidamente a proposta da sala."),
  visibility: z.enum(["public", "private"]),
});

type FormValues = z.infer<typeof schema>;

export function CreateRoomForm() {
  const router = useRouter();
  const {
    register,
    setValue,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      visibility: "private",
    },
  });

  const name = useWatch({ control, name: "name" });
  const slug = useWatch({ control, name: "slug" });
  const visibility = useWatch({ control, name: "visibility" });

  const inviteUrl = useMemo(() => `https://aurora.chat/sala/${slug || "minha-sala"}`, [slug]);

  const onSubmit = handleSubmit(async (values) => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      toast.error("Configure o Supabase antes de criar salas reais.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Voce precisa estar autenticada para criar uma sala.");
      router.push("/login");
      return;
    }

    const { data: profiles, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .returns<Database["public"]["Tables"]["users"]["Row"][]>();
    const profile = profiles?.[0] ?? null;
    if (profileError || !profile) {
      toast.error("Seu perfil criptografico ainda nao esta pronto.");
      return;
    }

    const roomKey = await generateRoomKey();
    const encryptedRoomKey = await sealRoomKeyForMember(roomKey, profile.public_key);

    const roomPayload = [
      {
        name: values.name,
        slug: values.slug,
        description: values.description,
        is_public: values.visibility === "public",
        owner_id: user.id,
      } satisfies Database["public"]["Tables"]["rooms"]["Insert"],
    ];

    const { data: roomRows, error: roomError } = await supabase
      .from("rooms")
      .insert(roomPayload as never)
      .select("*")
      .returns<Database["public"]["Tables"]["rooms"]["Row"][]>();
    const room = roomRows?.[0] ?? null;

    if (roomError || !room) {
      toast.error(roomError?.message ?? "Nao foi possivel criar a sala.");
      return;
    }

    const memberPayload = [
      {
        room_id: room.id,
        user_id: user.id,
        role: "admin",
        encrypted_room_key: encryptedRoomKey,
      } satisfies Database["public"]["Tables"]["room_members"]["Insert"],
    ];

    const { error: memberError } = await supabase.from("room_members").insert(memberPayload as never);

    if (memberError) {
      toast.error(memberError.message);
      return;
    }

    toast.success("Sala criada com sucesso.", {
      description:
        values.visibility === "private"
          ? "Sala privada criada com envelope E2EE para a conta atual."
          : "Sala publica criada e pronta para descoberta no diretorio.",
    });
    router.push(`/rooms/${room.slug}`);
    router.refresh();
  });

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardHeader className="space-y-3">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Nova sala</p>
          <h1 className="text-3xl font-semibold text-white">Configure o espaco e gere a chave localmente</h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-400">
            O criador recebe o primeiro envelope cifrado e entra como admin da sala. Depois disso, cada novo
            membro recebe sua propria versao da chave.
          </p>
        </CardHeader>
        <CardContent className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-200" htmlFor="name">
                Nome da sala
              </label>
              <Input
                id="name"
                placeholder="Ex: Operacao Aurora"
                {...register("name", {
                  onChange: (event) => setValue("slug", slugify(event.target.value), { shouldValidate: true }),
                })}
              />
              {errors.name ? <p className="text-sm text-rose-300">{errors.name.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-200" htmlFor="slug">
                Slug unico
              </label>
              <Input id="slug" placeholder="operacao-aurora" {...register("slug")} />
              {errors.slug ? <p className="text-sm text-rose-300">{errors.slug.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-200" htmlFor="description">
                Descricao
              </label>
              <Textarea id="description" placeholder="O que esta sala organiza e como o time vai usa-la?" {...register("description")} />
              {errors.description ? <p className="text-sm text-rose-300">{errors.description.message}</p> : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setValue("visibility", "private", { shouldValidate: true })}
                className={`rounded-3xl border p-5 text-left transition ${visibility === "private" ? "border-cyan-400 bg-cyan-400/10" : "border-white/10 bg-white/5"}`}
              >
                <p className="font-medium text-white">Sala privada</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">Acesso apenas por link ou convite por e-mail.</p>
              </button>
              <button
                type="button"
                onClick={() => setValue("visibility", "public", { shouldValidate: true })}
                className={`rounded-3xl border p-5 text-left transition ${visibility === "public" ? "border-cyan-400 bg-cyan-400/10" : "border-white/10 bg-white/5"}`}
              >
                <p className="font-medium text-white">Sala publica</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">Descoberta pelo diretorio, mas historico segue cifrado.</p>
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Gerando..." : "Criar sala"}
              </Button>
              <Button asChild variant="secondary">
                <Link href="/dashboard">Voltar ao dashboard</Link>
              </Button>
            </div>
          </form>

          <Card className="border-white/6 bg-black/20">
            <CardContent className="space-y-5 p-6">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Preview</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{name || "Sua nova sala"}</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  {slug
                    ? `URL prevista: ${inviteUrl}`
                    : "O slug e a URL aparecem assim que voce digitar o nome da sala."}
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-zinc-200">Fluxo E2EE inicial</p>
                <ul className="mt-3 space-y-3 text-sm leading-6 text-zinc-400">
                  <li>1. Gera chave simetrica da sala no navegador.</li>
                  <li>2. Cifra a chave com a chave publica do criador.</li>
                  <li>3. Salva somente o envelope cifrado em `room_members`.</li>
                  <li>4. Mensagens futuras sobem como ciphertext + nonce.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </motion.div>
  );
}
