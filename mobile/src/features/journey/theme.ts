import { tokens } from '../../theme/tokens';
export const journeyThemes = {
  light: { background: tokens.colors.background, surface: tokens.colors.surface, text: tokens.colors.text, muted: tokens.colors.textMuted, border: tokens.colors.controlBorder, primary: tokens.colors.navy, onPrimary: '#FFFFFF', danger: tokens.colors.danger },
  dark: { background: '#122131', surface: '#1C2E40', text: '#EDF3F9', muted: '#B6C7D9', border: '#7D8DA0', primary: '#ADCEFF', onPrimary: '#122131', danger: '#FFB4AB' },
} as const;
export type JourneyTheme = typeof journeyThemes.light | typeof journeyThemes.dark;
