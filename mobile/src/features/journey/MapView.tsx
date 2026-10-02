import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { MAP_HTML } from './mapHtml';
import type { MapProps } from './mapTypes';
const source = { html: MAP_HTML, baseUrl: 'https://carona-map.local/' };

export function JourneyMap({ plan, state, dark, fitVersion, onError }: MapProps) {
  const ref = useRef<WebView>(null), [ready, setReady] = useState(false);
  useEffect(() => { if (ready) ref.current?.postMessage(JSON.stringify({ type: 'STATE', plan, state, dark, fitVersion })); }, [plan, state, dark, fitVersion, ready]);
  return <View style={styles.map}><WebView ref={ref} source={source} style={styles.map} originWhitelist={['*']} javaScriptEnabled mixedContentMode="never" allowFileAccess={false}
    onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url.startsWith('https://carona-map.local/')}
    onMessage={event => { try { const message = JSON.parse(event.nativeEvent.data); if (message.type === 'READY') setReady(true); else if (message.type === 'ERROR' || message.type === 'TILE_ERROR') onError('O mapa não carregou completamente. Confira a conexão ou use Recarregar mapa.'); } catch { /* Ignore unrelated web messages. */ } }}
    onError={() => onError('Não foi possível carregar o mapa. Tente recarregar.')}/></View>;
}
const styles = StyleSheet.create({ map: { flex: 1 } });
