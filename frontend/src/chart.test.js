import assert from "node:assert/strict";
import test from "node:test";
import { nearestIndex, niceStep, niceTicks, timePositions } from "./chart.js";

test("niceStep rounds up to 1/2/5 x 10^n", () => {
  assert.equal(niceStep(1), 1);
  assert.equal(niceStep(1.5), 2);
  assert.equal(niceStep(2), 2);
  assert.equal(niceStep(3.4), 5);
  assert.equal(niceStep(7), 10);
  assert.equal(niceStep(33), 50);
});

test("niceStep falls back to 1 for non-positive or non-finite input", () => {
  assert.equal(niceStep(0), 1);
  assert.equal(niceStep(Number.NaN), 1);
});

test("niceTicks returns integer ticks that cover the peak", () => {
  assert.deepEqual(niceTicks(10), { max: 10, step: 5, ticks: [0, 5, 10] });
  assert.deepEqual(niceTicks(13), { max: 15, step: 5, ticks: [0, 5, 10, 15] });
  assert.deepEqual(niceTicks(2), { max: 2, step: 1, ticks: [0, 1, 2] });
  assert.deepEqual(niceTicks(0), { max: 1, step: 1, ticks: [0, 1] });
  assert.deepEqual(niceTicks(Number.NaN), { max: 1, step: 1, ticks: [0, 1] });
});

test("timePositions spaces points by elapsed time", () => {
  assert.deepEqual(timePositions([0, 5000, 15000], 100, 600), [100, 300, 700]);
});

test("timePositions falls back to even spacing when timestamps are equal", () => {
  assert.deepEqual(timePositions([0, 0, 0], 100, 600), [100, 400, 700]);
});

test("timePositions returns an empty array for no timestamps", () => {
  assert.deepEqual(timePositions([], 100, 600), []);
});

test("nearestIndex picks the closest position and clamps at the ends", () => {
  const xs = [100, 300, 700];
  assert.equal(nearestIndex(0, xs), 0);
  assert.equal(nearestIndex(100, xs), 0);
  assert.equal(nearestIndex(310, xs), 1);
  assert.equal(nearestIndex(450, xs), 1);
  assert.equal(nearestIndex(699, xs), 2);
  assert.equal(nearestIndex(999, xs), 2);
});

test("nearestIndex returns 0 for an empty position list", () => {
  assert.equal(nearestIndex(500, []), 0);
});