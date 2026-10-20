import { useEffect, useRef } from "react";

export function useDialogFocus(onClose) {
  const dialogRef = useRef(null);
  const closeHandler = useRef(onClose);

  useEffect(() => { closeHandler.current = onClose; }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const previousFocus = window.document.activeElement;
    const focusable = () => [...dialog.querySelectorAll("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")];
    (dialog.querySelector("[data-dialog-initial-focus]") ?? focusable()[0])?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeHandler.current?.();
      } else if (event.key === "Tab") {
        const items = focusable();
        if (!items.length) { event.preventDefault(); return; }
        if (event.shiftKey && window.document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
        else if (!event.shiftKey && window.document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
      }
    };
    window.document.addEventListener("keydown", onKeyDown);
    return () => {
      window.document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus?.();
    };
  }, []);

  return dialogRef;
}
