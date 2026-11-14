"use client";

import { useEffect, useState, type ReactNode } from "react";

const EVENT = "site-toast";

// The small message at the bottom of the screen (2.6 seconds, as in the
// reference). One <Toast /> sits in the site layout; any <ToastButton> shows
// its message in it.
export function Toast() {
  const [message, setMessage] = useState("");
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onToast = (e: Event) => {
      setMessage((e as CustomEvent<string>).detail);
      setShown(true);
      clearTimeout(timer);
      timer = setTimeout(() => setShown(false), 2600);
    };
    window.addEventListener(EVENT, onToast);
    return () => {
      window.removeEventListener(EVENT, onToast);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className={shown ? "toast show" : "toast"} role="status">
      {message}
    </div>
  );
}

export function ToastButton({
  message,
  className,
  children,
}: {
  message: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent(EVENT, { detail: message }))}
    >
      {children}
    </button>
  );
}
