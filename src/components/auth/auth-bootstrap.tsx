"use client";

import { useEffect, useRef } from "react";
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

      const { data: existingProfiles } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .returns<Database["public"]["Tables"]["users"]["Row"][]>();
      const existingProfile = existingProfiles?.[0] ?? null;

      if (existingProfile?.public_key) {
        bootstrappedRef.current = true;
        return;
      }

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
          public_key: existingProfile?.public_key ?? `plain:${user.id}`,
          encrypted_private_key: null,
        } satisfies Database["public"]["Tables"]["users"]["Insert"],
      ];

      const { error } = await supabase.from("users").upsert(payload as never);

      if (error) return;

      bootstrappedRef.current = true;
    };

    void run();
  }, []);

  return null;
}
