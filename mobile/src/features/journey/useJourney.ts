import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { api, ApiError } from '../../services/api';
import type { Day } from '../../types';
import { advanceSimulation, distance, gpsState, simulationState, type Journey, type JourneyState, type RoutePlan } from './model';

export function useJourney(rideId: string, enabled: boolean) {
  const [local, setLocal] = useState<Journey | null>(null), [remote, setRemote] = useState<Journey | null>(null);
  const [position, setPosition] = useState<JourneyState | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const current = useRef<Journey | null>(null), state = useRef<JourneyState | null>(null);
  const gps = useRef<Location.LocationSubscription | null>(null), timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const alive = useRef(false), generation = useRef(0), sequence = useRef(0), publishing = useRef(false), starting = useRef(false);
  const startedAt = useRef(0), skipMs = useRef(0), gpsLeg = useRef(0), boardingUntil = useRef(0), lastFix = useRef(0);
  const endpoint = `/api/rides/${rideId}/journey`;

  const cleanup = useCallback(() => {
    generation.current++;gps.current?.remove();gps.current = null;
    if (timer.current) clearInterval(timer.current);timer.current = null;
    const old = current.current;current.current = null;state.current = null;
    setLocal(null);setPosition(null);setBusy(false);
    if (old) void api(`${endpoint}/${old.id}`, 'DELETE').catch(() => { /* Server lease expires after 30 seconds even offline. */ });
  }, [endpoint]);

  useFocusEffect(useCallback(() => {
    if (!enabled) return;
    let closed = false, pollVersion = 0, pollTimer: ReturnType<typeof setTimeout> | undefined;
    alive.current = AppState.currentState === 'active' || AppState.currentState == null;
    const poll = async () => {
      const epoch = generation.current, pollEpoch = pollVersion;
      if (!alive.current || closed) return;
      if (!current.current && !starting.current) {
        try {
          const next = await api<Journey | null>(endpoint);
          if (!closed && alive.current && epoch === generation.current) { setRemote(next);setError(''); }
        } catch (e) {
          if (!closed && alive.current && epoch === generation.current) { setRemote(null);setError(e instanceof Error ? e.message : 'Falha ao acompanhar a viagem.'); }
        }
      }
      if (!closed && alive.current && pollEpoch === pollVersion) pollTimer = setTimeout(() => { void poll(); }, 2000);
    };
    void poll();
    const subscription = AppState.addEventListener('change', next => {
      const wasActive = alive.current;alive.current = next === 'active';
      pollVersion++;
      if (pollTimer) clearTimeout(pollTimer);
      if (!alive.current) { cleanup();setRemote(null); }
      else if (!wasActive) void poll();
    });
    return () => { closed = true;alive.current = false;subscription.remove();if (pollTimer) clearTimeout(pollTimer);cleanup();setRemote(null); };
  }, [enabled, endpoint, cleanup]));

  const publish = useCallback(async () => {
    const journey = current.current, snapshot = state.current, epoch = generation.current;
    if (!journey || !snapshot || publishing.current || !alive.current) return;
    publishing.current = true;
    try {
      const updated = await api<Journey>(`${endpoint}/${journey.id}`, 'PUT', { sequence: ++sequence.current, state: snapshot });
      if (alive.current && epoch === generation.current && current.current?.id === journey.id) { current.current = updated;setLocal(updated);setError(''); }
    } catch (e) {
      if (alive.current && epoch === generation.current) {
        if (e instanceof ApiError && [400, 401, 403, 404, 409].includes(e.status)) cleanup();
        setError(e instanceof Error ? e.message : 'Falha ao transmitir a localização.');
      }
    } finally { publishing.current = false; }
  }, [endpoint, cleanup]);

  async function start(plan: RoutePlan, day: Day, source: 'simulator' | 'gps') {
    if (starting.current || current.current || !alive.current) return;
    starting.current = true;setBusy(true);setError('');
    const epoch = ++generation.current;
    const valid = () => alive.current && epoch === generation.current;
    try {
      let initial = simulationState(plan, 0);
      if (source === 'gps') {
        const permission = await Location.requestForegroundPermissionsAsync();if (!valid()) return;
        if (!permission.granted) throw new Error('Localização não autorizada. Autorize o GPS nas configurações ou use a simulação.');
        if (!await Location.hasServicesEnabledAsync()) throw new Error('Ative a localização do aparelho.');
        const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });if (!valid()) return;
        initial = gpsState(plan, 0, { lat: fix.coords.latitude, lng: fix.coords.longitude });lastFix.current = Date.now();
      }
      const journey = await api<Journey>(endpoint, 'POST', { day, source, plan, state: initial });
      if (!valid()) { void api(`${endpoint}/${journey.id}`, 'DELETE').catch(() => {});return; }
      current.current = journey;state.current = initial;setLocal(journey);setRemote(null);setPosition(initial);
      sequence.current = 0;startedAt.current = Date.now();skipMs.current = 0;gpsLeg.current = 0;boardingUntil.current = 0;
      if (source === 'gps') {
        const subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 0 }, fix => {
          if (!valid() || state.current?.progress.phase !== 'moving') return;
          const next = gpsState(plan, gpsLeg.current, { lat: fix.coords.latitude, lng: fix.coords.longitude });
          lastFix.current = Date.now();state.current = next;setPosition(next);
        });
        if (!valid()) { subscription.remove();return; }gps.current = subscription;
      }
      let lastPublished = 0;
      timer.current = setInterval(() => {
        if (!valid() || !current.current) return;
        const now = Date.now();
        if (source === 'simulator') state.current = simulationState(plan, now - startedAt.current + skipMs.current);
        else if (state.current?.progress.phase === 'boarding') {
          if (now >= boardingUntil.current) {
            gpsLeg.current++;state.current = gpsState(plan, gpsLeg.current, state.current);lastFix.current = now;
          } else state.current = { ...state.current, boardingLeft: Math.ceil((boardingUntil.current - now) / 1000) };
        }
        if (source === 'gps' && state.current?.progress.phase === 'moving' && now - lastFix.current > 20000) {
          cleanup();setError('GPS sem atualização por 20 segundos. A transmissão foi interrompida; confira a localização e inicie novamente.');return;
        }
        setPosition(state.current);
        if (now - lastPublished >= 2000) { lastPublished = now;void publish(); }
      }, 250);
      void publish();
    } catch (e) {
      if (valid()) { cleanup();setError(e instanceof Error ? e.message : 'Não foi possível iniciar a viagem.'); }
    } finally { starting.current = false;if (alive.current) setBusy(false); }
  }

  async function stop() {
    const old = current.current ?? remote;
    cleanup();setRemote(null);setError('');
    if (old) { setBusy(true);try { await api(`${endpoint}/${old.id}`, 'DELETE'); } catch(e) { if (alive.current) setError(e instanceof Error ? e.message : 'Transmissão encerrada localmente; aguardando expiração no servidor.'); } finally { if (alive.current) setBusy(false); } }
  }
  function advance() {
    const journey = current.current, value = state.current;
    if (!journey || !value || value.progress.phase !== 'moving') return;
    if (journey.source === 'simulator') {
      const elapsed = Date.now() - startedAt.current + skipMs.current;
      skipMs.current += advanceSimulation(journey.plan, elapsed) - elapsed;return;
    }
    const target = journey.plan.stops[value.progress.nextStopIndex];
    if (distance(value, target) > 150) { setError('Aproxime-se do ponto (até 150 m) para confirmar a chegada.');return; }
    const arrived = target.kind === 'destination';
    state.current = { ...value, progress: { ...value.progress, fraction: 1, phase: arrived ? 'arrived' : 'boarding' }, boardingLeft: arrived ? 0 : 5 };
    if (arrived) { gps.current?.remove();gps.current = null; }
    else boardingUntil.current = Date.now() + 5000;
    setPosition(state.current);setError('');void publish();
  }
  return { local, remote, position, error, busy, start, stop, advance };
}
