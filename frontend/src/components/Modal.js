"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// Generic blocking dialog.
//
// Rendered through a portal so it sits outside `.route-view`, whose entrance
// animation sets a transform — a transformed ancestor would otherwise become
// the containing block for the fixed backdrop and clip it to the page wrapper.
export default function Modal({ open, onClose, title, badge, children, footer, wide }) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Depends only on `open` so a fresh inline `onClose` arrow from the parent
  // does not re-run the effect (and re-grab focus) on every render.
  useEffect(() => {
    if (!open) return undefined;

    restoreRef.current = document.activeElement;
    const panel = panelRef.current;
    if (panel) panel.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e) {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;

      const items = [...panel.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      if (!items.length) return;

      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      const el = restoreRef.current;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={e => { if (e.target === e.currentTarget) onCloseRef.current(); }}
    >
      <div
        className={wide ? "modal modal-wide" : "modal"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={panelRef}
        tabIndex={-1}
      >
        <button type="button" className="modal-x" aria-label="Close dialog" onClick={() => onCloseRef.current()}>
          &times;
        </button>
        {badge && <div className="modal-badge">{badge}</div>}
        <h4 id="modal-title">{title}</h4>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
