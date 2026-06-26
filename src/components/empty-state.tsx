import Image from "next/image";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col items-start gap-6 p-8 md:flex-row md:items-center">
        <Image
          src="/offline-fallback.svg"
          alt=""
          width={160}
          height={120}
          className="rounded-2xl border border-white/10 bg-black/40 p-3"
        />
        <div className="space-y-3">
          <h3 className="text-xl font-semibold text-white">{title}</h3>
          <p className="max-w-xl text-sm leading-6 text-zinc-400">{description}</p>
          {action}
        </div>
      </CardContent>
    </Card>
  );
}
