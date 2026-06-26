import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

export function Avatar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AvatarPrimitive.Root
      className={cn("relative flex size-10 shrink-0 overflow-hidden rounded-2xl bg-white/10", className)}
    >
      {children}
    </AvatarPrimitive.Root>
  );
}

export const AvatarFallback = AvatarPrimitive.Fallback;
