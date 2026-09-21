import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="crz-page-header">
      <div className="crz-page-header-copy">
        {eyebrow && <div className="crz-page-header-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="crz-page-header-actions">{actions}</div>}
    </header>
  );
}
