export function niceStep(raw) {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const fraction = raw / base;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * base;
}

export function niceTicks(peak) {
  const safePeak = Number.isFinite(peak) ? Math.max(0, peak) : 0;
  const step = niceStep(Math.max(safePeak / 3, 1));
  const max = Math.max(step, Math.ceil(safePeak / step) * step);
  const ticks = [];
  for (let value = 0; value <= max + 1e-9; value += step) {
    ticks.push(Number(value.toFixed(6)));
  }
  return { max, step, ticks };
}

export function timePositions(times, left, width) {
  if (!times.length) return [];
  const first = times[0];
  const span = times[times.length - 1] - first;
  return times.map((time, index) => {
    const ratio =
      span > 0 ? (time - first) / span : index / Math.max(1, times.length - 1);
    return Math.round((left + ratio * width) * 1000) / 1000;
  });
}

export function nearestIndex(x, positions) {
  let best = 0;
  let bestDistance = Infinity;
  positions.forEach((position, index) => {
    const distance = Math.abs(position - x);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}