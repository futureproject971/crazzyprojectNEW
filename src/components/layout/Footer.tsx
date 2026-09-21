import { AppFooter } from "@/core/app-shell";

/**
 * Legacy compatibility wrapper.
 * M01 owns the global footer through AppFooter.
 */
export function Footer() {
  return <AppFooter />;
}
