import { Text } from 'react-native';
import { Card, s } from './ui';
import { dayLabels, type Ride } from '../types';
import type { ReactNode } from 'react';
export function RideCard({ride,children}:{ride:Ride;children?:ReactNode}) {
  return <Card><Text style={s.badge}>{ride.active?`${ride.availableSeats} vaga(s) disponível(is)`:'Carona encerrada'} · Grupo {ride.id}</Text>
    <Text style={s.subtitle}>{ride.origin} → {ride.destination}</Text><Text style={s.muted}>{ride.departureTime} · {ride.days.map(d=>dayLabels[d]).join(' / ')}</Text>
    <Text style={s.label}>{ride.driverName} · {ride.model} {ride.color}</Text>{ride.distanceKm!==null&&<Text style={s.muted}>{ride.distanceKm.toFixed(1)} km até o ponto de saída (linha reta)</Text>}{children}</Card>;
}
