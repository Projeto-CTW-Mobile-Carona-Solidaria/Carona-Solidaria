import { api } from '../../services/api';
import { optimalOrder, type Geo, type RoutePlan, type Segment, type Stop } from './model';

export type StopDraft = Pick<Stop, 'id' | 'passengerId' | 'label' | 'kind' | 'address'>;
export async function resolveAddress(address: string): Promise<Geo & { displayName: string }> {
  const coords = address.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (coords) {
    const lat = Number(coords[1]), lng = Number(coords[2]);
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('Coordenadas fora do intervalo permitido.');
    return { lat, lng, displayName: address.trim() };
  }
  return api('/api/navigation/geocode', 'POST', { address: address.trim() });
}

export async function planRoute(drafts: StopDraft[], optimize: boolean, report: (message: string) => void, isCurrent: () => boolean): Promise<RoutePlan> {
  const check = () => { if (!isCurrent()) throw new Error('Cálculo cancelado.'); };
  const stops: Stop[] = [];
  for (const draft of drafts) {
    check();report(`Localizando ${draft.label}…`);
    const point = await resolveAddress(draft.address);check();
    stops.push({ ...draft, ...point, address: point.displayName.slice(0, 300), order: stops.length });
  }
  let ordered = stops;
  if (optimize && stops.length > 3) {
    report('Otimizando a ordem dos embarques…');
    const matrix = await api<(number | null)[][]>('/api/navigation/durations', 'POST', { points: stops.map(({ lat, lng }) => ({ lat, lng })) });check();
    ordered = [stops[0], ...optimalOrder(matrix).map(index => stops[index]), stops[stops.length - 1]];
  }
  ordered = ordered.map((stop, order) => ({ ...stop, order }));
  const segments: Segment[] = [];
  for (let i = 0; i < ordered.length - 1; i++) {
    check();report(`Calculando trecho ${i + 1} de ${ordered.length - 1}…`);
    const segment = await api<Segment>('/api/navigation/route', 'POST', { points: [ordered[i], ordered[i + 1]].map(({ lat, lng }) => ({ lat, lng })) });check();
    segments.push({ ...segment, fromIndex: i, toIndex: i + 1 });
  }
  return { stops: ordered, segments, totalDistance: segments.reduce((n, s) => n + s.distance, 0), totalDuration: segments.reduce((n, s) => n + s.duration, 0) };
}
