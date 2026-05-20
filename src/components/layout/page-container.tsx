import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type MaxWidth = "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "6xl" | "full";

const maxWidthClass: Record<MaxWidth, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
  full: "max-w-full",
};

interface PageContainerProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  maxWidth?: MaxWidth;
  className?: string;
}

export function PageContainer({
  title,
  description,
  actions,
  children,
  maxWidth = "full",
  className,
}: PageContainerProps) {
  return (
    <>
      <section className={cn("space-y-8", className)}>
        <header className="border-b border-zinc-200 pb-6">
          <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <section>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
                {title}
              </h1>
              {description && (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
                  {description}
                </p>
              )}
            </section>
            {actions && (
              <section className="flex shrink-0 items-center gap-2">
                {actions}
              </section>
            )}
          </section>
        </header>
        <section
          className={cn(
            "w-full",
            maxWidthClass[maxWidth],
            maxWidth !== "full" && "mx-auto"
          )}
        >
          {children}
        </section>
      </section>
    </>
  );
}
