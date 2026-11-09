import { useLayoutEffect, useRef, useState } from "react";
import { nearestIndex, niceTicks, timePositions } from "../chart";

const PAD = { left: 38, right: 12, top: 14, bottom: 26 };

function clock(value) {
  return new Date(value).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DepthChart({ points, emptyMessage }) {
  const [pointerX, setPointerX] = useState(null);
  const [width, setWidth] = useState(720);
  const wrapRef = useRef(null);
  const data = points ?? [];

  useLayoutEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const measure = () => setWidth(Math.max(280, Math.round(node.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [data.length > 0]);

  if (!data.length) {
    return (
      <p className="empty">
        {emptyMessage ??
          "Belum ada sampel. Sampler menulis setiap 5 detik — beri waktu ±10 detik."}
      </p>
    );
  }

  const W = width;
  const H = Math.max(120, Math.round(W / 3));
  const plotWidth = W - PAD.left - PAD.right;
  const times = data.map((point) => new Date(point.t).getTime());
  const xs = timePositions(times, PAD.left, plotWidth);
  const active = pointerX == null ? null : nearestIndex(pointerX, xs);
  const peak = Math.max(0, ...data.map((point) => point.v));
  const { max, ticks } = niceTicks(peak);
  const y = (value) => H - PAD.bottom - (value / max) * (H - PAD.top - PAD.bottom);
  const line = data
    .map((point, index) => `${index ? "L" : "M"}${xs[index]},${y(point.v)}`)
    .join(" ");
  const area =
    data.length > 1
      ? `${line} L${xs[xs.length - 1]},${H - PAD.bottom} L${xs[0]},${H - PAD.bottom} Z`
      : "";
  const last = data[data.length - 1];

  function onMove(event) {
    if (event.pointerType === "touch" || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    setPointerX(((event.clientX - rect.left) / rect.width) * W);
  }

  return (
    <div
      className="chart-wrap"
      ref={wrapRef}
      onPointerMove={onMove}
      onPointerLeave={() => setPointerX(null)}
    >
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Grafik SQS depth 15 menit. Nilai terakhir ${last.v} pesan, puncak ${peak} pesan.`}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              className="grid"
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text
              className="axis-text"
              x={PAD.left - 8}
              y={y(tick) + 3}
              textAnchor="end"
            >
              {tick}
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
        {active != null ? (
          <g>
            <line
              className="cross"
              x1={xs[active]}
              x2={xs[active]}
              y1={PAD.top}
              y2={H - PAD.bottom}
            />
            <circle
              cx={xs[active]}
              cy={y(data[active].v)}
              r="4"
              fill="var(--s1)"
              stroke="var(--surface)"
              strokeWidth="2"
            />
          </g>
        ) : null}
      </svg>
      {active != null ? (
        <div
          className="tip"
          style={{
            left: `${(xs[active] / W) * 100}%`,
            top: `${(y(data[active].v) / H) * 100}%`,
          }}
        >
          {clock(data[active].t)} · {data[active].v}
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