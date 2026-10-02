import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  Image,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { io, Socket } from 'socket.io-client';
import { MAP_HTML } from './src/mapHtml';
import { dark, light, WEG } from './src/theme';

const ENV_API_BASE_URL = ((globalThis as any)?.process?.env?.EXPO_PUBLIC_API_BASE_URL) as string | undefined;
const API_BASE_URL = (ENV_API_BASE_URL || (Platform.OS === 'web' && typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : 'http://localhost:3001')).replace(/\/$/, '');
const OSRM_BASE = 'https://router.project-osrm.org';
const SIMULATOR_TOTAL_MS = 95000;
const BOARDING_MS = 5000;

type Role = 'driver' | 'passenger';
type Source = 'simulator' | 'gps';
type StopKind = 'origin' | 'passenger' | 'destination';
type RidePhase = 'idle' | 'moving' | 'boarding' | 'arrived';

type Geo = { lat: number; lng: number };
type Stop = Geo & { id: string; kind: StopKind; order: number; label: string; address: string };
type Segment = {
  id: string;
  fromIndex: number;
  toIndex: number;
  distance: number;
  duration: number;
  geometry: [number, number][];
};
type RoutePlan = { stops: Stop[]; segments: Segment[]; totalDistance: number; totalDuration: number };
type ProgressState = { segmentIndex: number; fraction: number; phase: RidePhase; nextStopIndex: number };
type DriverUpdate = {
  driverId: string;
  lat: number;
  lng: number;
  timestamp: number;
  source: Source;
  progress: ProgressState | null;
  routePlan: RoutePlan | null;
  boardingLeft?: number;
};
type GeocodeResult = Geo & { displayName: string; precision?: string };
type PassengerDraft = { id: string; address: string };

const DEMO: { origin: string; passengers: string[]; destination: string } = {
  origin: 'Rua Emidia Prestini Gascho, 101, Santa Luzia, Jaraguá do Sul, SC, Brasil',
  passengers: [
    'Rua Feliciano Bortolini, 1246, Barra do Rio Cerro, Jaraguá do Sul, SC, Brasil',
    'Rua Francisco Jacomini, 211, Boa Vista, Jaraguá do Sul, SC, Brasil',
    'Rua Walter Marquardt, 1111, Barra do Rio Molha, Jaraguá do Sul, SC, Brasil',
  ],
  destination: 'Avenida Prefeito Waldemar Grubba, 3300, Vila Lalau, Jaraguá do Sul, SC, Brasil',
};

