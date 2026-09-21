import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export type PanelProps = HTMLAttributes<HTMLDivElement> & {
  soft?: boolean;
  interactive?: boolean;
};

export function Panel({ soft, interactive, className, ...props }: PanelProps) {
  return (
    <div
      className={cn(
        "crz-panel",
        soft && "crz-panel--soft",
        interactive && "crz-panel--interactive",
        className
      )}
      {...props}
    />
  );
}

export function Card(props: PanelProps) {
  return <Panel {...props} />;
}
