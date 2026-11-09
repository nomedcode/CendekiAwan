export default function Status({ ok, label }) {
  return (
    <span className={`status ${ok ? "ok" : "down"}`}>
      <span className="led" aria-hidden="true" />
      {label}
    </span>
  );
}