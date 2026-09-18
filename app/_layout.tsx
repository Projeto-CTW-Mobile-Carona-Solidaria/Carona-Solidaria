import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_600SemiBold,
  useFonts,
} from '@expo-google-fonts/roboto';

export default function RootLayout() {
  const [loaded] = useFonts({ Roboto_400Regular, Roboto_500Medium, Roboto_600SemiBold });
  if (!loaded) return null;

  return (
    <>

    </>
  );
}
