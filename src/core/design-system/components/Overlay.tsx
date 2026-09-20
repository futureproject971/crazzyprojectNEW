"use client";

import { useEffect, useRef } from "react";
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

function useBodyScrollLock(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
}

function useFocusTrap(open: boolean) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open || !ref.current) return;
    const root = ref.current;
    const selector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = Array.from(root.querySelectorAll<HTMLElement>(selector));
    focusables[0]?.focus();

    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    root.addEventListener("keydown", handler);
    return () => root.removeEventListener("keydown", handler);
  }, [open]);

  return ref;
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
  useBodyScrollLock(open);
  const dialogRef = useFocusTrap(open);
  if (!open) return null;

  return (
    <div className="crz-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="crz-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="crz-dialog-head">
          <strong>{title}</strong>
          <IconButton label="Fechar" icon="×" onClick={onClose} />
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
  useBodyScrollLock(open);
  const drawerRef = useFocusTrap(open);
  if (!open) return null;

  return (
    <div className="crz-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        ref={drawerRef}
        className="crz-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="crz-drawer-head">
          <strong>{title}</strong>
          <IconButton label="Fechar" icon="×" onClick={onClose} />
        </header>
        <div className="crz-drawer-body">{children}</div>
      </aside>
    </div>
  );
}
