import { useEffect, useState } from "react";

const DIAGRAMS = {
  sqs: {
    nodes: [
      { x: 12, y: 78, w: 150, h: 64, title: "Browser + API", sub: "FastAPI" },
      { x: 205, y: 78, w: 150, h: 64, title: "SQS queue", sub: "cendekiawan-queue" },
      { x: 398, y: 78, w: 150, h: 64, title: "Consumer", sub: "belum ada" },
    ],
    wires: ["M162 110 H205", "M355 110 H398"],
    motion: "M162 110 H398",
    steps: [
      "Browser memanggil POST /api/actions/simulate.",
      "Backend mengirim SendMessageBatch berisi 10 pesan.",
      "Pesan tersimpan di queue; ApproximateNumberOfMessages bertambah.",
      "Tanpa consumer, pesan tetap di queue. Karena itu depth hanya naik dan tidak turun.",
    ],
  },
  s3: {
    nodes: [
      { x: 12, y: 78, w: 150, h: 64, title: "Browser + API", sub: "FastAPI" },
      { x: 205, y: 78, w: 150, h: 64, title: "Bucket", sub: "cendekiawan-bucket" },
      { x: 398, y: 78, w: 150, h: 64, title: "Object", sub: "sample-*.txt" },
    ],
    wires: ["M162 110 H205", "M355 110 H398"],
    motion: "M162 110 H398",
    steps: [
      "Tombol Upload memanggil POST /api/actions/upload.",
      "Backend memanggil PutObject dengan key acak dan body kecil.",
      "S3 menyimpan body beserta metadata objek.",
      "ListObjectsV2 menghitung jumlah objek dan total byte untuk kartu.",
    ],
  },
  sns: {
    nodes: [
      { x: 12, y: 78, w: 150, h: 64, title: "Publisher", sub: "FastAPI" },
      { x: 205, y: 78, w: 150, h: 64, title: "SNS topic", sub: "cendekiawan-topic" },
      { x: 398, y: 40, w: 150, h: 52, title: "SQS queue", sub: "subscription" },
      { x: 398, y: 120, w: 150, h: 52, title: "Subscription", sub: "Hanya satu aktif" },
    ],
    wires: ["M162 110 H205", "M355 110 L398 66", "M355 110 L398 146"],
    motion: "M162 110 H355 L398 66",
    steps: [
      "Tombol Publish memanggil SNS Publish.",
      "Topic mencocokkan pesan dengan daftar subscription.",
      "Subscription SQS menerima salinan pesan.",
      "Queue depth ikut naik. Inilah fanout: satu publish, banyak penerima.",
    ],
  },
  dynamodb: {
    nodes: [
      { x: 12, y: 78, w: 150, h: 64, title: "Browser + API", sub: "FastAPI" },
      { x: 205, y: 78, w: 150, h: 64, title: "Table", sub: "cendekiawan-table" },
      { x: 398, y: 78, w: 150, h: 64, title: "Partition", sub: "hash dari id" },
    ],
    wires: ["M162 110 H205", "M355 110 H398"],
    motion: "M162 110 H398",
    steps: [
      "Tombol Tulis item memanggil POST /api/actions/item.",
      "Backend memanggil PutItem dengan partition key id.",
      "DynamoDB menghitung hash key dan menaruh item di partisi itu.",
      "Kartu menghitung item dengan Scan Select=COUNT, bukan DescribeTable.ItemCount.",
    ],
  },
  lambda: {
    nodes: [
      { x: 12, y: 78, w: 150, h: 64, title: "Browser + API", sub: "FastAPI" },
      { x: 205, y: 78, w: 150, h: 64, title: "Lambda runtime", sub: "container" },
      { x: 398, y: 78, w: 150, h: 64, title: "Response", sub: "{ ok: true }" },
    ],
    wires: ["M162 110 H205", "M355 110 H398"],
    motion: "M162 110 H398",
    steps: [
      "Tombol Invoke memanggil POST /api/actions/invoke.",
      "Floci menyiapkan container runtime. Invoke pertama membayar cold start.",
      "Handler mengembalikan JSON kecil.",
      "Backend mengukur durasi dan mencatat invocation sukses di audit.",
    ],
  },
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (event) => setReduced(event.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export default function ServiceDiagram({ service, runId }) {
  const diagram = DIAGRAMS[service];
  const reduced = useReducedMotion();
  if (!diagram) return null;

  return (
    <svg
      className="diagram"
      viewBox="0 0 560 220"
      role="img"
      aria-label={`Diagram alur kerja ${service}`}
    >
      {diagram.wires.map((wire) => (
        <path key={wire} className="wire" d={wire} />
      ))}
      {diagram.nodes.map((node) => (
        <g key={node.title}>
          <rect
            className="node"
            x={node.x}
            y={node.y}
            width={node.w}
            height={node.h}
            rx="10"
          />
          <text x={node.x + node.w / 2} y={node.y + 26} textAnchor="middle">
            {node.title}
          </text>
          <text
            x={node.x + node.w / 2}
            y={node.y + 44}
            textAnchor="middle"
            className="sub"
          >
            {node.sub}
          </text>
        </g>
      ))}
      {reduced ? null : (
        <circle key={runId} r="5" className="packet">
          <animateMotion
            dur="1.4s"
            fill="freeze"
            repeatCount="1"
            path={diagram.motion}
          />
        </circle>
      )}
    </svg>
  );
}

export function diagramSteps(service) {
  return DIAGRAMS[service]?.steps ?? [];
}