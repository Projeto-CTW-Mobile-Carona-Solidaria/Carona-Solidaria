export type Role = 'MEMBER' | 'RH' | 'ADMIN';
export const DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'] as const;
export type Day = typeof DAYS[number];
export const dayLabels: Record<Day,string> = { MONDAY:'Seg', TUESDAY:'Ter', WEDNESDAY:'Qua', THURSDAY:'Qui', FRIDAY:'Sex', SATURDAY:'Sáb', SUNDAY:'Dom' };
export interface Person { id:number; name:string; email:string; employeeId:string; whatsapp:string; neighborhood:string; days:Day[]; role:Role; active:boolean; registered:boolean }
export interface Auth { token:string; expiresAt:string; user:Person }
export interface Vehicle { id:number; plate:string; model:string; color:string; seats:number; status:'PENDING'|'APPROVED'|'REJECTED'; rejectionReason:string|null }
export interface Ride { id:number; driverId:number; driverName:string; model:string; color:string; origin:string; destination:string; departureTime:string; capacity:number; availableSeats:number; availableSeatsByDay:Partial<Record<Day,number>>; days:Day[]; active:boolean; distanceKm:number|null; specialParkingEligible:boolean }
export interface Participation { id:number; rideId:number; passengerId:number; passengerName:string; whatsapp:string; status:'PENDING'|'ACCEPTED'|'REJECTED'|'LEFT'|'REMOVED'; relative:boolean; days:Day[]; driverApproved:boolean; rhApproved:boolean }
export interface Group { ride:Ride; driverWhatsapp:string; plate:string; participants:Participation[] }
export const statusLabels: Record<string,string> = { PENDING:'Aguardando aprovação',APPROVED:'Aprovado',REJECTED:'Recusado',ACCEPTED:'Confirmado',LEFT:'Você saiu',REMOVED:'Participação encerrada' };
export function participationStatus(p:Participation):string {
  if(p.status!=='PENDING') return statusLabels[p.status];
  if(p.driverApproved) return 'Aguardando aprovação do RH';
  if(p.rhApproved) return 'Aguardando aprovação do motorista';
  return 'Aguardando aprovação do motorista e do RH';
}
export function formatDays(days:Day[]):string { return DAYS.filter(day=>days.includes(day)).map(day=>dayLabels[day]).join(' / '); }
