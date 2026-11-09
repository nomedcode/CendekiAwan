import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getEvents,
  getHealth,
  getMetrics,
  getSnapshot,
  runAction,
} from "./api";
import DepthChart from "./components/DepthChart";
import EventFeed from "./components/EventFeed";
import FanoutGraph from "./components/FanoutGraph";
import ServiceRow from "./components/ServiceRow";
import ServiceDrawer from "./components/ServiceDrawer";
import Status from "./components/Status";

const nf = new Intl.NumberFormat("id-ID");

function bytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function clock(value) {
  return new Date(value).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function App() {
  const [snapshot, setSnapshot] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [events, setEvents] = useState([]);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [busy, setBusy] = useState(null);
  const [openKey, setOpenKey] = useState(null);
  const [runId, setRunId] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [snap, ev, h] = await Promise.all([
        getSnapshot(),
        getEvents(),
        getHealth(),
      ]);
      setSnapshot(snap);
      setEvents(ev);
      setHealth(h);
      setLastSync(new Date());
      setError(null);
    } catch {
      setError("Backend tidak merespons. Pastikan API :8000 dan Floci :4566 hidup.");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    let timer;
    const tick = async () => {
      await refresh();
      if (alive) timer = setTimeout(tick, 3000);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [refresh]);

  useEffect(() => {
    let alive = true;
    let timer;
    const tick = async () => {
      try {
        const data = await getMetrics(15);
        if (alive) setMetrics(data);
      } catch {
        /* the snapshot poll already surfaces the error */
      }
      if (alive) timer = setTimeout(tick, 10000);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  const bySeries = useMemo(() => {
    const map = new Map();
    for (const row of metrics) {
      const key = `${row.service}.${row.metric}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ t: row.captured_at, v: row.value });
    }
    return map;
  }, [metrics]);

  const act = useCallback(
    async (action) => {
      setBusy(action);
      try {
        await runAction(action, { count: action === "invoke" ? 1 : 10 });
        await refresh();
        setRunId((value) => value + 1);
      } catch {
        setError(`Aksi ${action} gagal — cek emulator di :4566.`);
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  const rows = useMemo(() => {
    if (!snapshot) return [];
    const { sqs, s3, sns, dynamodb, lambda } = snapshot;
    return [
      {
        key: "sqs",
        name: "SQS",
        accent: "var(--s1)",
        status: sqs.status,
        resource: sqs.queue,
        value: nf.format(sqs.depth),
        unit: "pesan",
        secondary: `${nf.format(sqs.in_flight)} in flight`,
        series: bySeries.get("sqs.depth"),
        source: "live",
        action: "simulate",
        actionLabel: "Kirim pesan",
      },
      {
        key: "s3",
        name: "S3",
        accent: "var(--s2)",
        status: s3.status,
        resource: s3.bucket,
        value: nf.format(s3.objects),
        unit: "objek",
        secondary: bytes(s3.bytes),
        series: bySeries.get("s3.objects"),
        source: "live",
        action: "upload",
        actionLabel: "Upload",
      },
      {
        key: "sns",
        name: "SNS",
        accent: "var(--s3)",
        status: sns.status,
        resource: sns.topic,
        value: nf.format(sns.subscriptions),
        unit: "subscription",
        secondary: "fanout ke queue",
        series: bySeries.get("sns.subscriptions"),
        source: "live",
        action: "publish",
        actionLabel: "Publish",
      },
      {
        key: "dynamodb",
        name: "DynamoDB",
        accent: "var(--s4)",
        status: dynamodb.status,
        resource: dynamodb.table,
        value: nf.format(dynamodb.items),
        unit: "item",
        secondary: "Scan Select=COUNT",
        series: bySeries.get("dynamodb.items"),
        source: "derived",
        action: "item",
        actionLabel: "Tulis item",
      },
      {
        key: "lambda",
        name: "Lambda",
        accent: "var(--s5)",
        status: lambda.status,
        resource: lambda.function,
        value: nf.format(lambda.invocations),
        unit: "invoke",
        secondary:
          lambda.last_duration_ms != null
            ? `${lambda.last_duration_ms} ms terakhir`
            : lambda.invocations > 0
              ? "durasi hilang saat restart"
              : "belum dipanggil",
        series: bySeries.get("lambda.invocations"),
        source: "live",
        action: "invoke",
        actionLabel: "Invoke",
      },
    ];
  }, [snapshot, bySeries]);

  const age = bySeries.get("sqs.oldest_message_age")?.at(-1)?.v;

  return (
    <main className="shell">
      <header className="top">
        <div className="brand">
          <h1>CendekiAwan</h1>
          <p>Telemetri cloud lokal · Floci :4566</p>
        </div>
        <div className="head-right">
          <Status
            ok={health?.checks?.db === "ok"}
            label={`db ${health?.checks?.db ?? "…"}`}
          />
          <Status
            ok={health?.checks?.emulator === "ok"}
            label={`emulator ${health?.checks?.emulator ?? "…"}`}
          />
          <span className="sync">
            {lastSync ? `sync ${clock(lastSync)}` : "menunggu…"}
          </span>
        </div>
      </header>

      {error ? (
        <div className="banner" role="alert">
          <span>{error}</span>
          <button className="action" onClick={refresh}>
            Coba lagi
          </button>
        </div>
      ) : null}

      <section className="board" aria-label="Lima service">
        {rows.length
          ? rows.map((row) => (
              <ServiceRow
                key={row.key}
                row={row}
                onAction={act}
                onOpen={() => setOpenKey(row.key)}
                busy={busy}
              />
            ))
          : Array.from({ length: 5 }, (_, index) => (
              <div className="skeleton" key={index} />
            ))}
      </section>

      <section className="split">
        <div className="panel">
          <h2>SQS depth — 15 menit</h2>
          <p className="sub">
            sumber GetQueueAttributes · sampel 5 dtk
            {age != null
              ? ` · umur tertua ${Math.round(age)} dtk (CloudWatch 60 dtk)`
              : ""}
          </p>
          <DepthChart points={bySeries.get("sqs.depth") ?? []} />
        </div>
        <div className="panel">
          <h2>SNS fanout</h2>
          <p className="sub">topic → queue · subscription aktif</p>
          {snapshot?.sns?.status === "ok" ? (
            <FanoutGraph
              topic={snapshot.sns.topic}
              queue={snapshot.sqs?.queue ?? "queue"}
              subscriptions={snapshot.sns.subscriptions}
            />
          ) : (
            <p className="empty">SNS belum merespons.</p>
          )}
        </div>
      </section>

      <section className="panel" aria-label="Audit log">
        <h2>Aksi terakhir</h2>
        <p className="sub">ditulis ke Postgres · 12 terbaru</p>
        <EventFeed events={events} />
      </section>

      {openKey ? (
        <ServiceDrawer
          row={rows.find((row) => row.key === openKey)}
          runId={runId}
          busy={busy}
          onAction={act}
          onClose={() => setOpenKey(null)}
        />
      ) : null}
    </main>
  );
}