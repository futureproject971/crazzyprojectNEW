"use client";

import type { ReactNode } from "react";

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
  return (
    <div className="crz-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          className="crz-tab"
          aria-selected={item.id === value}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
