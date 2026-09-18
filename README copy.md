# Carona Solidária — React Native

Implementação do design Figma **Carona Solidária** em **React Native + Expo Router + TypeScript**.

## Rodar

```bash
npm install
npx expo start
```

Depois use `a` para Android, `i` para iOS (macOS) ou leia o QR Code no Expo Go.

## Rotas implementadas

- `/login`
- `/cadastro`
- `/home`
- `/menu`
- `/grupos`
- `/veiculos`
- `/configuracoes`

## Design system extraído do Figma

- Navy: `#01296F`
- Card blue: `#012F80`
- CTA cyan: `#28B9DA`
- Pale blue: `#E6EAFF`
- Menu/icon blue: `#B0BAE5`
- Ink: `#212121`
- Neutral: `#242433`
- Off-white: `#F4F4FE`
- Font: Roboto

## Importante sobre imagens

As três imagens principais usam URLs temporárias geradas pelo Figma MCP, porque o ambiente de geração não consegue gravar os bytes remotos diretamente no ZIP. Essas URLs expiram. Para uma versão final de produção, exporte as mesmas imagens do Figma e substitua os URIs em `src/theme/assets.ts` por `require('../../assets/images/...')`.
