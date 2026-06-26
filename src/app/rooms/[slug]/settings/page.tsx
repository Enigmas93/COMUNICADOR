import { notFound, redirect } from "next/navigation";

import { RoomSettingsPanel } from "@/components/rooms/room-settings-panel";
import { getRoomBySlug } from "@/lib/supabase/queries";

export default async function RoomSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const room = await getRoomBySlug(slug);

  if (!room) notFound();
  if (room.currentUserRole !== "admin") redirect(`/rooms/${slug}`);

  return <RoomSettingsPanel room={room} />;
}
