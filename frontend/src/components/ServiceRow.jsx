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
        <svg
          className="chev"
          viewBox="0 0 12 12"
          width="10"
          height="10"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M4 2.5 L8 6 L4 9.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
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
        onClick={() => {
          if (busy === row.action || down) return;
          onAction(row.action);
        }}
        disabled={down}
        aria-disabled={busy === row.action || down}
        aria-busy={busy === row.action}
      >
        {busy === row.action ? row.busyLabel : row.actionLabel}
      </button>
    </div>
  );
}