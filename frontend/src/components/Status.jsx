export default function Status({ state = "pending", label }) {
  return (
    <span className={`status ${state}`}>
      <span className="led" aria-hidden="true" />
      {label}
    </span>
  );
}