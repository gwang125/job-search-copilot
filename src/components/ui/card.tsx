import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

export function Card({
  className,
  padding = true,
  ...props
}: HTMLAttributes<HTMLDivElement> & { padding?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-200/80 bg-white shadow-[var(--shadow-card)]",
        padding && "p-6",
        className
      )}
      {...props}
    />
  );
}
