"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { generateIdentityKeyPair } from "@/lib/crypto/e2ee";
import { loadStoredIdentity, saveStoredIdentity } from "@/lib/crypto/identity-store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";

export function AuthBootstrap() {
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (bootstrappedRef.current) return;

    const run = async () => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const storedIdentity = loadStoredIdentity(user.id);
      const { data: existingProfiles } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .returns<Database["public"]["Tables"]["users"]["Row"][]>();
      const existingProfile = existingProfiles?.[0] ?? null;

      if (storedIdentity && existingProfile?.public_key) {
        bootstrappedRef.current = true;
        return;
      }

      const identity = storedIdentity ?? (await generateIdentityKeyPair());
      saveStoredIdentity({
        userId: user.id,
        publicKey: identity.publicKey,
        privateKey: identity.privateKey,
      });

      const name =
        (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
        (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
        user.email?.split("@")[0] ||
        "Usuario Aurora";

      const payload = [
        {
          id: user.id,
          email: user.email ?? "",
          name,
          avatar_url: name
            .split(" ")
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? "")
            .join(""),
          public_key: identity.publicKey,
        } satisfies Database["public"]["Tables"]["users"]["Insert"],
      ];

      const { error } = await supabase.from("users").upsert(payload as never);

      if (error) {
        toast.error("Nao foi possivel concluir o bootstrap E2EE.", {
          description: error.message,
        });
        return;
      }

      bootstrappedRef.current = true;
      toast.success("Identidade criptografica pronta.", {
        description: "Sua chave publica foi publicada e a chave privada ficou armazenada localmente neste dispositivo.",
      });
    };

    void run();
  }, []);

  return null;
}
