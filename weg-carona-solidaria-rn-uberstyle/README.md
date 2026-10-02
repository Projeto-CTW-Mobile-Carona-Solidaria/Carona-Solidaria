# WEG Carona Solidária — React Native / Expo

Protótipo acadêmico de carona corporativa com React Native/Expo, Leaflet + OpenStreetMap, OSRM, Nominatim e Socket.io.

## Destaques desta versão

- Interface inspirada no fluxo de aplicativos de mobilidade: mapa ocupando a tela e painel inferior fixo.
- Não é necessário rolar a página para acompanhar a viagem.
- Painel inferior com saída, passageiros, destino e ações principais.
- Múltiplos passageiros e otimização de ordem.
- Cada trecho é calculado separadamente: saída → P1 → P2 → ... → WEG.
- Trecho atual em azul; trechos futuros discretos; trechos concluídos deixam de aparecer como pendentes.
- Ao chegar a um passageiro, o carro para por 5 segundos para simular o embarque.
- Durante o embarque aparece contagem regressiva 5s → 0s.
- Após o embarque, o marcador do passageiro é removido do mapa.
- Chegada à WEG com estado final destacado.
- Modo claro/escuro.
- Web funciona com iframe do Leaflet; Android/iOS usam `react-native-webview`.
- Backend com Express + Socket.io + geocodificação Nominatim.

## Executar

```powershell
npm install
npm start
```

Para abrir diretamente no navegador:

```powershell
npm run web
```

## Backend separado

Se preferir rodar separadamente:

```powershell
npm run server
```

Em outro terminal:

```powershell
npm run expo
```

## Celular físico

Crie um arquivo `.env` a partir de `.env.example`:

```env
EXPO_PUBLIC_API_BASE_URL=http://SEU_IP_LOCAL:3000
```

Use o IPv4 do computador na mesma rede Wi-Fi do celular.

## Observação

O protótipo usa serviços públicos gratuitos. OSRM e Nominatim podem apresentar limites de uso, latência ou indisponibilidade eventual.
