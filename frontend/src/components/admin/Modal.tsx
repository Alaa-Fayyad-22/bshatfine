"use client";

import { createContext, useContext, useEffect, useId, useRef, type ReactNode } from "react";

const ModalContext = createContext<(() => void) | null>(null);

// Closes the surrounding <Modal>. Going through the dialog's own close() is what
// makes the browser put focus back on the control that opened it.
export function useModalClose(): () => void {
  const close = useContext(ModalContext);
  if (!close) throw new Error("useModalClose must be used inside <Modal>");
  return close;
}

// A native <dialog> opened with showModal(): the browser traps focus inside,
// makes the rest of the page inert, closes on Escape, and returns focus to the
// opener. Render it only while it should be open; `onClose` runs after any close
// (Escape, a button, ...) and the parent then stops rendering it.
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-card border border-line bg-paper p-5 text-ink backdrop:bg-ink/50 md:p-6"
    >
      <ModalContext.Provider value={() => ref.current?.close()}>
        <h2 id={titleId} className="text-xl font-bold">
          {title}
        </h2>
        {children}
      </ModalContext.Provider>
    </dialog>
  );
}
