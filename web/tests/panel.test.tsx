import { beforeEach,afterEach,expect,test,vi } from 'vitest';
import { cleanup,render,screen,within,waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider,useAuth } from '../src/context/AuthContext';
import { configureSession,currentToken } from '../src/services/api';
import Admin from '../src/panels/Admin';
import Login from '../src/panels/Login';
import type { Group,Person,Role } from '../src/types';

let role:Role,unavailable:boolean,expired:boolean;
let vehicles:{id:number;ownerName:string;model:string;plate:string;color:string;seats:number;status:string;submittedAt:string;rejectionReason:string|null}[];
let group:Group;
let calls:{path:string;method:string;body:Record<string,unknown>|undefined}[];
const person:Person={id:1,name:'Equipe de teste',email:'rh@example.test',employeeId:'RH1',whatsapp:'5547999999999',neighborhood:'Centro',days:['MONDAY'],role:'RH',active:true,registered:true};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
function Harness(){const {user}=useAuth();return user?<Admin/>:<Login/>;}
async function enter(){
  const user=userEvent.setup();render(<AuthProvider><Harness/></AuthProvider>);
  await user.type(screen.getByLabelText('E-mail'),'rh@example.test');await user.type(screen.getByLabelText('Senha'),'test-password-123');
  await user.click(screen.getByRole('button',{name:'Entrar'}));return user;
}
beforeEach(()=>{
  role='ADMIN';unavailable=false;expired=false;calls=[];configureSession(null);
  vehicles=[{id:4,ownerName:'Marina Silva',model:'Honda Civic',plate:'ABC1D23',color:'Azul',seats:3,status:'PENDING',submittedAt:'2026-10-02T12:00:00Z',rejectionReason:null}];
  group={ride:{id:8,driverId:3,driverName:'Marina Silva',model:'Honda Civic',color:'Azul',origin:'Centro',destination:'WEG',departureTime:'07:00',capacity:1,availableSeats:1,availableSeatsByDay:{MONDAY:1,WEDNESDAY:1},days:['MONDAY','WEDNESDAY'],active:true,distanceKm:null,specialParkingEligible:false},driverWhatsapp:'5547999999999',plate:'ABC1D23',participants:[{id:9,rideId:8,passengerId:5,passengerName:'Paulo Souza',whatsapp:'5547999999998',status:'PENDING',relative:false,days:['MONDAY'],driverApproved:true,rhApproved:false}]};
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const path=String(input),method=init?.method??'GET',body=init?.body?JSON.parse(String(init.body)):undefined;calls.push({path,method,body});
    if(path==='/api/auth/login')return reply({token:'test-token',expiresAt:new Date(Date.now()+3600000).toISOString(),user:{...person,role}});
    if(path==='/api/auth/logout')return new Response(null,{status:204});
    if(expired)return reply({message:'Sua sessão expirou.'},401);
    if(path==='/api/rh/vehicles') {if(unavailable)throw new TypeError('offline');return reply(vehicles);}
    if(path==='/api/rh/vehicles/4'&&method==='PATCH'){vehicles[0].status=body.approved?'APPROVED':'REJECTED';vehicles[0].rejectionReason=body.reason;return reply(vehicles[0]);}
    if(path==='/api/rh/members'&&method==='POST')return reply({user:{...person,name:body.name},invitationCode:'one-time-test-invitation'});
    if(path==='/api/rh/members'||path==='/api/admin/rh')return reply([]);
    if(path==='/api/rh/groups')return reply([group.ride]);
    if(path==='/api/rides/8')return reply(group);
    if(path==='/api/rides/8/requests/9'&&method==='PATCH'){
      group.participants[0].rhApproved=body.accepted;group.participants[0].status=body.accepted?'ACCEPTED':'REJECTED';
      if(body.accepted){group.ride.availableSeatsByDay.MONDAY=0;group.ride.availableSeats=0;group.ride.specialParkingEligible=true;}
      return reply(group.participants[0]);
    }
    throw new Error(`Unexpected request: ${method} ${path}`);
  }));
  // jsdom has no native dialog rendering; retain its open/close semantics.
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
});
afterEach(()=>{cleanup();configureSession(null);vi.unstubAllGlobals();});

