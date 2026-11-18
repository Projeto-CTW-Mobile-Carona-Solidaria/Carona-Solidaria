import { Text,View } from 'react-native';
import { Badge,Card, s } from './ui';
import { DAYS, dayLabels, formatDays, type Ride } from '../types';
import type { ReactNode } from 'react';
export function RideCard({ride,children}:{ride:Ride;children?:ReactNode}) {
  return <Card><View style={s.rideHeading}><View style={s.toolbar}><Text style={s.helper}>Grupo {ride.id}</Text><Badge text={ride.active?'Carona ativa':'Carona encerrada'} tone={ride.active?'success':'neutral'}/></View>
    <Text style={s.subtitle}>{ride.origin} → {ride.destination}</Text><Text style={s.muted}>{ride.departureTime} · {formatDays(ride.days)}</Text></View>
    <View style={s.rideDetails}>{ride.active&&ride.availableSeatsByDay&&<View style={s.rideDetails}>
      <Text style={s.label}>Vagas por dia</Text>
      <View style={s.row}>{DAYS.filter(day=>ride.days.includes(day)).map(day=>{
        const seats=ride.availableSeatsByDay[day]??0;
        return <Badge key={day} text={`${dayLabels[day]} ${seats}`} tone={seats>0?'success':'neutral'}/>;
      })}</View>
    </View>}
    <Text style={s.muted}>{ride.driverName} · {ride.model} {ride.color}</Text>{ride.distanceKm!==null&&<Text style={s.helper}>{ride.distanceKm.toFixed(1)} km até o ponto de saída (linha reta)</Text>}</View>{children&&<View style={s.rideActions}>{children}</View>}</Card>;
}
