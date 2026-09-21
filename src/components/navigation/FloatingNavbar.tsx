import { AppHeader } from "@/core/app-shell";

/**
 * Legacy compatibility wrapper.
 * M01 owns the global header through AppHeader.
 */
export function FloatingNavbar() {
  return <AppHeader mode="visitor" activeNav="home" cartCount={0} />;
}
