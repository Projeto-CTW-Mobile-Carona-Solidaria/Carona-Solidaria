import { Redirect, Tabs,router } from 'expo-router';
import { ActivityIndicator, Text,View } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { AppBar } from '../../components/AppHeader';
import { Icon,type IconName } from '../../components/Icon';
import { tokens } from '../../theme/tokens';

const tabIcons:Record<string,IconName>={index:'search',mine:'rides',offer:'offer',vehicle:'vehicle',profile:'profile'};

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

  return <Tabs screenOptions={({route})=>({
    header:({options})=><AppBar title={options.title} onBack={route.name==='group/[id]'||route.name==='journey/[id]'?()=>router.navigate('/(app)/mine'):undefined}/>,
    tabBarActiveTintColor:tokens.colors.navy,tabBarInactiveTintColor:tokens.colors.textSubtle,
    tabBarActiveBackgroundColor:'transparent',tabBarInactiveBackgroundColor:'transparent',
    tabBarStyle:{backgroundColor:tokens.colors.surface,borderTopColor:tokens.colors.border,borderTopWidth:1,elevation:0},
    tabBarItemStyle:{paddingVertical:tokens.space.xs,borderWidth:0},
    tabBarIcon:({color})=><Icon name={tabIcons[route.name]??'rides'} color={color} size={tokens.control.tabIcon}/>,
    tabBarLabel:({children,color,focused})=><Text style={{fontSize:tokens.type.caption,fontWeight:focused?'600':'400',color}}>{children}</Text>,
  })}>
    <Tabs.Screen name="index" options={{title:'Encontrar carona',tabBarLabel:'Buscar'}}/>
    <Tabs.Screen name="mine" options={{title:'Minhas caronas',tabBarLabel:'Caronas'}}/>
    <Tabs.Screen name="offer" options={{title:'Oferecer carona',tabBarLabel:'Oferecer'}}/>
    <Tabs.Screen name="vehicle" options={{title:'Meu veículo',tabBarLabel:'Veículo'}}/>
    <Tabs.Screen name="profile" options={{title:'Meu perfil',tabBarLabel:'Perfil'}}/>
    <Tabs.Screen name="group/[id]" options={{title:'Grupo de carona',href:null}}/>
    <Tabs.Screen name="journey/[id]" options={{title:'Viagem no mapa',href:null}}/>
  </Tabs>;
}
