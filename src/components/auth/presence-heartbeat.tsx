"use client";

import { useEffect } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function PresenceHeartbeat() {
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    let stopped = false;

    const pushHeartbeat = async () => {
      if (stopped) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      await supabase
        .from("users")
        .update({ last_seen_at: new Date().toISOString() } as never)
        .eq("id", user.id);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void pushHeartbeat();
      }
    };

    void pushHeartbeat();
    const interval = window.setInterval(() => {
      void pushHeartbeat();
    }, 60_000);

    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null;
}
