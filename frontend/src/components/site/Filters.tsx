"use client";

import { useState, type CSSProperties } from "react";

export type FilterOption = { key: string; label: string };

// A row of filter buttons (the first option is "all"). It shows or hides the
// children of the element marked data-filter-items="<group>" by their
// data-cat, exactly like the reference. The items themselves stay
// server-rendered: only their `hidden` attribute changes.
export function Filters({
  group,
  label,
  options,
  style,
}: {
  group: string;
  label: string;
  options: readonly FilterOption[];
  style?: CSSProperties;
}) {
  const [active, setActive] = useState(options[0].key);

  const choose = (key: string) => {
    setActive(key);
    const items = document.querySelector(`[data-filter-items="${group}"]`);
    if (!items) return;
    for (const item of Array.from(items.children)) {
      (item as HTMLElement).hidden = !(
        key === options[0].key || item.getAttribute("data-cat") === key
      );
    }
  };

  return (
    <div className="filters" style={style} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={active === o.key}
          onClick={() => choose(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
