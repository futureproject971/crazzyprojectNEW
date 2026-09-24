"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export type DropdownItem = {
  id: string;
  label: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  tone?: "default" | "admin";
  onSelect?: () => void;
};

export function Dropdown({
  trigger,
  items,
  align = "right",
}: {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="crz-dropdown" ref={rootRef}>
      <button
        type="button"
        className="crz-dropdown-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {trigger}
      </button>
      {open && (
        <div className={cn("crz-dropdown-menu", `crz-dropdown-menu--${align}`)} role="menu">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={cn("crz-dropdown-item", item.danger && "crz-dropdown-item--danger", item.tone === "admin" && "crz-dropdown-item--admin")}
              disabled={item.disabled}
              onClick={() => {
                item.onSelect?.();
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
