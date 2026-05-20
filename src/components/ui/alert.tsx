import { cn } from "@/lib/utils";

export function Alert({
  children,
  variant = "info",
  className,
}: {
  children: React.ReactNode;
  variant?: "info" | "success" | "warning" | "error";
  className?: string;
}) {
  const styles = {
    info: "border-indigo-200 bg-indigo-50 text-indigo-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        styles[variant],
        className
      )}
    >
      {children}
    </div>
  );
}
