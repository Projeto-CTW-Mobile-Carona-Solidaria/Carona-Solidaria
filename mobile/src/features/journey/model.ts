import type { Day } from '../../types';

export type Geo = { lat: number; lng: number };
export type Stop = Geo & { id: string; passengerId: number | null; kind: 'origin' | 'passenger' | 'destination'; order: number; label: string; address: string };
export type Segment = { fromIndex: number; toIndex: number; distance: number; duration: number; geometry: [number, number][] };
export type RoutePlan = { stops: Stop[]; segments: Segment[]; totalDistance: number; totalDuration: number };
export type Progress = { segmentIndex: number; fraction: number; phase: 'moving' | 'boarding' | 'arrived'; nextStopIndex: number };
export type JourneyState = Geo & { progress: Progress; boardingLeft: number };
export type Journey = { id: string; day: Day; source: 'simulator' | 'gps'; plan: RoutePlan; state: JourneyState; updatedAt: string; sequence: number };

export function distance(a: Geo, b: Geo) {
  const r = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lng - a.lng) * r / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function routePoint(geometry: [number, number][], fraction: number): Geo {
  if (!geometry.length) throw new Error('Trecho sem geometria. Calcule a rota novamente.');
  const lengths = [0];
  for (let i = 1; i < geometry.length; i++) lengths.push(lengths[i - 1] + distance({ lat: geometry[i - 1][0], lng: geometry[i - 1][1] }, { lat: geometry[i][0], lng: geometry[i][1] }));
  const target = Math.max(0, Math.min(1, fraction)) * lengths[lengths.length - 1];
  let i = 1;
  while (i < lengths.length && lengths[i] < target) i++;
  if (i >= geometry.length) return { lat: geometry[geometry.length - 1][0], lng: geometry[geometry.length - 1][1] };
  const t = lengths[i] === lengths[i - 1] ? 0 : (target - lengths[i - 1]) / (lengths[i] - lengths[i - 1]);
  return { lat: geometry[i - 1][0] + (geometry[i][0] - geometry[i - 1][0]) * t, lng: geometry[i - 1][1] + (geometry[i][1] - geometry[i - 1][1]) * t };
}

// Exact order for the vehicle limit of eight passengers. Origin and destination stay fixed.
export function optimalOrder(durations: (number | null)[][]): number[] {
  const count = durations.length - 2;
  if (count < 0 || count > 8 || durations.some(row => row.length !== durations.length)) throw new Error('Matriz de trajetos inválida.');
  let best: number[] | null = null, bestTime = Infinity;
  const visit = (from: number, pending: number[], order: number[], elapsed: number) => {
    if (elapsed >= bestTime) return;
    if (!pending.length) {
      const last = durations[from][count + 1];
      if (last !== null && Number.isFinite(last) && last >= 0 && elapsed + last < bestTime) { bestTime = elapsed + last; best = order; }
      return;
    }
    for (const next of pending) {
      const duration = durations[from][next];
      if (duration !== null && Number.isFinite(duration) && duration >= 0) visit(next, pending.filter(i => i !== next), [...order, next], elapsed + duration);
    }
  };
  visit(0, Array.from({ length: count }, (_, i) => i + 1), [], 0);
  if (!best) throw new Error('Não há um caminho entre todas as paradas. Confira os pontos de embarque.');
  return best;
}

// A deterministic simulation clock includes five seconds of boarding at each pickup.
export function simulationState(plan: RoutePlan, elapsedMs: number): JourneyState {
  let remaining = Math.max(0, elapsedMs);
  const total = plan.totalDuration || plan.segments.length;
  for (let i = 0; i < plan.segments.length; i++) {
    const segment = plan.segments[i];
    const travelMs = Math.max(1000, 95000 * (segment.duration || 1) / total);
    if (remaining < travelMs) return { ...routePoint(segment.geometry, remaining / travelMs), progress: { segmentIndex: i, fraction: remaining / travelMs, phase: 'moving', nextStopIndex: i + 1 }, boardingLeft: 0 };
    remaining -= travelMs;
    const stop = plan.stops[i + 1];
    if (stop.kind === 'passenger' && remaining < 5000) return { lat: stop.lat, lng: stop.lng, progress: { segmentIndex: i, fraction: 1, phase: 'boarding', nextStopIndex: i + 1 }, boardingLeft: Math.ceil((5000 - remaining) / 1000) };
    if (stop.kind === 'passenger') remaining -= 5000;
  }
  const last = plan.stops[plan.stops.length - 1];
  return { lat: last.lat, lng: last.lng, progress: { segmentIndex: plan.segments.length - 1, fraction: 1, phase: 'arrived', nextStopIndex: plan.stops.length - 1 }, boardingLeft: 0 };
}

export function advanceSimulation(plan: RoutePlan, elapsedMs: number, stepMs = 10000) {
  const progress = simulationState(plan, elapsedMs).progress;
  if (progress.phase !== 'moving') return elapsedMs;
  let boundary = 0;
  for (let i = 0; i <= progress.segmentIndex; i++) {
    boundary += Math.max(1000, 95000 * (plan.segments[i].duration || 1) / (plan.totalDuration || plan.segments.length));
    if (i < progress.segmentIndex && plan.stops[i + 1].kind === 'passenger') boundary += 5000;
  }
  return Math.min(elapsedMs + stepMs, boundary);
}

// GPS follows the current leg; an explicit pickup confirmation advances to the next leg.
export function gpsState(plan: RoutePlan, segmentIndex: number, point: Geo): JourneyState {
  const geometry = plan.segments[segmentIndex].geometry;
  let nearest = 0, best = Infinity;
  geometry.forEach(([lat, lng], i) => { const d = distance(point, { lat, lng }); if (d < best) { best = d; nearest = i; } });
  const lengths = geometry.map((p, i) => i ? distance({ lat: geometry[i - 1][0], lng: geometry[i - 1][1] }, { lat: p[0], lng: p[1] }) : 0);
  const total = lengths.reduce((a, b) => a + b, 0);
  const fraction = total ? lengths.slice(0, nearest + 1).reduce((a, b) => a + b, 0) / total : 0;
  return { ...point, progress: { segmentIndex, fraction, phase: 'moving', nextStopIndex: segmentIndex + 1 }, boardingLeft: 0 };
}

export function remainingMetrics(plan: RoutePlan, progress?: Progress) {
  if (progress?.phase === 'arrived') return { distance: 0, duration: 0 };
  return plan.segments.reduce((result, segment, i) => {
    const factor = !progress || i > progress.segmentIndex ? 1 : i === progress.segmentIndex ? 1 - progress.fraction : 0;
    return { distance: result.distance + segment.distance * factor, duration: result.duration + segment.duration * factor };
  }, { distance: 0, duration: 0 });
}
export const formatDistance = (meters: number) => meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
export const formatDuration = (seconds: number) => `${Math.ceil(seconds / 60)} min`;
