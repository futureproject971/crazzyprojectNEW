"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { IconButton } from "./IconButton";

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);
}

export function Dialog({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEscape(open, onClose);
  if (!open) return null;

  return (
    <div className="crz-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="crz-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="crz-dialog-head">
          <strong>{title}</strong>
          <IconButton label="Fechar" icon="×" onClick={onClose} autoFocus />
        </header>
        <div className="crz-dialog-body">{children}</div>
      </section>
    </div>
  );
}

export function Drawer({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEscape(open, onClose);
  if (!open) return null;

  return (
    <div className="crz-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="crz-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="crz-drawer-head">
          <strong>{title}</strong>
          <IconButton label="Fechar" icon="×" onClick={onClose} autoFocus />
        </header>
        <div className="crz-drawer-body">{children}</div>
      </aside>
    </div>
  );
}
