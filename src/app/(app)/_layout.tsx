import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../../context/AuthContext';

export default function AppLayout() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Tabs screenOptions={{ headerStyle:{backgroundColor:'#01296F'},headerTintColor:'#FFFFFF',tabBarActiveTintColor:'#01296F',tabBarStyle:{minHeight:64},tabBarLabelStyle:{fontSize:12},tabBarIconStyle:{display:'none'} }}>
    <Tabs.Screen name="index" options={{title:'Encontrar carona',tabBarLabel:'Buscar'}}/>
    <Tabs.Screen name="mine" options={{title:'Minhas caronas',tabBarLabel:'Caronas'}}/>
    <Tabs.Screen name="offer" options={{title:'Oferecer carona',tabBarLabel:'Oferecer'}}/>
    <Tabs.Screen name="vehicle" options={{title:'Meu veículo',tabBarLabel:'Veículo'}}/>
    <Tabs.Screen name="profile" options={{title:'Meu perfil',tabBarLabel:'Perfil'}}/>
    <Tabs.Screen name="group/[id]" options={{title:'Grupo de carona',href:null}}/>
  </Tabs>;
}
