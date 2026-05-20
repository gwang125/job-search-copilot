import { Button, type ButtonProps } from "@/components/ui/button";

/** Primary CTA — thin wrapper for consistent naming in forms and flows */
export function PrimaryButton(props: ButtonProps) {
  return <Button variant="primary" {...props} />;
}
