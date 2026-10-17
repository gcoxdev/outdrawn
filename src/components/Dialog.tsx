import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Native modal behavior provides focus containment, inert background, and restoration. */
export function Dialog({ children, className, label, descriptionId, onClose }: {
  children: ReactNode; className: string; label: string; descriptionId?: string; onClose?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    // A backdrop button must not receive initial focus.
    (dialog.querySelector("button:not(.menu-backdrop), [tabindex='0']") as HTMLElement | null)?.focus();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return createPortal(
    <dialog ref={ref} className={`app-dialog ${className}`} aria-label={label} aria-describedby={descriptionId} onCancel={event => {
      event.preventDefault();
      event.stopPropagation();
      onClose?.();
    }}>
      {children}
    </dialog>, document.body
  );
}
