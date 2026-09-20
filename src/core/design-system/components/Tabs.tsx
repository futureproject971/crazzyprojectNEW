"use client";

import type { KeyboardEvent, ReactNode } from "react";

export type TabItem = {
  id: string;
  label: ReactNode;
};

export function Tabs({
  items,
  value,
  onChange,
  ariaLabel = "Abas",
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();

    const current = Math.max(0, items.findIndex((item) => item.id === value));
    let next = current;

    if (event.key === "ArrowLeft") next = (current - 1 + items.length) % items.length;
    if (event.key === "ArrowRight") next = (current + 1) % items.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;

    onChange(items[next].id);
  };

  return (
    <div className="crz-tabs" role="tablist" aria-label={ariaLabel} onKeyDown={handleKeyDown}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          className="crz-tab"
          aria-selected={item.id === value}
          tabIndex={item.id === value ? 0 : -1}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
