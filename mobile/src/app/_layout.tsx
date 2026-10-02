import { Slot } from 'expo-router';
import { AuthProvider } from '../../context/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <SafeAreaProvider><AuthProvider>
      <StatusBar style="dark" />
      <Slot />
    </AuthProvider></SafeAreaProvider>
  );
}

