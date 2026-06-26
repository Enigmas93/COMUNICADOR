import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export const getSession = cache(async () => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
});

export const getCurrentProfile = cache(async () => {
  const session = await getSession();
  if (!session) return null;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle<Database["public"]["Tables"]["users"]["Row"]>();

  return data ?? null;
});
