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

export const getHealth = () => fetch("/health").then(json);

export const runAction = (action, body = {}) =>
  fetch(`/api/actions/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(json);