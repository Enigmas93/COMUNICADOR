import { notFound } from "next/navigation";

import { ChatShell } from "@/components/chat/chat-shell";
import { getRoomBySlug } from "@/lib/supabase/queries";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const room = await getRoomBySlug(slug);

  if (!room) notFound();

  return <ChatShell room={room} />;
}
