import { useEffect, useRef } from "react";
import ServiceDiagram, { diagramSteps } from "./ServiceDiagram";

export default function ServiceDrawer({ row, runId, busy, onAction, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const steps = diagramSteps(row.key);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
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
            onClick={() => onAction(row.action)}
            disabled={busy === row.action || row.status !== "ok"}
          >
            {busy === row.action ? "menjalankan…" : row.actionLabel}
          </button>
          <span className="hint">Animasi mengikuti aksi nyata di emulator.</span>
        </footer>
      </aside>
    </div>
  );
}