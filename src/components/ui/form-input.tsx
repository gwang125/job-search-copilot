import { Label } from "@/components/ui/label";
import { Input, inputClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { InputHTMLAttributes, ReactNode } from "react";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  children?: ReactNode;
}

export function FormInput({
  label,
  hint,
  id,
  className,
  children,
  ...props
}: FormInputProps) {
  const inputId = id ?? props.name;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={inputId}>{label}</Label>
      {children ?? <Input id={inputId} {...props} />}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export { inputClassName };