test('RH enters the web panel, cannot manage the RH team and logout revokes the token',async()=>{
  role='RH';const user=await enter();await screen.findByText('Honda Civic');
  expect(screen.queryByRole('button',{name:/Equipe de RH/})).toBeNull();expect(currentToken()).toBe('test-token');
  await user.click(screen.getByRole('button',{name:'Sair da conta'}));await screen.findByRole('button',{name:'Entrar'});
  expect(currentToken()).toBeNull();expect(calls.some(c=>c.path==='/api/auth/logout'&&c.method==='POST')).toBe(true);
});
test('member accounts are rejected and their just-created session is revoked',async()=>{
  role='MEMBER';await enter();expect((await screen.findByRole('alert')).textContent).toContain('exclusivo para RH');
  expect(screen.queryByRole('navigation')).toBeNull();expect(currentToken()).toBeNull();
  expect(calls.some(c=>c.path==='/api/auth/logout')).toBe(true);
});
test('ADMIN can open the RH team and register a new RH account',async()=>{
  const user=await enter();await screen.findByText('Honda Civic');await user.click(screen.getByRole('button',{name:/Equipe de RH/}));
  await user.click(await screen.findByRole('button',{name:'Cadastrar RH'}));const modal=within(screen.getByRole('dialog'));
  await user.type(modal.getByLabelText('Nome'),'Ana RH');await user.type(modal.getByLabelText('E-mail'),'ana@example.test');await user.type(modal.getByLabelText('Matrícula'),'RH2');await user.type(modal.getByLabelText(/Senha inicial/),'test-password-123');
  await user.click(modal.getByRole('button',{name:'Cadastrar'}));await screen.findByText('Conta de RH cadastrada.');
  expect(calls.find(c=>c.path==='/api/admin/rh'&&c.method==='POST')?.body).toEqual({name:'Ana RH',email:'ana@example.test',employeeId:'RH2',password:'test-password-123'});
});
test('inviting a collaborator displays the one-time code and refreshes the list',async()=>{
  const user=await enter();await screen.findByText('Honda Civic');await user.click(screen.getByRole('button',{name:/Colaboradores/}));
  await user.click(await screen.findByRole('button',{name:'Convidar colaborador'}));const modal=within(screen.getByRole('dialog'));
  await user.type(modal.getByLabelText('Nome'),'João Teste');await user.type(modal.getByLabelText('E-mail'),'joao@example.test');await user.type(modal.getByLabelText('Matrícula'),'M123');await user.click(modal.getByRole('button',{name:'Gerar convite'}));
  const code=await screen.findByLabelText('Código do convite');expect((code as HTMLTextAreaElement).value).toBe('one-time-test-invitation');
  expect(calls.filter(c=>c.path==='/api/rh/members'&&c.method==='GET').length).toBe(2);
});
test('vehicle rejection requires a reason, sends it to the API and updates pending results',async()=>{
  const user=await enter();await screen.findByText('Honda Civic');await user.click(screen.getByRole('button',{name:'Recusar'}));const modal=within(screen.getByRole('dialog'));
  await user.click(modal.getByRole('button',{name:'Recusar veículo'}));expect(calls.some(c=>c.method==='PATCH')).toBe(false);
  await user.type(modal.getByLabelText('Motivo da recusa'),'Corrija a placa');await user.click(modal.getByRole('button',{name:'Recusar veículo'}));
  await screen.findByText(/Veículo recusado/);expect(screen.queryByText('Honda Civic')).toBeNull();
  expect(calls.find(c=>c.method==='PATCH')?.body).toEqual({approved:false,reason:'Corrija a placa'});
});
test('RH approval shows requested days, confirms the passenger and refreshes daily seats',async()=>{
  const user=await enter();await screen.findByText('Honda Civic');await user.click(screen.getByRole('button',{name:/Caronas e solicitações/}));await user.click(await screen.findByRole('button',{name:'Ver solicitações'}));
  await screen.findByText('Paulo Souza');expect(screen.getByText('Aguardando aprovação do RH')).toBeTruthy();
  await user.click(screen.getByRole('button',{name:'Aprovar'}));const modal=within(screen.getByRole('dialog'));expect(modal.getByText(/Dias: Seg/)).toBeTruthy();
  await user.click(modal.getByRole('button',{name:'Aprovar pelo RH'}));await screen.findByText(/Participação confirmada/);
  expect(calls.find(c=>c.path==='/api/rides/8/requests/9')?.body).toEqual({accepted:true});
  expect(screen.queryByRole('button',{name:'Aprovar'})).toBeNull();
  expect(document.querySelector('.wd-seats')?.textContent).toContain('Seg 0');expect(document.querySelector('.wd-seats')?.textContent).toContain('Qua 1');
});
test('network errors hide stale administrative data and a retry recovers',async()=>{
  const user=await enter();await screen.findByText('Honda Civic');unavailable=true;
  await user.click(screen.getByRole('button',{name:'Atualizar'}));expect((await screen.findByRole('alert')).textContent).toContain('Sem conexão');expect(screen.queryByText('Honda Civic')).toBeNull();
  unavailable=false;await user.click(screen.getByRole('button',{name:'Atualizar'}));await screen.findByText('Honda Civic');
});
test('an expired server session clears the panel and returns to login',async()=>{
  const user=await enter();await screen.findByText('Honda Civic');expired=true;await user.click(screen.getByRole('button',{name:'Atualizar'}));
  await screen.findByRole('button',{name:'Entrar'});await waitFor(()=>expect(currentToken()).toBeNull());expect(screen.queryByText('Honda Civic')).toBeNull();
});
