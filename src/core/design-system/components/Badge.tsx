import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../utils/cn";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "blue" | "pink" | "green" | "gold";
  icon?: ReactNode;
};

export function Badge({ tone = "neutral", icon, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn("crz-badge", tone !== "neutral" && `crz-badge--${tone}`, className)} {...props}>
      {icon}
      {children}
    </span>
  );
}
