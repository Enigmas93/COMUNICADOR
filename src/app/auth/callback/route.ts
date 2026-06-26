import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";
  const supabase = await createSupabaseServerClient();

  if (code) {
    await supabase?.auth.exchangeCodeForSession(code);
  }

  if (tokenHash && type) {
    await supabase?.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
  }

  return NextResponse.redirect(new URL(next, env.NEXT_PUBLIC_APP_URL));
}
