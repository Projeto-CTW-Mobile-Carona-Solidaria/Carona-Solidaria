import * as Location from 'expo-location';
import { Alert, Linking, Share } from 'react-native';
import type { Ride } from '../types';
import { dayLabels } from '../types';
export async function locate() {
  const permission=await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Localização não autorizada','Você pode continuar buscando pelo bairro. Para usar a distância, autorize a localização nas configurações.',[
      {text:'Continuar sem localização',style:'cancel'}, ...(!permission.canAskAgain ? [{text:'Abrir configurações',onPress:() => { void Linking.openSettings(); }}] : [])
    ]); return null;
  }
  if (!(await Location.hasServicesEnabledAsync())) throw new Error('Ative a localização do aparelho ou busque pelo bairro.');
  const result=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
  // Approximate meeting point only; never monitor the user's location in background.
  return {latitude:Number(result.coords.latitude.toFixed(3)),longitude:Number(result.coords.longitude.toFixed(3))};
}
export async function shareRide(ride:Ride) {
  await Share.share({title:'Carona Solidária',message:`Carona Solidária · Grupo ${ride.id}\n${ride.origin} → ${ride.destination}\n${ride.departureTime} · ${ride.days.map(d => dayLabels[d]).join(', ')}\nConsulte a disponibilidade no aplicativo. Acesso exclusivo a colaboradores cadastrados.`});
}
export async function whatsapp(number:string) {
  if (!/^[0-9]{10,15}$/.test(number)) throw new Error('Este participante ainda não informou um WhatsApp válido.');
  await Linking.openURL(`https://wa.me/${number}`);
}
