export default function FanoutGraph({ topic, queue, subscriptions }) {
  return (
    <svg
      className="fanout"
      viewBox="0 0 320 170"
      role="img"
      aria-label={`Topologi SNS: topic ${topic} mengirim ke queue ${queue}, ${subscriptions} subscription`}
    >
      <rect className="node" x="12" y="58" width="118" height="52" rx="10" />
      <text x="71" y="80" textAnchor="middle">
        SNS topic
      </text>
      <text x="71" y="96" textAnchor="middle" className="muted">
        {topic}
      </text>

      <rect className="node" x="190" y="58" width="118" height="52" rx="10" />
      <text x="249" y="80" textAnchor="middle">
        SQS queue
      </text>
      <text x="249" y="96" textAnchor="middle" className="muted">
        {queue}
      </text>

      <path className="link" d="M130 84 C158 84, 162 84, 190 84" />
      <text x="160" y="74" textAnchor="middle" className="muted">
        {subscriptions}×
      </text>
      <text x="160" y="122" textAnchor="middle" className="muted">
        fanout
      </text>
    </svg>
  );
}