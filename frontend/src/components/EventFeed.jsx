import Status from "./Status";

function clock(value) {
  return new Date(value).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function EventFeed({ events }) {
  if (!events?.length) {
    return (
      <p className="empty">
        Belum ada aksi. Tekan tombol di baris service untuk menulis audit.
      </p>
    );
  }

  return (
    <div className="feed">
      {events.map((event) => (
        <div className="feed-row" key={event.id}>
          <time dateTime={event.created_at}>{clock(event.created_at)}</time>
          <span className="act">{event.action}</span>
          <span className="tgt" title={event.target}>
            {event.target}
          </span>
          <Status
            state={event.status === "ok" ? "ok" : "down"}
            label={event.status}
          />
        </div>
      ))}
    </div>
  );
}