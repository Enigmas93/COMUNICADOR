import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();

  return NextResponse.redirect(new URL("/login", env.NEXT_PUBLIC_APP_URL), { status: 303 });
}
