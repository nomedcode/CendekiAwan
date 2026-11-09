import { useEffect, useRef } from "react";
import ServiceDiagram, { diagramSteps } from "./ServiceDiagram";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ServiceDrawer({ row, runId, busy, onAction, onClose }) {
  const closeRef = useRef(null);
  const drawerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement;
    const drawer = drawerRef.current;
    closeRef.current?.focus();

    const focusable = () =>
      Array.from(drawer?.querySelectorAll(FOCUSABLE) ?? []).filter(
        (node) => node instanceof HTMLElement && node.offsetParent !== null,
      );

    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = focusable();
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!drawer?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement && document.contains(opener)) {
        opener.focus();
      }
    };
  }, []);

  const steps = diagramSteps(row.key);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        ref={drawerRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        style={{ "--accent": row.accent }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer-head">
          <div>
            <h2 id="drawer-title">{row.name}</h2>
            <p>{row.resource}</p>
          </div>
          <button
            ref={closeRef}
            className="action"
            onClick={onClose}
            aria-label="Tutup diagram"
          >
            Tutup
          </button>
        </header>

        <div className="drawer-value">
          <span className="value">{row.value}</span>
          <span className="unit">{row.unit}</span>
          <span className="secondary">{row.secondary}</span>
        </div>

        <ServiceDiagram service={row.key} runId={runId} />

        <ol className="steps">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <footer className="drawer-foot">
          <button
            className="action"
            onClick={() => {
              if (busy === row.action || row.status !== "ok") return;
              onAction(row.action);
            }}
            disabled={row.status !== "ok"}
            aria-disabled={busy === row.action || row.status !== "ok"}
            aria-busy={busy === row.action}
          >
            {busy === row.action
              ? (row.busyLabel ?? "menjalankan…")
              : row.actionLabel}
          </button>
          <span className="hint">Animasi mengikuti aksi nyata di emulator.</span>
        </footer>
      </aside>
    </div>
  );
}