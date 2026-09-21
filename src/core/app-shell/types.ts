import type { ReactNode } from "react";

export type ShellMode = "visitor" | "client" | "admin";

export type ShellNavItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
  badge?: string;
};

export type AppShellProps = {
  children: ReactNode;
  mode?: ShellMode;
  activeNav?: string;
  cartCount?: number;
  userName?: string;
  className?: string;
};
