import Sparkline from "./Sparkline";

export default function ServiceRow({ row, onAction, onOpen, busy }) {
  const down = row.status !== "ok";
  return (
    <div
      className={`row${down ? " is-down" : ""}`}
      style={{ "--accent": row.accent }}
    >
      <span className="accent" aria-hidden="true" />
      <button
        className="row-open"
        onClick={onOpen}
        aria-haspopup="dialog"
        title={`Cara kerja ${row.name}`}
      >
        <span className="svc">{row.name}</span>
        <span className="res">{row.resource}</span>
      </button>
      <div className="value-cell">
        <span className="value" key={row.value}>
          {row.value}
        </span>
        <span className="unit">{row.unit}</span>
      </div>
      <div className="secondary">{down ? "tidak merespons" : row.secondary}</div>
      <Sparkline points={row.series} color="var(--accent)" />
      <span className="badge">{down ? "down" : row.source}</span>
      <button
        className="action"
        onClick={() => onAction(row.action)}
        disabled={busy === row.action || down}
      >
        {busy === row.action ? "mengirim…" : row.actionLabel}
      </button>
    </div>
  );
}