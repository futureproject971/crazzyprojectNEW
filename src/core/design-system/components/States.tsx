import type { ReactNode } from "react";
import { Button } from "./Button";
import { Panel } from "./Panel";

export function Skeleton({ width = "100%", height = 16 }: { width?: string | number; height?: string | number }) {
  return <span className="crz-skeleton" aria-hidden="true" style={{ width, height, display: "block" }} />;
}

export function LoadingState({ label = "Carregando..." }: { label?: string }) {
  return (
    <Panel className="crz-state" aria-live="polite" aria-busy="true">
      <div className="crz-state-inner">
        <span className="crz-spinner" />
        <p>{label}</p>
      </div>
    </Panel>
  );
}

export function EmptyState({
  title = "Nada por aqui ainda",
  description,
  icon = "◇",
  action,
}: {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Panel className="crz-state">
      <div className="crz-state-inner">
        <span className="crz-state-icon" aria-hidden="true">{icon}</span>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
        {action}
      </div>
    </Panel>
  );
}

export function ErrorState({
  title = "Algo deu errado",
  description = "Tente novamente em alguns instantes.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <Panel className="crz-state crz-state--error" role="alert">
      <div className="crz-state-inner">
        <span className="crz-state-icon" aria-hidden="true">!</span>
        <h3>{title}</h3>
        <p>{description}</p>
        {onRetry && <Button variant="secondary" onClick={onRetry}>Tentar novamente</Button>}
      </div>
    </Panel>
  );
}
