import type { ReactNode } from "react";

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <span className="crz-tooltip">
      {children}
      <span className="crz-tooltip-bubble" role="tooltip">{content}</span>
    </span>
  );
}
