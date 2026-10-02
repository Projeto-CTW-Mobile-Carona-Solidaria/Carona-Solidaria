import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceSimulation, optimalOrder, routePoint, simulationState, gpsState, remainingMetrics } from '../src/features/journey/model.ts';

const plan = {
  stops: [{ id: 'o', kind: 'origin', lat: 0, lng: 0 }, { id: 'p', kind: 'passenger', lat: 0, lng: 1 }, { id: 'd', kind: 'destination', lat: 0, lng: 2 }],
  segments: [{ fromIndex: 0, toIndex: 1, distance: 1000, duration: 100, geometry: [[0, 0], [0, 1]] }, { fromIndex: 1, toIndex: 2, distance: 2000, duration: 100, geometry: [[0, 1], [0, 2]] }],
  totalDistance: 3000, totalDuration: 200,
};
test('optimization respects asymmetric road times and keeps endpoints fixed', () => {
  const matrix = [[0, 20, 1, 99], [20, 0, 20, 1], [1, 1, 0, 20], [99, 99, 99, 0]];
  assert.deepEqual(optimalOrder(matrix), [2, 1]);
});
test('unreachable stops and malformed matrices do not invent a route', () => {
  assert.throws(() => optimalOrder([[0, null, 1], [null, 0, null], [1, null, 0]]), /caminho/);
  assert.throws(() => optimalOrder([[0], [1, 2]]), /inválida/);
});
test('route interpolation clamps endpoints and supports repeated points', () => {
  assert.deepEqual(routePoint([[0, 0], [0, 1]], -1), { lat: 0, lng: 0 });
  assert.deepEqual(routePoint([[0, 0], [0, 1]], 2), { lat: 0, lng: 1 });
  assert.deepEqual(routePoint([[0, 0], [0, 1]], .5), { lat: 0, lng: .5 });
  assert.deepEqual(routePoint([[0, 0], [0, 0]], .5), { lat: 0, lng: 0 });
  assert.throws(() => routePoint([], 0), /geometria/);
});
test('simulation boards for five seconds, advances stops and finishes only at destination', () => {
  assert.equal(simulationState(plan, 47499).progress.phase, 'moving');
  assert.equal(simulationState(plan, 47500).boardingLeft, 5);
  assert.equal(simulationState(plan, 50500).boardingLeft, 2);
  const next = simulationState(plan, 52500);
  assert.equal(next.progress.phase, 'moving');assert.equal(next.progress.nextStopIndex, 2);
  const end = simulationState(plan, 100000);
  assert.equal(end.progress.phase, 'arrived');assert.equal(end.lng, 2);assert.equal(end.boardingLeft, 0);
});
test('GPS retains actual coordinates and does not silently advance pickup state', () => {
  const value = gpsState(plan, 0, { lat: .0001, lng: 1 });
  assert.equal(value.lat, .0001);assert.equal(value.progress.phase, 'moving');assert.equal(value.progress.nextStopIndex, 1);
});
test('manual simulation advance stops at pickup instead of skipping boarding', () => {
  assert.equal(advanceSimulation(plan, 45000), 47500);
  assert.equal(simulationState(plan, advanceSimulation(plan, 45000)).boardingLeft, 5);
  assert.equal(advanceSimulation(plan, 48000), 48000);
});
test('remaining metrics omit completed legs and are zero after arrival', () => {
  assert.deepEqual(remainingMetrics(plan, { segmentIndex: 1, fraction: .5, phase: 'moving', nextStopIndex: 2 }), { distance: 1000, duration: 50 });
  assert.deepEqual(remainingMetrics(plan, simulationState(plan, 100000).progress), { distance: 0, duration: 0 });
});
