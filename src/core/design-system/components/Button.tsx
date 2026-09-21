import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  leadingIcon,
  trailingIcon,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "crz-button",
        `crz-button--${variant}`,
        `crz-button--${size}`,
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="crz-spinner" style={{ width: 16, height: 16 }} /> : leadingIcon}
      <span>{children}</span>
      {!loading && trailingIcon}
    </button>
  );
}
