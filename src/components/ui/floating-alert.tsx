"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FloatingAlertProps {
  message: string;
  variant?: "success" | "error" | "info";
  onDismiss: () => void;
  /** Auto-dismiss after ms (0 = never). Default 5000 for success/info. */
  autoDismissMs?: number;
}

const variantStyles = {
  success: "border-emerald-200/80 bg-emerald-50 text-emerald-950 shadow-emerald-900/10",
  error: "border-red-200/80 bg-red-50 text-red-950 shadow-red-900/10",
  info: "border-indigo-200/80 bg-indigo-50 text-indigo-950 shadow-indigo-900/10",
};

export function FloatingAlert({
  message,
  variant = "info",
  onDismiss,
  autoDismissMs,
}: FloatingAlertProps) {
  const dismissAfter =
    autoDismissMs ?? (variant === "error" ? 0 : 5000);

  useEffect(() => {
    if (dismissAfter <= 0) return;
    const timer = window.setTimeout(onDismiss, dismissAfter);
    return () => window.clearTimeout(timer);
  }, [message, dismissAfter, onDismiss]);

  const icon =
    variant === "error" ? (
      <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
    ) : (
      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
    );

  const content = (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-auto fixed bottom-6 right-6 z-[100] flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3.5 text-sm shadow-lg",
        variantStyles[variant]
      )}
    >
      {icon}
      <p className="flex-1 leading-snug pr-1">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-md p-0.5 opacity-70 transition hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
