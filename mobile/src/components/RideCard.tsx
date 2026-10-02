import { Text,View } from 'react-native';
import { Badge,Card, s } from './ui';
import { DAYS, dayLabels, formatDays, type Ride } from '../types';
import type { ReactNode } from 'react';
export function RideCard({ride,children}:{ride:Ride;children?:ReactNode}) {
  return <Card><View style={s.rideHeading}><View style={s.toolbar}><Text style={s.helper}>Grupo {ride.id}</Text><Badge text={ride.active?'Carona ativa':'Carona encerrada'} tone={ride.active?'success':'neutral'}/></View>
    <Text style={s.subtitle}>{ride.origin} → {ride.destination}</Text><Text style={s.muted}>{ride.departureTime} · {formatDays(ride.days)}</Text></View>
    <View style={s.rideDetails}>{ride.active&&<Text style={s.helper}>Vagas: {DAYS.filter(day=>ride.days.includes(day)).map(day=>`${dayLabels[day]} ${ride.availableSeatsByDay[day]??0}`).join(' · ')}</Text>}
    <Text style={s.muted}>{ride.driverName} · {ride.model} {ride.color}</Text>{ride.distanceKm!==null&&<Text style={s.helper}>{ride.distanceKm.toFixed(1)} km até o ponto de saída (linha reta)</Text>}</View>{children&&<View style={s.rideActions}>{children}</View>}</Card>;
}