function fmtDistance(m: number) {
  if (!Number.isFinite(m)) return '--';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km`;
}

function fmtDuration(sec: number) {
  if (!Number.isFinite(sec)) return '--';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

function haversine(a: Geo, b: Geo) {
  const R = 6371000;
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const lat1 = a.lat * r;
  const lat2 = b.lat * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function routePoint(geometry: [number, number][], fraction: number): Geo | null {
  if (!geometry.length) return null;
  if (geometry.length === 1) return { lat: geometry[0][0], lng: geometry[0][1] };
  const distances = [0];
  let total = 0;
  for (let i = 1; i < geometry.length; i += 1) {
    total += haversine(
      { lat: geometry[i - 1][0], lng: geometry[i - 1][1] },
      { lat: geometry[i][0], lng: geometry[i][1] },
    );
    distances.push(total);
  }
  const target = Math.max(0, Math.min(1, fraction)) * total;
  let i = 1;
  while (i < distances.length && distances[i] < target) i += 1;
  i = Math.min(i, distances.length - 1);
  const d0 = distances[i - 1];
  const d1 = distances[i];
  const t = (target - d0) / Math.max(1, d1 - d0);
  return {
    lat: geometry[i - 1][0] + (geometry[i][0] - geometry[i - 1][0]) * t,
    lng: geometry[i - 1][1] + (geometry[i][1] - geometry[i - 1][1]) * t,
  };
}

async function geocode(address: string): Promise<GeocodeResult> {
  const url = `${API_BASE_URL}/api/geocode?address=${encodeURIComponent(address)}`;
  const response = await fetch(url, { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } });
  let data: any = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) throw new Error(data?.error || `Falha ao localizar o endereço (HTTP ${response.status}).`);
  return data;
}

async function fetchRoute(a: Geo, b: Geo): Promise<Segment> {
  const url = `${OSRM_BASE}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson&steps=false`;
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok || data.code !== 'Ok' || !data.routes?.[0]) {
    throw new Error(data.message || 'O OSRM não encontrou uma rota para este trecho.');
  }
  return {
    id: '', fromIndex: 0, toIndex: 0,
    distance: data.routes[0].distance,
    duration: data.routes[0].duration,
    geometry: (data.routes[0].geometry?.coordinates || []).map((c: [number, number]) => [c[1], c[0]]),
  };
}

async function optimizeStops(origin: Stop, passengers: Stop[], destination: Stop) {
  if (passengers.length < 2) return passengers;

  const allStops = [origin, ...passengers, destination];
  const coordinates = allStops.map((p) => `${p.lng},${p.lat}`).join(';');
  const passengerCount = passengers.length;

  // Para até 8 passageiros, calculamos a ordem exata usando a matriz de
  // tempos do OSRM. Isso garante que a ordem escolhida minimize o tempo
  // viário total mantendo origem e destino fixos.
  if (passengerCount <= 8) {
    const tableUrl = `${OSRM_BASE}/table/v1/driving/${coordinates}?annotations=duration`;
    const tableResponse = await fetch(tableUrl, { cache: 'no-store' });
    const tableData = await tableResponse.json();

    if (tableResponse.ok && tableData.code === 'Ok' && Array.isArray(tableData.durations)) {
      const durations: (number | null)[][] = tableData.durations;
      let bestOrder: number[] | null = null;
      let bestDuration = Number.POSITIVE_INFINITY;

      const used = new Array(passengerCount).fill(false);
      const currentOrder: number[] = [];

      const search = (currentInputIndex: number, elapsed: number) => {
        if (elapsed >= bestDuration) return;

        if (currentOrder.length === passengerCount) {
          const finalLeg = durations[currentInputIndex]?.[allStops.length - 1];
          if (finalLeg == null) return;
          const total = elapsed + finalLeg;
          if (total < bestDuration) {
            bestDuration = total;
            bestOrder = [...currentOrder];
          }
          return;
        }

        for (let passengerIndex = 0; passengerIndex < passengerCount; passengerIndex += 1) {
          if (used[passengerIndex]) continue;
          const inputIndex = passengerIndex + 1;
          const leg = durations[currentInputIndex]?.[inputIndex];
          if (leg == null) continue;

          used[passengerIndex] = true;
          currentOrder.push(passengerIndex);
          search(inputIndex, elapsed + leg);
          currentOrder.pop();
          used[passengerIndex] = false;
        }
      };

      search(0, 0);
      if (bestOrder !== null) {
        return (bestOrder as number[]).map((index: number) => passengers[index]);
      }
    }
  }

  // Para mais de 8 passageiros (ou se a matriz falhar), usamos o Trip do OSRM.
  // O retorno de waypoints vem na ordem das coordenadas de entrada; o
  // waypoint_index informa a posição daquele ponto na viagem otimizada.
  const tripUrl = `${OSRM_BASE}/trip/v1/driving/${coordinates}?source=first&destination=last&roundtrip=false&steps=false&overview=false`;
  const tripResponse = await fetch(tripUrl, { cache: 'no-store' });
  const tripData = await tripResponse.json();
  if (!tripResponse.ok || tripData.code !== 'Ok' || !Array.isArray(tripData.waypoints)) return passengers;

  const ordered = tripData.waypoints
    .map((wp: any, inputIndex: number) => ({
      inputIndex,
      tripIndex: wp.waypoint_index,
    }))
    .filter(({ inputIndex, tripIndex }: { inputIndex: number; tripIndex: number }) =>
      inputIndex > 0 && inputIndex < allStops.length - 1 && Number.isInteger(tripIndex),
    )
    .sort((a: { tripIndex: number }, b: { tripIndex: number }) => a.tripIndex - b.tripIndex);

  if (ordered.length !== passengerCount) return passengers;
  return ordered.map(({ inputIndex }: { inputIndex: number }) => passengers[inputIndex - 1]);
}

function niceStopName(stop: Stop) {
  if (stop.kind === 'origin') return 'Saída';
  if (stop.kind === 'destination') return 'WEG';
  return `Passageiro ${stop.order}`;
}

export default function App() {
  const systemScheme = useColorScheme();
  const { width, height } = useWindowDimensions();
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(systemScheme === 'dark' ? 'dark' : 'light');
  const colors = themeMode === 'dark' ? dark : light;
  const isCompact = width < 720;

  const [role, setRole] = useState<Role>('driver');
  const [source, setSource] = useState<Source>('simulator');
  const [originAddress, setOriginAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('Avenida Prefeito Waldemar Grubba, 3300, Vila Lalau, Jaraguá do Sul, SC, Brasil');
  const [passengers, setPassengers] = useState<PassengerDraft[]>([{ id: 'p-1', address: '' }]);
  const [optimize, setOptimize] = useState(true);
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [status, setStatus] = useState<RidePhase>('idle');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Adicione os endereços para montar a viagem.');
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [segmentFraction, setSegmentFraction] = useState(0);
  const [boardingStopIndex, setBoardingStopIndex] = useState<number | null>(null);
  const [boardingLeft, setBoardingLeft] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [editingRoute, setEditingRoute] = useState(true);
  const [remoteDriver, setRemoteDriver] = useState<DriverUpdate | null>(null);
  const [remotePlan, setRemotePlan] = useState<RoutePlan | null>(null);
  const [connectionText, setConnectionText] = useState('Conectando');
  const [driverId] = useState(`WEG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);

  const isDriverRole = role === 'driver';
  const isPassengerRole = role === 'passenger';
  const mapRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const animationRef = useRef<number | null>(null);
  const boardingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gpsWatchRef = useRef<Location.LocationSubscription | null>(null);
  const simulatorStartedAtRef = useRef(0);
  const simulatorStartSegmentRef = useRef(0);
  const lastSocketBroadcastRef = useRef(0);
  const lastBoardingBroadcastRef = useRef(999);
  const themeInitializedRef = useRef(false);

  const activePlan = role === 'driver' ? routePlan : remotePlan;
  const activeProgress: ProgressState | null = role === 'driver'
    ? { segmentIndex: currentSegmentIndex, fraction: segmentFraction, phase: status, nextStopIndex: currentSegmentIndex + 1 }
    : remoteDriver?.progress || null;
  const activeSegment = activePlan?.segments?.[activeProgress?.segmentIndex || 0];
  const totalKm = activePlan ? activePlan.totalDistance / 1000 : 0;
  const remainingDistance = useMemo(() => {
    if (!activePlan || !activeSegment) return 0;
    let total = activeSegment.distance * (1 - (activeProgress?.fraction || 0));
    for (let i = (activeProgress?.segmentIndex || 0) + 1; i < activePlan.segments.length; i += 1) total += activePlan.segments[i].distance;
    return total;
  }, [activePlan, activeProgress?.fraction, activeProgress?.segmentIndex, activeSegment]);

  useEffect(() => {
    if (themeInitializedRef.current) return;
    if (systemScheme === 'dark' || systemScheme === 'light') setThemeMode(systemScheme);
    themeInitializedRef.current = true;
  }, [systemScheme]);

  useEffect(() => { postMap({ type: 'THEME', value: themeMode }); }, [themeMode]);

  useEffect(() => {
    setConnectionText('Conectando');
    const socket = io(API_BASE_URL, { transports: ['polling', 'websocket'], timeout: 5000, reconnection: true, reconnectionAttempts: 6, reconnectionDelay: 1000 });
    socketRef.current = socket;
    const registerCurrentRole = () => socket.emit('register_role', { role, driverId: role === 'driver' ? driverId : undefined });
    socket.on('connect', () => { setConnectionText('Conectado'); registerCurrentRole(); });
    socket.on('reconnect_attempt', () => setConnectionText('Conectando'));
    socket.on('connect_error', () => {
      setConnectionText('Offline');
      setMessage('Servidor offline. Inicie o backend na porta 3001.');
    });
    socket.on('disconnect', () => setConnectionText('Offline'));
    socket.on('driver_online', ({ routePlan: incomingPlan }) => { if (role === 'passenger') setRemotePlan(incomingPlan || null); });
    socket.on('driver_offline', () => { if (role === 'passenger') { setRemoteDriver(null); setMessage('O motorista encerrou a transmissão.'); } });
    socket.on('update_map', (payload: DriverUpdate) => {
      if (role !== 'passenger') return;
      setRemoteDriver(payload);
      if (payload.routePlan) setRemotePlan(payload.routePlan);
      if (payload.progress?.phase === 'boarding') setStatus('boarding');
      else if (payload.progress?.phase === 'arrived') setStatus('arrived');
      else setStatus('moving');
    });
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [role, driverId]);

  useEffect(() => () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (boardingTimerRef.current) clearInterval(boardingTimerRef.current);
    gpsWatchRef.current?.remove();
  }, []);

  useEffect(() => {
    if (!routePlan || role !== 'driver' || source !== 'simulator' || status !== 'moving') return;
    simulatorStartedAtRef.current = Date.now();
    simulatorStartSegmentRef.current = currentSegmentIndex;
    const total = routePlan.segments.length;
    const segmentDuration = SIMULATOR_TOTAL_MS / Math.max(1, total);
    const animate = () => {
      const elapsed = Date.now() - simulatorStartedAtRef.current;
      const segmentFloat = Math.min(total - 0.00001, simulatorStartSegmentRef.current + elapsed / segmentDuration);
      const segmentIndex = Math.floor(segmentFloat);
      const fraction = segmentFloat - segmentIndex;
      setCurrentSegmentIndex(segmentIndex);
      setSegmentFraction(fraction);
      const segment = routePlan.segments[segmentIndex];
      const pos = routePoint(segment.geometry, fraction);
      if (pos) broadcastDriver(pos, { segmentIndex, fraction, phase: 'moving', nextStopIndex: segment.toIndex }, false);
      if (elapsed < SIMULATOR_TOTAL_MS) animationRef.current = requestAnimationFrame(animate);
      else {
        setCurrentSegmentIndex(total - 1);
        setSegmentFraction(1);
        handleArrivalAtStop(total);
      }
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routePlan, status, source, role]);

  useEffect(() => {
    if (role === 'passenger' && remoteDriver) {
      postMap({ type: 'DRIVER', lat: remoteDriver.lat, lng: remoteDriver.lng, plan: remotePlan, progress: remoteDriver.progress });
    }
  }, [remoteDriver, remotePlan, role]);

  useEffect(() => {
    if (activePlan) {
      postMap({ type: 'PLAN', plan: activePlan });
      postMap({ type: 'FIT', stops: activePlan.stops });
    }
  }, [activePlan]);

  useEffect(() => {
    if (activePlan && role === 'driver') {
      const seg = activePlan.segments[currentSegmentIndex];
      const pos = seg ? routePoint(seg.geometry, segmentFraction) : null;
      if (pos) postMap({ type: 'DRIVER', lat: pos.lat, lng: pos.lng, plan: activePlan, progress: activeProgress });
    }
  }, [currentSegmentIndex, segmentFraction, status]);

  function postMap(payload: any) {
    const msg = JSON.stringify(payload);
    if (Platform.OS === 'web') mapRef.current?.contentWindow?.postMessage(msg, '*');
    else mapRef.current?.postMessage(msg);
  }

  function setRoleAndReset(next: Role) {
    if (next === role) return;
    stopRide();
    setRole(next);
    setStatus('idle');
    setArrived(false);
    setRemoteDriver(null);
    if (next === 'passenger') {
      setEditingRoute(false);
      setMessage('Aguardando o motorista.');
    } else {
      setEditingRoute(true);
      setMessage('Monte a viagem para começar.');
    }
    socketRef.current?.emit('register_role', { role: next, driverId: next === 'driver' ? driverId : undefined });
  }

  function updatePassenger(id: string, address: string) { setPassengers((current) => current.map((p) => p.id === id ? { ...p, address } : p)); }
  function addPassenger() { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setPassengers((current) => [...current, { id: `p-${Date.now()}`, address: '' }]); }
  function removePassenger(id: string) { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setPassengers((current) => current.length <= 1 ? current : current.filter((p) => p.id !== id)); }

  function loadDemo() {
    setOriginAddress(DEMO.origin);
    setDestinationAddress(DEMO.destination);
    setPassengers(DEMO.passengers.map((address, index) => ({ id: `p-${index + 1}`, address })));
    setEditingRoute(true);
    setMessage('Exemplo carregado.');
  }

  async function calculateRoute() {
    if (role !== 'driver') return;
    if (!originAddress.trim()) return Alert.alert('Saída', 'Informe a casa ou o ponto de partida.');
    if (!destinationAddress.trim()) return Alert.alert('Destino', 'Informe a WEG ou o destino final.');
    const filled = passengers.filter((p) => p.address.trim());
    if (!filled.length) return Alert.alert('Passageiros', 'Adicione pelo menos uma pessoa para buscar.');
    try {
      setBusy(true);
      setMessage('Localizando endereços...');
      const originGeo = await geocode(originAddress);
      const destinationGeo = await geocode(destinationAddress);
      const passengerGeos: { draft: PassengerDraft; geo: GeocodeResult }[] = [];
      for (const draft of filled) passengerGeos.push({ draft, geo: await geocode(draft.address) });
      const originStop: Stop = { id: 'origin', kind: 'origin', order: 0, label: 'Casa', address: originAddress, ...originGeo };
      const destinationStop: Stop = { id: 'destination', kind: 'destination', order: filled.length + 1, label: 'WEG', address: destinationAddress, ...destinationGeo };
      let passengerStops: Stop[] = passengerGeos.map(({ draft, geo }, index) => ({ id: draft.id, kind: 'passenger', order: index + 1, label: `Passageiro ${index + 1}`, address: draft.address, ...geo }));
      let optimizationChanged = false;
      if (optimize && passengerStops.length > 1) {
        setMessage('Definindo a ordem das paradas...');
        const originalOrder = passengerStops.map((stop) => stop.id).join('|');
        passengerStops = await optimizeStops(originStop, passengerStops, destinationStop);
        optimizationChanged = originalOrder !== passengerStops.map((stop) => stop.id).join('|');
      }
      passengerStops = passengerStops.map((stop, index) => ({ ...stop, order: index + 1, label: `Passageiro ${index + 1}` }));
      const orderedStops = [originStop, ...passengerStops, destinationStop];
      const segments: Segment[] = [];
      for (let i = 0; i < orderedStops.length - 1; i += 1) {
        setMessage(`Calculando trecho ${i + 1} de ${orderedStops.length - 1}...`);
        const seg = await fetchRoute(orderedStops[i], orderedStops[i + 1]);
        segments.push({ ...seg, id: `segment-${i}`, fromIndex: i, toIndex: i + 1 });
      }
      const totalDistance = segments.reduce((sum, segment) => sum + segment.distance, 0);
      const totalDuration = segments.reduce((sum, segment) => sum + segment.duration, 0);
      const plan = { stops: orderedStops, segments, totalDistance, totalDuration };
      setRoutePlan(plan);
      setCurrentSegmentIndex(0);
      setSegmentFraction(0);
      setBoardingStopIndex(null);
      setBoardingLeft(0);
      setArrived(false);
      setStatus('idle');
      setEditingRoute(false);
      setMessage(optimizationChanged ? 'Rota pronta. Ordem das paradas otimizada.' : 'Rota pronta.');
      postMap({ type: 'PLAN', plan });
      postMap({ type: 'FIT', stops: plan.stops });
    } catch (error: any) {
      Alert.alert('Não foi possível calcular', error?.message || 'Verifique os endereços e tente novamente.');
      setMessage('Verifique os endereços e tente novamente.');
    } finally { setBusy(false); }
  }

  async function startRide() {
    if (!routePlan) return Alert.alert('Calcule a rota primeiro', 'Depois, inicie a transmissão.');
    setArrived(false); setBoardingStopIndex(null); setBoardingLeft(0); setSegmentFraction(0); setCurrentSegmentIndex(0); setEditingRoute(false); setStatus('moving');
    setMessage(source === 'simulator' ? 'Viagem em andamento.' : 'Transmitindo sua localização.');
    socketRef.current?.emit('driver_status', { driverId, active: true, routePlan });
    if (source === 'gps') await startGps();
  }

  async function startGps() {
    const { status: permission } = await Location.requestForegroundPermissionsAsync();
    if (permission !== 'granted') {
      setStatus('idle');
      setMessage('Permissão de localização negada.');
      return Alert.alert('Localização', 'Autorize a localização para usar o GPS real.');
    }
    gpsWatchRef.current?.remove();
    gpsWatchRef.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 1 }, (location) => {
      const pos = { lat: location.coords.latitude, lng: location.coords.longitude };
      broadcastDriver(pos, { segmentIndex: currentSegmentIndex, fraction: segmentFraction, phase: 'moving', nextStopIndex: currentSegmentIndex + 1 });
    });
  }

  function stopRide() {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (boardingTimerRef.current) clearInterval(boardingTimerRef.current);
    gpsWatchRef.current?.remove();
    gpsWatchRef.current = null;
    setStatus('idle');
    setBoardingStopIndex(null);
    setBoardingLeft(0);
    setArrived(false);
    setMessage('Viagem encerrada.');
    socketRef.current?.emit('driver_status', { driverId, active: false });
  }

  function broadcastDriver(pos: Geo, progress: ProgressState, forceSocket = false, boardingLeftValue = 0) {
    postMap({ type: 'DRIVER', lat: pos.lat, lng: pos.lng, plan: routePlan, progress });
    const now = Date.now();
    if (forceSocket || now - lastSocketBroadcastRef.current >= 500) {
      lastSocketBroadcastRef.current = now;
      socketRef.current?.emit('driver_location', { driverId, lat: pos.lat, lng: pos.lng, timestamp: now, source, progress, routePlan, boardingLeft: boardingLeftValue });
    }
  }

  function handleArrivalAtStop(nextStopIndex: number) {
    if (!routePlan) return;
    const target = routePlan.stops[nextStopIndex];
    if (!target) return;
    setSegmentFraction(1);
    setCurrentSegmentIndex(Math.max(0, nextStopIndex - 1));
    if (target.kind === 'passenger') {
      setStatus('boarding');
      setBoardingStopIndex(nextStopIndex);
      setBoardingLeft(Math.ceil(BOARDING_MS / 1000));
      lastBoardingBroadcastRef.current = 999;
      setMessage(`${target.label} embarcando...`);
      const pos = { lat: target.lat, lng: target.lng };
      broadcastDriver(pos, { segmentIndex: nextStopIndex - 1, fraction: 1, phase: 'boarding', nextStopIndex }, true, 5);
      if (boardingTimerRef.current) clearInterval(boardingTimerRef.current);
      const started = Date.now();
      boardingTimerRef.current = setInterval(() => {
        const left = Math.max(0, BOARDING_MS - (Date.now() - started));
        const seconds = Math.ceil(left / 1000);
        setBoardingLeft(seconds);
        if (seconds !== lastBoardingBroadcastRef.current) {
          lastBoardingBroadcastRef.current = seconds;
          broadcastDriver(pos, { segmentIndex: nextStopIndex - 1, fraction: 1, phase: 'boarding', nextStopIndex }, true, seconds);
        }
        if (left <= 0) {
          if (boardingTimerRef.current) clearInterval(boardingTimerRef.current);
          setBoardingStopIndex(null);
          postMap({ type: 'REMOVE_PASSENGER', id: target.id });
          const nextSegmentIndex = nextStopIndex;
          if (nextSegmentIndex >= routePlan.segments.length) finishRide();
          else {
            setCurrentSegmentIndex(nextSegmentIndex);
            setSegmentFraction(0);
            setStatus('moving');
            setBoardingLeft(0);
            setMessage(`${target.label} embarcou.`);
          }
        }
      }, 200);
    } else finishRide();
  }

  function finishRide() {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    setBoardingStopIndex(null); setBoardingLeft(0); setSegmentFraction(1); setStatus('arrived'); setArrived(true); setEditingRoute(false);
    setMessage('Chegamos à WEG.');
    const final = routePlan?.stops[routePlan.stops.length - 1];
    if (final) broadcastDriver({ lat: final.lat, lng: final.lng }, { segmentIndex: Math.max(0, (routePlan?.segments.length || 1) - 1), fraction: 1, phase: 'arrived', nextStopIndex: routePlan.stops.length - 1 }, true, 0);
    postMap({ type: 'ARRIVED_WEG' });
    socketRef.current?.emit('driver_status', { driverId, active: true, routePlan });
  }

  function manualAdvance() {
    if (!routePlan || role !== 'driver' || status !== 'moving') return;
    const step = 0.12;
    const next = segmentFraction + step;
    if (next >= 1) handleArrivalAtStop(currentSegmentIndex + 1);
    else {
      setSegmentFraction(next);
      const segment = routePlan.segments[currentSegmentIndex];
      const pos = routePoint(segment.geometry, next);
      if (pos) broadcastDriver(pos, { segmentIndex: currentSegmentIndex, fraction: next, phase: 'moving', nextStopIndex: currentSegmentIndex + 1 });
    }
  }

  function handleMapMessage(data: string) {
    if (data === 'READY') {
      postMap({ type: 'THEME', value: themeMode });
      if (activePlan) postMap({ type: 'PLAN', plan: activePlan });
    }
  }
  const onMapMessage = (event: WebViewMessageEvent) => handleMapMessage(event.nativeEvent.data);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (event: MessageEvent) => { if (typeof event.data === 'string') handleMapMessage(event.data); };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [themeMode, activePlan]);

  const isArrived = status === 'arrived' || arrived;
  const activeStop = activePlan?.stops[(activeProgress?.nextStopIndex || 1)] || activePlan?.stops[activePlan.stops.length - 1];
  const boardingTarget = boardingStopIndex !== null ? routePlan?.stops[boardingStopIndex] : null;
  const displayBoardingLeft = role === 'driver' ? boardingLeft : (remoteDriver?.boardingLeft ?? 0);
  const primaryText = busy ? 'Calculando rota' : isArrived ? 'Chegamos à WEG' : status === 'boarding' ? `Embarque — ${boardingTarget?.label || 'passageiro'}` : status === 'moving' ? 'Viagem em andamento' : activePlan ? 'Rota pronta' : 'Nova carona';

  const sheetHeight = isCompact
    ? (role === 'driver' && editingRoute
      ? Math.min(430, Math.max(320, height * 0.52))
      : role === 'driver'
        ? 245
        : 225)
    : (role === 'driver' && editingRoute ? 470 : 300);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <MapPanel ref={mapRef} onMessage={onMapMessage} />

        <View style={[styles.topBar, { paddingTop: isCompact ? 16 : 18 }]}>
          <View style={[styles.topIdentity, { backgroundColor: colors.surface }]}>
            <Image
              source={require('./assets/weg-logo.png')}
              style={styles.wegLogo}
              resizeMode="contain"
            />

            <Text style={[styles.appName, { color: colors.text }]}>
              Carona
            </Text>
          </View>
          <View style={styles.topBarRight}>
            <View style={[styles.connection, {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }]}>
              <View style={[
                styles.connectionDot,
                {
                  backgroundColor:
                    connectionText === 'Conectado'
                      ? colors.success
                      : colors.warning,
                },
              ]} />
              <Text style={[styles.connectionLabel, { color: colors.text }]}>
                {connectionText}
              </Text>
            </View>
            <View style={[styles.themeControl, {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }]}>
              <Text style={[styles.themeControlText, { color: colors.text }]}>
                {themeMode === 'dark' ? 'Escuro' : 'Claro'}
              </Text>

              <Switch
                value={themeMode === 'dark'}
                onValueChange={(v) => setThemeMode(v ? 'dark' : 'light')}
                trackColor={{
                  false: '#B6CAD8',
                  true: '#325E7F',
                }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        <View style={styles.topModeWrap}>
          <View style={[styles.modeBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable onPress={() => setRoleAndReset('driver')} style={[styles.modeButton, isDriverRole && { backgroundColor: WEG.blue }]}>
              <Text style={[styles.modeButtonText, { color: isDriverRole ? '#fff' : colors.text }]}>Motorista</Text>
            </Pressable>
            <Pressable onPress={() => setRoleAndReset('passenger')} style={[styles.modeButton, isPassengerRole && { backgroundColor: WEG.blue }]}>
              <Text style={[styles.modeButtonText, { color: isPassengerRole ? '#fff' : colors.text }]}>Passageiro</Text>
            </Pressable>
          </View>
          {isDriverRole && (
            <View style={[styles.sourceBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Pressable onPress={() => setSource('simulator')} style={[styles.sourceButton, source === 'simulator' && { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.sourceText, { color: source === 'simulator' ? WEG.blue : colors.muted }]}>Simulador</Text>
              </Pressable>
              <Pressable onPress={() => setSource('gps')} style={[styles.sourceButton, source === 'gps' && { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.sourceText, { color: source === 'gps' ? WEG.blue : colors.muted }]}>GPS</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={[styles.bottomSheet, { height: sheetHeight, backgroundColor: colors.surface, borderColor: colors.border, width: isCompact ? '100%' : 440, left: isCompact ? 0 : 18, right: isCompact ? 0 : undefined }]}>
          <View style={styles.sheetHandle} />

          {isDriverRole ? (
            editingRoute || !routePlan ? (
              <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.sheetHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetTitle, { color: colors.text }]}>Sua viagem</Text>
                    <Text style={[styles.sheetSubtitle, { color: colors.muted }]}>Defina saída, passageiros e destino.</Text>
                  </View>
                  <Pressable onPress={loadDemo} hitSlop={8}><Text style={[styles.exampleLink, { color: WEG.blue }]}>Exemplo</Text></Pressable>
                </View>
                <Field label="Saída" value={originAddress} onChangeText={setOriginAddress} placeholder="Endereço de partida" colors={colors} />
                <View style={styles.passengerHeader}>
                  <View>
                    <Text style={[styles.fieldLabel, { color: colors.muted }]}>PASSAGEIROS</Text>
                    <Text style={[styles.passengerCount, { color: colors.text }]}>{passengers.length} {passengers.length === 1 ? 'parada' : 'paradas'}</Text>
                  </View>
                  <Pressable onPress={addPassenger} style={[styles.addButton, { borderColor: WEG.blue }]}><Text style={[styles.addButtonText, { color: WEG.blue }]}>+ Adicionar</Text></Pressable>
                </View>
                {passengers.map((p, index) => (
                  <View key={p.id} style={styles.passengerRow}>
                    <View style={[styles.numberBadge, { backgroundColor: WEG.blue }]}><Text style={styles.numberBadgeText}>{index + 1}</Text></View>
                    <TextInput value={p.address} onChangeText={(text) => updatePassenger(p.id, text)} placeholder={`Endereço do passageiro ${index + 1}`} placeholderTextColor={colors.placeholder} style={[styles.input, styles.passengerInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} />
                    {passengers.length > 1 && <Pressable onPress={() => removePassenger(p.id)} hitSlop={10}><Text style={[styles.removeText, { color: colors.danger }]}>×</Text></Pressable>}
                  </View>
                ))}
                <Field label="Destino" value={destinationAddress} onChangeText={setDestinationAddress} placeholder="WEG" colors={colors} />
                <Pressable style={styles.optimizeRow} onPress={() => setOptimize((v) => !v)}>
                  <View style={[styles.checkbox, { borderColor: optimize ? WEG.blue : colors.border, backgroundColor: optimize ? WEG.blue : 'transparent' }]}>{optimize && <Text style={styles.checkMark}>✓</Text>}</View>
                  <Text style={[styles.optimizeText, { color: colors.text }]}>Otimizar ordem das paradas</Text>
                </Pressable>
                <Pressable disabled={busy} onPress={calculateRoute} style={[styles.primaryButton, { opacity: busy ? .6 : 1 }]}><Text style={styles.primaryButtonText}>{busy ? 'Calculando…' : 'Calcular rota'}</Text></Pressable>
              </ScrollView>
            ) : (
              <DriverRideSheet colors={colors} primaryText={primaryText} status={status} isArrived={isArrived} activePlan={activePlan} activeStop={activeStop} remainingDistance={remainingDistance} totalKm={totalKm} message={message} boardingLeft={displayBoardingLeft} onEdit={() => setEditingRoute(true)} onStart={startRide} onStop={stopRide} onManual={manualAdvance} source={source} />
            )
          ) : (
            <PassengerRideSheet colors={colors} primaryText={primaryText} status={status} isArrived={isArrived} activePlan={activePlan} activeStop={activeStop} remainingDistance={remainingDistance} totalKm={totalKm} boardingLeft={displayBoardingLeft} remoteDriver={remoteDriver} />
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, colors }: { label: string; value: string; onChangeText: (v: string) => void; placeholder: string; colors: any }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.placeholder} autoCapitalize="sentences" style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} />
    </View>
  );
}

function DriverRideSheet({ colors, primaryText, status, isArrived, activePlan, activeStop, remainingDistance, totalKm, message, boardingLeft, onEdit, onStart, onStop, onManual, source }: any) {
  const progress = activePlan ? Math.min(100, (((activeStop?.order || 1) - 1 + (status === 'boarding' ? 1 : 0)) / Math.max(1, activePlan.stops.length - 1)) * 100) : 0;
  return (
    <View style={styles.rideContent}>
      <View style={styles.sheetHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>{primaryText}</Text>
          <Text style={[styles.sheetSubtitle, { color: colors.muted }]}>{isArrived ? 'Todos os passageiros estão a bordo.' : activeStop ? `Próxima parada: ${niceStopName(activeStop)}` : 'Rota pronta para começar.'}</Text>
        </View>
        {!isArrived && <Pressable onPress={onEdit} hitSlop={8}><Text style={[styles.exampleLink, { color: WEG.blue }]}>Editar</Text></Pressable>}
      </View>
      {isArrived ? (
        <View style={[styles.arrivalPanel, { backgroundColor: themeToken(colors, 'arrivalBg') }]}>
          <View style={styles.arrivalMark}><Text style={styles.arrivalMarkText}>✓</Text></View>
          <Text style={[styles.arrivalTitleBig, { color: colors.success }]}>Chegamos à WEG</Text>
          <Text style={[styles.arrivalSubtitle, { color: colors.muted }]}>Viagem concluída</Text>
        </View>
      ) : (
        <>
          <View style={styles.metricsRow}>
            <View style={styles.metricBlock}><Text style={[styles.metricLabel, { color: colors.muted }]}>Falta</Text><Text style={[styles.metricValue, { color: colors.text }]}>{fmtDistance(remainingDistance)}</Text></View>
            <View style={styles.metricBlock}><Text style={[styles.metricLabel, { color: colors.muted }]}>Rota</Text><Text style={[styles.metricValue, { color: colors.text }]}>{totalKm.toFixed(totalKm >= 10 ? 0 : 1)} km</Text></View>
            <View style={styles.metricBlock}><Text style={[styles.metricLabel, { color: colors.muted }]}>Via</Text><Text style={[styles.metricValue, { color: colors.text }]}>{source === 'gps' ? 'GPS' : 'Simulada'}</Text></View>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.surfaceAlt }]}><View style={[styles.progressValue, { width: `${progress}%`, backgroundColor: WEG.blue }]} /></View>
          {status === 'boarding' && (
            <View style={[styles.boardingPanel, { backgroundColor: colors.surfaceAlt }]}>
              <View style={{ flex: 1 }}><Text style={[styles.boardingTitle, { color: colors.text }]}>Embarque</Text><Text style={[styles.boardingSub, { color: colors.muted }]}>Aguardando o passageiro entrar.</Text></View>
              <Text style={[styles.boardingCount, { color: WEG.blue }]}>{boardingLeft}s</Text>
            </View>
          )}
          <Text style={[styles.message, { color: colors.muted }]}>{message}</Text>
          <View style={styles.actionsRow}>
            {status === 'moving' || status === 'boarding' ? (
              <Pressable onPress={onStop} style={[styles.secondaryButton, { borderColor: colors.border }]}><Text style={[styles.secondaryButtonText, { color: colors.text }]}>Encerrar</Text></Pressable>
            ) : (
              <Pressable onPress={onStart} style={[styles.primaryButton, { flex: 1 }]}><Text style={styles.primaryButtonText}>Iniciar viagem</Text></Pressable>
            )}
            {source === 'simulator' && status === 'moving' && <Pressable onPress={onManual} style={[styles.secondaryButton, { borderColor: colors.border }]}><Text style={[styles.secondaryButtonText, { color: colors.text }]}>Avançar</Text></Pressable>}
          </View>
        </>
      )}
    </View>
  );
}

function PassengerRideSheet({ colors, primaryText, status, isArrived, activePlan, activeStop, remainingDistance, totalKm, boardingLeft, remoteDriver }: any) {
  const connected = Boolean(remoteDriver);
  return (
    <View style={styles.rideContent}>
      <View style={styles.sheetHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>{primaryText}</Text>
          <Text style={[styles.sheetSubtitle, { color: colors.muted }]}>{connected ? 'A localização do motorista está atualizada.' : 'Aguardando a transmissão do motorista.'}</Text>
        </View>
        <View style={[styles.liveBadge, { backgroundColor: isArrived ? colors.success : status === 'moving' || status === 'boarding' ? WEG.blue : colors.surfaceAlt }]}>
          <Text style={[styles.liveBadgeText, { color: isArrived || status === 'moving' || status === 'boarding' ? '#fff' : colors.muted }]}>{isArrived ? 'CHEGOU' : status === 'moving' ? 'AO VIVO' : status === 'boarding' ? 'EMBARQUE' : '—'}</Text>
        </View>
      </View>
      {isArrived ? (
        <View style={[styles.arrivalPanel, { backgroundColor: themeToken(colors, 'arrivalBg') }]}>
          <View style={styles.arrivalMark}><Text style={styles.arrivalMarkText}>✓</Text></View>
          <Text style={[styles.arrivalTitleBig, { color: colors.success }]}>Chegamos à WEG</Text>
          <Text style={[styles.arrivalSubtitle, { color: colors.muted }]}>A viagem terminou.</Text>
        </View>
      ) : (
        <>
          <View style={styles.metricsRow}>
            <View style={styles.metricBlock}><Text style={[styles.metricLabel, { color: colors.muted }]}>Falta</Text><Text style={[styles.metricValue, { color: colors.text }]}>{fmtDistance(remainingDistance)}</Text></View>
            <View style={styles.metricBlock}><Text style={[styles.metricLabel, { color: colors.muted }]}>Próxima</Text><Text style={[styles.metricValue, { color: colors.text }]}>{activeStop ? niceStopName(activeStop) : '—'}</Text></View>
            <View style={styles.metricBlock}><Text style={[styles.metricLabel, { color: colors.muted }]}>Rota</Text><Text style={[styles.metricValue, { color: colors.text }]}>{totalKm.toFixed(totalKm >= 10 ? 0 : 1)} km</Text></View>
          </View>
          {status === 'boarding' && (
            <View style={[styles.boardingPanel, { backgroundColor: colors.surfaceAlt }]}>
              <View style={{ flex: 1 }}><Text style={[styles.boardingTitle, { color: colors.text }]}>Embarque</Text><Text style={[styles.boardingSub, { color: colors.muted }]}>O passageiro está entrando.</Text></View>
              <Text style={[styles.boardingCount, { color: WEG.blue }]}>{boardingLeft}s</Text>
            </View>
          )}
          {activePlan && (
            <Text style={[styles.routeLine, { color: colors.muted }]}>
              {activePlan.stops
                .map((s: Stop) => niceStopName(s))
                .join('  ›  ')}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

function themeToken(colors: any, token: string) {
  if (token === 'arrivalBg') return colors === dark ? '#183128' : '#EAF7F0';
  return colors.surfaceAlt;
}

const MapPanel = forwardRef<any, { onMessage: (event: WebViewMessageEvent) => void }>(function MapPanel(props, ref) {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.mapWrap}>
        {React.createElement('iframe', {
          ref,
          title: 'Mapa da carona',
          srcDoc: MAP_HTML,
          style: { width: '100%', height: '100%', border: '0', display: 'block' },
        })}
      </View>
    );
  }
  return (
    <View style={styles.mapWrap}>
      <WebView ref={ref} originWhitelist={['*']} source={{ html: MAP_HTML, baseUrl: 'https://weg-carona.local/' }} onMessage={props.onMessage} javaScriptEnabled domStorageEnabled startInLoadingState allowUniversalAccessFromFileURLs mixedContentMode="always" style={styles.map} />
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  mapWrap: { ...StyleSheet.absoluteFill, backgroundColor: '#dfe7ed' },
  map: { flex: 1, backgroundColor: '#dfe7ed' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  topIdentity: { flexDirection: 'row', alignItems: 'baseline', gap: 8, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, boxShadow: '0px 2px 8px rgba(0,0,0,0.12)' },
  brand: { color: '#005596', fontSize: 22, fontWeight: '900', letterSpacing: -1 },
  appName: {
    fontSize: 16,
    fontWeight: '800',
    transform: [{ translateY: -8 }],
  },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  connection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 7,
    boxShadow: '0px 2px 8px rgba(0,0,0,0.12)',
  },
  connectionDot: { width: 7, height: 7, borderRadius: 8 },
  connectionLabel: { fontSize: 10, fontWeight: '700' },
  themeControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    paddingLeft: 9,
    paddingRight: 4,
    paddingVertical: 2,
    boxShadow: '0px 2px 8px rgba(0,0,0,0.12)',
  },
  themeControlText: { fontSize: 10, fontWeight: '700' },
  topModeWrap: { position: 'absolute', top: 74, left: 0, right: 0, zIndex: 10, alignItems: 'center', gap: 6 },
  modeBar: { flexDirection: 'row', padding: 3, borderRadius: 999, borderWidth: 1, width: 220, boxShadow: '0px 3px 14px rgba(0,0,0,0.13)' },
  modeButton: { flex: 1, minHeight: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  modeButtonText: { fontSize: 11, fontWeight: '800' },
  sourceBar: { flexDirection: 'row', padding: 2, borderRadius: 999, borderWidth: 1, width: 142, boxShadow: '0px 2px 8px rgba(0,0,0,0.1)' },
  sourceButton: { flex: 1, minHeight: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  sourceText: { fontSize: 10, fontWeight: '800' },
  bottomSheet: { position: 'absolute', bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, overflow: 'hidden', zIndex: 20, boxShadow: '0px -4px 20px rgba(0,0,0,0.16)' },
  sheetHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 8, backgroundColor: '#AAB6BF', marginTop: 9, marginBottom: 7 },
  sheetScroll: { flex: 1 },
  sheetContent: { paddingHorizontal: 18, paddingBottom: 18 },
  rideContent: { paddingHorizontal: 18, paddingBottom: 18, flex: 1 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 15 },
  sheetTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -.25 },
  sheetSubtitle: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  exampleLink: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  fieldWrap: { marginBottom: 11 },
  fieldLabel: { fontSize: 9, fontWeight: '800', letterSpacing: .65, marginBottom: 5 },
  input: { minHeight: 43, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 9, fontSize: 12 },
  passengerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, marginBottom: 7 },
  passengerCount: { fontSize: 12, fontWeight: '800' },
  addButton: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  addButtonText: { fontSize: 10, fontWeight: '800' },
  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  numberBadge: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  numberBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  passengerInput: { flex: 1 },
  removeText: { fontSize: 22, lineHeight: 25 },
  optimizeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#fff', fontSize: 11, fontWeight: '900' },
  optimizeText: { fontSize: 11, fontWeight: '700' },
  primaryButton: { minHeight: 45, borderRadius: 12, backgroundColor: WEG.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  primaryButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  secondaryButton: { minHeight: 45, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  secondaryButtonText: { fontSize: 12, fontWeight: '800' },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  metricBlock: { flex: 1 },
  metricLabel: { fontSize: 9, fontWeight: '700' },
  metricValue: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  progressTrack: { height: 5, borderRadius: 999, overflow: 'hidden', marginBottom: 12 },
  progressValue: { height: '100%', borderRadius: 999 },
  message: { fontSize: 10, lineHeight: 15, marginBottom: 10 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  boardingPanel: { borderRadius: 13, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  boardingTitle: { fontSize: 12, fontWeight: '800' },
  boardingSub: { fontSize: 10, marginTop: 2 },
  boardingCount: { fontSize: 23, fontWeight: '900' },
  routeLine: { fontSize: 10, lineHeight: 16, marginTop: 3 },
  liveBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  liveBadgeText: { fontSize: 8, fontWeight: '900', letterSpacing: .5 },
  arrivalPanel: { minHeight: 140, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  arrivalMark: { width: 40, height: 40, borderRadius: 20, backgroundColor: WEG.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  arrivalMarkText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  arrivalTitleBig: { fontSize: 20, fontWeight: '900' },
  arrivalSubtitle: { fontSize: 11, marginTop: 2 },
  wegLogo: {
    width: 48,
    height: 30,
    resizeMode: 'contain',
  },
});
