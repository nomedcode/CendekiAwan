async function json(response) {
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

export const getSnapshot = () => fetch("/api/snapshot").then(json);

export const getMetrics = (minutes = 15) =>
  fetch(`/api/metrics?minutes=${minutes}&limit=5000`).then(json);

export const getEvents = (limit = 12) =>
  fetch(`/api/events?limit=${limit}`).then(json);

export async function getHealth() {
  const response = await fetch("/health");
  const body = await response.json().catch(() => null);
  if (body?.checks) return body;
  if (body?.detail?.db) {
    return { status: "error", checks: { db: body.detail.db } };
  }
  return {
    status: response.ok ? "ok" : "error",
    checks: response.ok ? {} : { db: "error" },
  };
}

export const runAction = (action, body = {}) =>
  fetch(`/api/actions/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(json);