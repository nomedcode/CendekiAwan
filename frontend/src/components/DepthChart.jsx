import { useRef, useState } from "react";

const W = 720;
const H = 240;
const PAD = { left: 38, right: 12, top: 14, bottom: 26 };

function clock(value) {
  return new Date(value).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DepthChart({ points }) {
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);
  const data = points ?? [];

  if (!data.length) {
    return (
      <p className="empty">
        Belum ada sampel. Sampler menulis setiap 5 detik — beri waktu ±10 detik.
      </p>
    );
  }

  const peak = Math.max(0, ...data.map((point) => point.v));
  const max = Math.max(5, Math.ceil(peak * 1.25));
  const x = (index) =>
    PAD.left + (index / Math.max(1, data.length - 1)) * (W - PAD.left - PAD.right);
  const y = (value) => H - PAD.bottom - (value / max) * (H - PAD.top - PAD.bottom);
  const line = data
    .map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.v)}`)
    .join(" ");
  const area =
    data.length > 1
      ? `${line} L${x(data.length - 1)},${H - PAD.bottom} L${x(0)},${H - PAD.bottom} Z`
      : "";
  const last = data[data.length - 1];

  function onMove(event) {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const pointerX = ((event.clientX - rect.left) / rect.width) * W;
    const index = Math.round(
      ((pointerX - PAD.left) / (W - PAD.left - PAD.right)) * (data.length - 1),
    );
    setHover(Math.min(data.length - 1, Math.max(0, index)));
  }

  return (
    <div
      className="chart-wrap"
      ref={wrapRef}
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Grafik SQS depth 15 menit. Nilai terakhir ${last.v} pesan.`}
      >
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line
              className="grid"
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(max * fraction)}
              y2={y(max * fraction)}
            />
            <text
              className="axis-text"
              x={PAD.left - 8}
              y={y(max * fraction) + 3}
              textAnchor="end"
            >
              {Math.round(max * fraction)}
            </text>
          </g>
        ))}
        {area ? <path className="area" d={area} /> : null}
        <path className="line" d={line} />
        <text className="axis-text" x={PAD.left} y={H - 8}>
          {clock(data[0].t)}
        </text>
        <text className="axis-text" x={W - PAD.right} y={H - 8} textAnchor="end">
          {clock(last.t)}
        </text>
        {hover != null ? (
          <g>
            <line
              className="cross"
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={H - PAD.bottom}
            />
            <circle
              cx={x(hover)}
              cy={y(data[hover].v)}
              r="4"
              fill="var(--s1)"
              stroke="var(--surface)"
              strokeWidth="2"
            />
          </g>
        ) : null}
      </svg>
      {hover != null ? (
        <div
          className="tip"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            top: `${(y(data[hover].v) / H) * 100}%`,
          }}
        >
          {clock(data[hover].t)} · {data[hover].v}
        </div>
      ) : null}
      <details className="data">
        <summary>Tabel data</summary>
        <table>
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Depth</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(-12).map((point, index) => (
              <tr key={index}>
                <td>{clock(point.t)}</td>
                <td>{point.v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}