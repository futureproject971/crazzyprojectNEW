import { AppFooter } from "./AppFooter";
import { AppHeader } from "./AppHeader";
import type { AppShellProps } from "./types";
import { cn } from "@/core/design-system/utils/cn";

export function AppShell({
  children,
  mode = "visitor",
  activeNav = "home",
  cartCount = 0,
  userName,
  className,
}: AppShellProps) {
  return (
    <div className={cn("crz-app-shell", className)}>
      <AppHeader
        mode={mode}
        activeNav={activeNav}
        cartCount={cartCount}
        userName={userName}
      />
      <div className="crz-app-shell__content">{children}</div>
      <AppFooter />
    </div>
  );
}
