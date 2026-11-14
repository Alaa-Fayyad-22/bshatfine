"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

// The public forms (report, host an event, contact, newsletter) have no back
// end yet. They look and validate as designed (the browser checks the required
// fields), but submitting sends NOTHING anywhere: it only shows `message`,
// which says honestly that the online service is coming soon, in the .done box.
export function SiteForm({
  className,
  style,
  doneStyle,
  message,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  doneStyle?: CSSProperties;
  message: string;
  children: ReactNode;
}) {
  const [done, setDone] = useState(false);

  return (
    <form
      className={className}
      style={style}
      onSubmit={(e) => {
        e.preventDefault();
        setDone(true);
        e.currentTarget.reset();
      }}
    >
      {children}
      <div className={done ? "done show" : "done"} role="status" style={doneStyle}>
        {done ? message : ""}
      </div>
    </form>
  );
}
