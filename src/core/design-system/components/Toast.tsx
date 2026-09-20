import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export function Toast({
  tone = "info",
  icon,
  children,
}: {
  tone?: "info" | "success" | "error";
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("crz-toast", tone !== "info" && `crz-toast--${tone}`)}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      {icon}
      <div>{children}</div>
    </div>
  );
}
