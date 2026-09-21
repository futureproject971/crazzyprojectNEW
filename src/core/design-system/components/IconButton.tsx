import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../utils/cn";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: ReactNode;
};

export function IconButton({ label, icon, className, ...props }: IconButtonProps) {
  return (
    <button className={cn("crz-icon-button", className)} aria-label={label} {...props}>
      {icon}
    </button>
  );
}
