import { cn } from "@/lib/utils";
import { LabelHTMLAttributes } from "react";

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "block text-sm font-medium text-zinc-700",
        className
      )}
      {...props}
    />
  );
}
