import { createElement, useEffect, useRef, useState } from 'react';
import { MAP_HTML } from './mapHtml';
import type { MapProps } from './mapTypes';

export function JourneyMap({ plan, state, dark, fitVersion, onError }: MapProps) {
  const ref = useRef<HTMLIFrameElement>(null), [ready, setReady] = useState(false);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== ref.current?.contentWindow || typeof event.data !== 'string') return;
      try { const message = JSON.parse(event.data); if (message.type === 'READY') setReady(true); else if (message.type === 'ERROR' || message.type === 'TILE_ERROR') onError('O mapa não carregou completamente. Confira a conexão ou use Recarregar mapa.'); } catch { /* Ignore unrelated frames. */ }
    };
    window.addEventListener('message', receive);return () => window.removeEventListener('message', receive);
  }, [onError]);
  useEffect(() => { if (ready) ref.current?.contentWindow?.postMessage(JSON.stringify({ type: 'STATE', plan, state, dark, fitVersion }), '*'); }, [plan, state, dark, fitVersion, ready]);
  return createElement('iframe', { ref, title: 'Mapa da carona', srcDoc: MAP_HTML, sandbox: 'allow-scripts allow-popups allow-popups-to-escape-sandbox', style: { width: '100%', height: '100%', border: 0, display: 'block' } });
}
