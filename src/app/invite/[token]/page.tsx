import { notFound } from "next/navigation";

import { AcceptInviteCard } from "@/components/invites/accept-invite-card";
import { getInviteByToken } from "@/lib/supabase/queries";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const inviteData = await getInviteByToken(token);

  if (!inviteData) notFound();

  return (
    <main className="mx-auto max-w-3xl">
      <AcceptInviteCard token={token} {...inviteData} />
    </main>
  );
}
