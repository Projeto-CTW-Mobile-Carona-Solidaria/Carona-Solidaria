import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useColorScheme, type TextInputProps } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../services/api';
import { locate } from '../../services/native';
import { DAYS, dayLabels, type Day, type Group } from '../../types';
import { Busy, Button, Notice, Screen } from '../../components/ui';
import { tokens } from '../../theme/tokens';
import { JourneyMap } from './MapView';
import { formatDistance, formatDuration, remainingMetrics, type RoutePlan } from './model';
import { planRoute, type StopDraft } from './planner';
import { useJourney } from './useJourney';
import { journeyThemes, type JourneyTheme } from './theme';

export default function JourneyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(), { user } = useAuth();
  const systemDark = useColorScheme() === 'dark', [dark, setDark] = useState(systemDark), theme = journeyThemes[dark ? 'dark' : 'light'];
  const [group, setGroup] = useState<Group | null>(null), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState('');
  const [day, setDay] = useState<Day>('MONDAY'), [origin, setOrigin] = useState(''), [destination, setDestination] = useState('');
  const [pickups, setPickups] = useState<Record<number, string>>({}), [included, setIncluded] = useState<number[]>([]);
  const [plan, setPlan] = useState<RoutePlan | null>(null), [optimize, setOptimize] = useState(true), [source, setSource] = useState<'simulator' | 'gps'>('simulator');
  const [editing, setEditing] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [mapError, setMapError] = useState(''), [mapKey, setMapKey] = useState(0), [fitVersion, setFitVersion] = useState(0), [reload, setReload] = useState(0);
  const epoch = useRef(0), mounted = useRef(false), initialized = useRef<string | null>(null);
  const owner = group?.ride.driverId === user?.id;
  const journey = useJourney(id, !!group?.ride.active);

  useFocusEffect(useCallback(() => {
    mounted.current = true;const version = ++epoch.current;setLoading(true);setLoadError('');
    void api<Group>(`/api/rides/${id}`).then(value => {
      if (!mounted.current || epoch.current !== version) return;
      setGroup(value);
      if (initialized.current !== id) {
        initialized.current = id;setPlan(null);setEditing(true);setOrigin(value.ride.origin);setDestination(value.ride.destination);
        const chosen = DAYS.find(d => value.ride.days.includes(d))!;setDay(chosen);
        setIncluded(value.participants.filter(p => p.status === 'ACCEPTED' && p.days.includes(chosen)).map(p => p.passengerId));setPickups({});
      }
    }).catch(e => { if (mounted.current && epoch.current === version) { setGroup(null);setLoadError(e.message); } }).finally(() => { if (mounted.current && epoch.current === version) setLoading(false); });
    return () => { mounted.current = false;epoch.current++;setBusy(false); };
  }, [id, reload]));

  const passengers = group?.participants.filter(p => p.status === 'ACCEPTED' && p.days.includes(day)) ?? [];
  const live = journey.local ?? journey.remote;
  const displayPlan = live?.plan ?? (owner ? plan : null), position = journey.local ? journey.position : journey.remote?.state ?? null;
  const progress = position?.progress, metrics = displayPlan ? remainingMetrics(displayPlan, progress) : null;
  const next = progress ? displayPlan?.stops[progress.nextStopIndex] : undefined;
  const transmitting = !!journey.local, blocked = busy || journey.busy;
  const showEditor = owner && editing && !live;

  const invalidate = () => { setPlan(null);setMessage('');setError(''); };
  function changeDay(value: Day) { setDay(value);setIncluded(group!.participants.filter(p => p.status === 'ACCEPTED' && p.days.includes(value)).map(p => p.passengerId));invalidate(); }
  async function calculate() {
    if (!group || blocked) return;
    const selected = passengers.filter(p => included.includes(p.passengerId));
    if (!origin.trim() || !destination.trim() || selected.some(p => !pickups[p.passengerId]?.trim())) { setError('Informe a saída, o destino e o ponto de encontro de cada passageiro selecionado.');return; }
    setBusy(true);setError('');setPlan(null);const version = ++epoch.current;
    const valid = () => mounted.current && version === epoch.current;
    const drafts: StopDraft[] = [
      { id: 'origin', passengerId: null, kind: 'origin', label: 'Saída', address: origin },
      ...selected.map(p => ({ id: `passenger-${p.passengerId}`, passengerId: p.passengerId, kind: 'passenger' as const, label: p.passengerName, address: pickups[p.passengerId] })),
      { id: 'destination', passengerId: null, kind: 'destination', label: group.ride.destination, address: destination },
    ];
    try { const result = await planRoute(drafts, optimize, text => { if (valid()) setMessage(text); }, valid);if (valid()) { setPlan(result);setEditing(false);setMessage('Rota pronta. Confira os pontos localizados antes de iniciar.'); } }
    catch (e) { if (valid()) { setError(e instanceof Error ? e.message : 'Não foi possível calcular a rota.');setMessage(''); } }
    finally { if (valid()) setBusy(false); }
  }
  async function useOrigin() {
    const version = ++epoch.current;setBusy(true);setError('');
    try { const coords = await locate();if (mounted.current && epoch.current === version && coords) { setOrigin(`${coords.latitude}, ${coords.longitude}`);invalidate(); } }
    catch(e) { if (mounted.current && epoch.current === version) setError(e instanceof Error ? e.message : 'Não foi possível obter a localização.'); }
    finally { if (mounted.current && epoch.current === version) setBusy(false); }
  }

  if (loading || !group) return <Screen title="Viagem no mapa">{loading ? <Busy/> : <><Notice error text={loadError}/><Button title="Tentar novamente" secondary onPress={() => setReload(n => n + 1)}/></>}</Screen>;
  if (!group.ride.active) return <Screen title="Carona encerrada"><Notice text="A transmissão está disponível somente para caronas ativas."/></Screen>;

  return <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.root, { backgroundColor: theme.background }]}>
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.toolbar, { borderColor: theme.border }]}>
        <Text style={[styles.caption, { color: theme.muted }]}>Grupo {id} · {owner ? 'Motorista' : 'Passageiro'}{live ? ` · ${dayLabels[live.day]}` : ''}</Text>
        <Action title={dark ? 'Modo claro' : 'Modo escuro'} theme={theme} onPress={() => setDark(v => !v)}/>
      </View>
      <View style={styles.map}><JourneyMap key={mapKey} plan={displayPlan} state={position} dark={dark} fitVersion={fitVersion} onError={setMapError}/></View>
      <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }, showEditor && styles.editor]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {mapError ? <><Text accessibilityRole="alert" style={{ color: theme.danger }}>{mapError}</Text><Action title="Recarregar mapa" theme={theme} onPress={() => { setMapError('');setMapKey(n => n + 1); }}/></> : null}
          {!!(error || journey.error) && <Text accessibilityRole="alert" style={[styles.body, { color: theme.danger }]}>{error || journey.error}</Text>}
          {showEditor ? <>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>Planejar viagem</Text>
            <Text style={[styles.helper, { color: theme.muted }]}>Escolha pontos públicos de encontro. Endereços são consultados nos serviços de mapas e compartilhados com os participantes confirmados do dia.</Text>
            <Text style={[styles.label, { color: theme.text }]}>Dia da carona</Text>
            <View style={styles.row}>{DAYS.filter(d => group.ride.days.includes(d)).map(d => <Action key={d} title={dayLabels[d]} primary={d === day} selected={d === day} theme={theme} disabled={blocked} onPress={() => changeDay(d)}/>)}</View>
            <Field label="Ponto de saída" value={origin} onChangeText={v => { setOrigin(v);invalidate(); }} editable={!blocked} theme={theme}/>
            <Action title="Usar minha localização na saída" theme={theme} disabled={blocked} onPress={() => { void useOrigin(); }}/>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>Embarques</Text>
            <Action title="Atualizar participantes" theme={theme} disabled={blocked} onPress={() => { invalidate();setReload(n => n + 1); }}/>
            {!passengers.length && <Text style={[styles.body, { color: theme.muted }]}>Nenhum passageiro confirmado neste dia. É possível planejar o trajeto direto.</Text>}
            {passengers.map(p => <View key={p.passengerId} style={[styles.pickup, { borderColor: theme.border }]}>
              <View style={styles.row}><Switch accessibilityLabel={`Buscar ${p.passengerName}`} disabled={blocked} value={included.includes(p.passengerId)} onValueChange={v => { setIncluded(ids => v ? [...ids, p.passengerId] : ids.filter(n => n !== p.passengerId));invalidate(); }} trackColor={{ false: theme.border, true: theme.primary }}/><Text style={[styles.body, { color: theme.text }]}>{p.passengerName}</Text></View>
              {included.includes(p.passengerId) && <Field label={`Ponto de encontro de ${p.passengerName}`} value={pickups[p.passengerId] ?? ''} placeholder="Rua, bairro, cidade e estado" onChangeText={v => { setPickups(values => ({ ...values, [p.passengerId]: v }));invalidate(); }} editable={!blocked} theme={theme}/>}
            </View>)}
            <Field label="Destino" value={destination} onChangeText={v => { setDestination(v);invalidate(); }} editable={!blocked} theme={theme}/>
            <View style={styles.row}><Switch accessibilityLabel="Otimizar ordem dos embarques" value={optimize} disabled={blocked} onValueChange={v => { setOptimize(v);invalidate(); }} trackColor={{ false: theme.border, true: theme.primary }}/><Text style={[styles.body, { color: theme.text }]}>Otimizar ordem dos embarques</Text></View>
            {!!message && <Text accessibilityLiveRegion="polite" style={[styles.helper, { color: theme.muted }]}>{message}</Text>}
            <Action title={busy ? 'Calculando…' : 'Calcular rota'} primary theme={theme} disabled={blocked} onPress={() => { void calculate(); }}/>
            <Text style={[styles.helper, { color: theme.muted }]}>Incluir ou retirar um ponto de embarque não altera a participação nem a reserva da carona.</Text>
          </> : displayPlan ? <>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{progress?.phase === 'arrived' ? `Chegada a ${group.ride.destination}` : progress?.phase === 'boarding' ? `Embarque · ${next?.label}` : live ? (live.source === 'simulator' ? 'Simulação em andamento' : 'Viagem em andamento') : 'Rota calculada'}</Text>
            <Text style={[styles.helper, { color: theme.muted }]}>{live ? `${live.source === 'simulator' ? 'Posição simulada' : 'GPS em primeiro plano'} · atualização ${new Date(live.updatedAt).toLocaleTimeString('pt-BR')}` : message}</Text>
            <View style={styles.metrics}><Text style={[styles.body, { color: theme.text }]}>{formatDistance(metrics!.distance)} restantes</Text><Text style={[styles.body, { color: theme.text }]}>{formatDuration(metrics!.duration)} estimados</Text></View>
            {progress?.phase === 'boarding' && <Text accessibilityLiveRegion="polite" style={[styles.title, { color: theme.text }]}>{position?.boardingLeft}s para concluir o embarque</Text>}
            {progress && progress.phase !== 'arrived' && <Text style={[styles.body, { color: theme.text }]}>Próxima parada: {next?.label}</Text>}
            {!live && displayPlan.stops.map(stop => <View key={stop.id}><Text style={[styles.label, { color: theme.text }]}>{stop.order + 1}. {stop.label}</Text><Text style={[styles.helper, { color: theme.muted }]}>{stop.address}</Text></View>)}
            <View style={styles.row}><Action title="Enquadrar rota" theme={theme} onPress={() => setFitVersion(n => n + 1)}/>
              {owner && !live && <Action title="Editar pontos" theme={theme} disabled={blocked} onPress={() => setEditing(true)}/>}</View>
            {owner && !live && <>
              <View style={styles.row}><Action title="Simulação" selected={source === 'simulator'} primary={source === 'simulator'} theme={theme} disabled={blocked} onPress={() => setSource('simulator')}/><Action title="GPS real" selected={source === 'gps'} primary={source === 'gps'} theme={theme} disabled={blocked} onPress={() => setSource('gps')}/></View>
              <Text style={[styles.helper, { color: theme.muted }]}>{source === 'gps' ? 'O GPS é compartilhado enquanto esta tela estiver aberta. Operar com o veículo parado. Confirme cada embarque ao chegar ao ponto.' : 'Demonstração do trajeto, sem usar a localização real. Cada embarque dura cinco segundos.'}</Text>
              <Action title={journey.busy ? 'Iniciando…' : source === 'gps' ? 'Iniciar compartilhamento por GPS' : 'Iniciar simulação'} primary theme={theme} disabled={blocked} onPress={() => { setMessage('');void journey.start(displayPlan, day, source); }}/>
            </>}
            {transmitting && progress?.phase === 'moving' && <Action title={live?.source === 'simulator' ? 'Avançar simulação · 10s' : next?.kind === 'destination' ? 'Confirmar chegada ao destino' : 'Confirmar chegada ao embarque'} theme={theme} disabled={blocked} onPress={journey.advance}/>}
            {owner && live && <Action title="Encerrar transmissão" theme={theme} danger disabled={blocked} onPress={() => { void journey.stop(); }}/>} 
            {owner && live && !transmitting && <Text style={[styles.helper, { color: theme.muted }]}>Existe uma transmissão iniciada em outra sessão. Encerre-a para iniciar nesta tela.</Text>}
          </> : <>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>Aguardando o motorista</Text>
            <Text style={[styles.body, { color: theme.muted }]}>O trajeto e a posição aparecerão quando o motorista iniciar a transmissão de um dia em que você está confirmado.</Text>
          </>}
          <Text style={[styles.helper, { color: theme.muted }]}>Mapas © OpenStreetMap · trajetos OSRM. Estimativas sem trânsito em tempo real.</Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function Action({ title, onPress, theme, primary = false, danger = false, disabled = false, selected }: { title: string; onPress: () => void; theme: JourneyTheme; primary?: boolean; danger?: boolean; disabled?: boolean; selected?: boolean }) {
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={({ pressed }) => [styles.action, { backgroundColor: primary ? theme.primary : 'transparent', borderColor: danger ? theme.danger : primary ? theme.primary : theme.border, opacity: disabled || pressed ? .6 : 1 }, focused && { outlineColor: theme.primary, outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 2 }]}><Text style={[styles.label, { color: primary ? theme.onPrimary : danger ? theme.danger : theme.primary }]}>{title}</Text></Pressable>;
}
function Field({ label, theme, ...props }: TextInputProps & { label: string; theme: JourneyTheme }) {
  return <View style={styles.field}><Text style={[styles.label, { color: theme.text }]}>{label}</Text><TextInput {...props} accessibilityLabel={label} maxLength={300} placeholderTextColor={theme.muted} style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.background }]}/></View>;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, toolbar: { paddingHorizontal: tokens.space.page, gap: tokens.space.sm, paddingVertical: tokens.space.xs, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  map: { flex: 1, minHeight: 120 }, sheet: { maxHeight: '55%', borderTopWidth: 1 }, editor: { maxHeight: '60%' }, content: { padding: tokens.space.page, gap: tokens.space.md },
  title: { fontSize: tokens.type.section, fontWeight: '600', lineHeight: 24 }, body: { fontSize: tokens.type.body, lineHeight: 21, flexShrink: 1 },
  label: { fontSize: tokens.type.label, fontWeight: '600' }, helper: { fontSize: tokens.type.helper, lineHeight: 18 }, caption: { fontSize: tokens.type.helper, flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: tokens.space.sm }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.xl },
  field: { gap: 6 }, input: { minHeight: tokens.control.input, borderWidth: 1, borderRadius: tokens.radius.control, paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.sm, fontSize: tokens.type.body },
  pickup: { borderBottomWidth: 1, paddingBottom: tokens.space.md, gap: tokens.space.sm },
  action: { minHeight: tokens.control.button, borderRadius: tokens.radius.control, borderWidth: 1, paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.sm, alignSelf: 'flex-start', justifyContent: 'center' },
});
