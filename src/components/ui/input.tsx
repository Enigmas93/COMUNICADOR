import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-50 outline-none ring-0 placeholder:text-zinc-500 focus:border-cyan-400/60",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
