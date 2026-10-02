package br.com.caronasolidaria;

import br.com.caronasolidaria.Domain.*;
import br.com.caronasolidaria.Dtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
import static br.com.caronasolidaria.ApiException.*;
import static br.com.caronasolidaria.AuthService.person;

@Service @Transactional
class CaronaService {
    private final Members members;
    private final Vehicles vehicles;
    private final Rides rides;
    private final Participations participations;
    private final Sessions sessions;
    private final AuthService auth;
    CaronaService(Members members, Vehicles vehicles, Rides rides, Participations participations, Sessions sessions, AuthService auth) {
        this.members=members; this.vehicles=vehicles; this.rides=rides; this.participations=participations; this.sessions=sessions; this.auth=auth;
    }
    Member member(Long id) {
        Member m=members.findById(id).orElseThrow(ApiException::missing);
        if (!m.active) throw forbidden(); return m;
    }
    private Member collaborator(Long id) { Member m=member(id); if (m.role!=Role.MEMBER) throw forbidden(); return m; }
    private Member staff(Long id) { Member m=member(id); if (m.role==Role.MEMBER) throw forbidden(); return m; }
    private void admin(Long id) { if (member(id).role!=Role.ADMIN) throw forbidden(); }
    Person profile(Long id) { return person(member(id)); }
    Person updateProfile(Long id, Profile input) {
        Member m=collaborator(id); m.name=input.name().trim(); m.whatsapp=input.whatsapp();
        m.neighborhood=input.neighborhood().trim(); m.days=new HashSet<>(input.days()); return person(m);
    }
    private Member newMember(String name, String email, String employeeId) {
        String normalized=email.trim().toLowerCase(Locale.ROOT);
        if (members.findByEmailIgnoreCase(normalized).isPresent() || members.existsByEmployeeId(employeeId.trim())) throw conflict("E-mail ou matrícula já cadastrados.");
        Member m=new Member(); m.name=name.trim(); m.email=normalized; m.employeeId=employeeId.trim(); return m;
    }
    InviteResult invite(Long actor, Invitation input) {
        staff(actor); Member m=newMember(input.name(),input.email(),input.employeeId());
        String code=AuthService.randomToken(); m.invitationHash=AuthService.hash(code); members.save(m);
        return new InviteResult(person(m),code);
    }
    InviteResult renewInvite(Long actor, Long id) {
        staff(actor); Member m=member(id);
        if (m.role!=Role.MEMBER || m.passwordHash!=null) throw bad("Somente convites ainda não utilizados podem ser renovados.");
        String code=AuthService.randomToken(); m.invitationHash=AuthService.hash(code); return new InviteResult(person(m),code);
    }
    Person createRh(Long actor, RhInput input) {
        admin(actor); Member m=newMember(input.name(),input.email(),input.employeeId());
        m.role=Role.RH; m.passwordHash=auth.encode(input.password()); return person(members.save(m));
    }
    List<Person> accounts(Long actor, Role role) {
        if (role==Role.RH) admin(actor); else staff(actor);
        return members.findAll().stream().filter(m -> m.role==role).map(AuthService::person).toList();
    }
    Person updateAccount(Long actor, Long id, Role role, AccountUpdate input) {
        if (role==Role.RH) admin(actor); else staff(actor);
        Member m=members.findById(id).orElseThrow(ApiException::missing);
        if (m.role!=role || Objects.equals(actor,id)) throw forbidden();
        m.name=input.name().trim(); m.active=input.active();
        if (!m.active) {
            sessions.deleteByMemberId(id);
            for (Ride candidate : rides.findAll()) {
                Ride r=rides.lock(candidate.id).orElseThrow(ApiException::missing);
                if (r.driver.id.equals(id)) { r.active=false; closeParticipants(r.id); }
                else participations.findByRideIdAndPassengerId(r.id,id).ifPresent(p -> {
                    if (p.status==RequestStatus.ACCEPTED || p.status==RequestStatus.PENDING) { p.status=RequestStatus.REMOVED; p.updatedAt=Instant.now(); }
                });
            }
        }
        return person(m);
    }
    VehicleView myVehicle(Long actor) { collaborator(actor); return vehicles.findByOwnerId(actor).map(this::vehicleView).orElse(null); }
    VehicleView submitVehicle(Long actor, VehicleInput input) {
        Member m=collaborator(actor);
        Vehicle v=vehicles.findByOwnerId(actor).map(old -> vehicles.lock(old.id).orElseThrow(ApiException::missing)).orElseGet(Vehicle::new);
        if (v.id!=null && rides.existsByVehicleIdAndActiveTrue(v.id)) throw conflict("Encerre suas caronas antes de alterar o veículo.");
        String plate=input.plate().toUpperCase(Locale.ROOT).replace("-", "").replace(" ", "");
        if (vehicles.existsByPlateAndIdNot(plate,v.id==null?-1L:v.id)) throw conflict("Placa já cadastrada.");
        v.owner=m; v.plate=plate; v.model=input.model().trim(); v.color=input.color().trim(); v.seats=input.seats();
        v.status=VehicleStatus.PENDING; v.rejectionReason=null; v.reviewer=null; v.reviewedAt=null; v.submittedAt=Instant.now();
        return vehicleView(vehicles.save(v));
    }
    List<VehicleView> reviewQueue(Long actor) {
        staff(actor); return vehicles.findAll().stream().sorted(Comparator.comparing(v -> v.submittedAt)).map(this::vehicleView).toList();
    }
    VehicleView review(Long actor, Long id, Review input) {
        Member reviewer=staff(actor); Vehicle v=vehicles.lock(id).orElseThrow(ApiException::missing);
        if (v.status!=VehicleStatus.PENDING) throw conflict("Este veículo já foi analisado. Atualize a lista.");
        if (!input.approved() && (input.reason()==null || input.reason().isBlank())) throw bad("Informe o motivo da reprovação.");
        if (!v.owner.active) throw bad("O colaborador está desativado.");
        v.status=input.approved()?VehicleStatus.APPROVED:VehicleStatus.REJECTED;
        v.rejectionReason=input.approved()?null:input.reason().trim(); v.reviewer=reviewer; v.reviewedAt=Instant.now(); return vehicleView(v);
    }
    private VehicleView vehicleView(Vehicle v) {
        return new VehicleView(v.id,v.owner.id,v.owner.name,v.plate,v.model,v.color,v.seats,v.status,v.rejectionReason,v.submittedAt);
    }
    RideView offer(Long actor, RideInput input) {
        Member driver=collaborator(actor);
        if (driver.whatsapp.isBlank()) throw bad("Complete seu perfil e WhatsApp antes de oferecer carona.");
        Vehicle existing=vehicles.findByOwnerId(actor).orElseThrow(() -> bad("Cadastre um veículo e aguarde aprovação do RH."));
        Vehicle v=vehicles.lock(existing.id).orElseThrow(ApiException::missing);
        if (v.status!=VehicleStatus.APPROVED) throw bad("Somente veículos aprovados podem oferecer carona.");
        if (input.capacity()>v.seats) throw bad("A quantidade de vagas excede a capacidade do veículo.");
        coordinates(input.latitude(),input.longitude());
        Ride r=new Ride(); r.driver=driver; r.vehicle=v; r.origin=input.origin().trim(); r.destination=input.destination().trim();
        r.departureTime=input.departureTime(); r.capacity=input.capacity(); r.days=new HashSet<>(input.days());
        r.latitude=input.latitude(); r.longitude=input.longitude(); return rideView(rides.save(r),null,null);
    }
    private void coordinates(Double lat, Double lon) {
        if ((lat==null)!=(lon==null) || (lat!=null && (!Double.isFinite(lat) || !Double.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180))) throw bad("Informe latitude e longitude válidas juntas.");
    }
    List<RideView> search(Long actor,String query,DayOfWeek day,Double lat,Double lon,Double radius) {
        collaborator(actor); coordinates(lat,lon);
        if (radius!=null && (lat==null || !Double.isFinite(radius) || radius<=0 || radius>200)) throw bad("Informe localização e raio entre 0 e 200 km.");
        String q=query==null?"":query.trim().toLowerCase(Locale.ROOT);
        return rides.findAll().stream().filter(r -> r.active && r.driver.active && r.vehicle.status==VehicleStatus.APPROVED && !r.driver.id.equals(actor))
            .filter(r -> day==null || r.days.contains(day)).filter(r -> (r.origin+" "+r.destination).toLowerCase(Locale.ROOT).contains(q))
            .filter(r -> participations.findByRideIdAndPassengerId(r.id,actor).map(p -> p.status!=RequestStatus.PENDING && p.status!=RequestStatus.ACCEPTED).orElse(true))
            .map(r -> rideView(r,lat,lon))
            .filter(r -> day==null ? r.availableSeatsByDay().values().stream().anyMatch(seats -> seats>0) : r.availableSeatsByDay().getOrDefault(day,0L)>0)
            .filter(r -> radius==null || (r.distanceKm()!=null && r.distanceKm()<=radius))
            .sorted(Comparator.comparing(RideView::distanceKm,Comparator.nullsLast(Double::compareTo)).thenComparing(RideView::id)).toList();
    }
    List<RideView> mine(Long actor) {
        collaborator(actor); Set<Long> ids=new HashSet<>(); participations.findByPassengerId(actor).forEach(p -> ids.add(p.ride.id));
        return rides.findAll().stream().filter(r -> r.driver.id.equals(actor)||ids.contains(r.id)).map(r -> rideView(r,null,null)).toList();
    }
    private Set<DayOfWeek> participationDays(Participation p) {
        // Existing requests covered the entire recurring ride.
        return p.days.isEmpty()?Set.copyOf(p.ride.days):Set.copyOf(p.days);
    }
    private Map<DayOfWeek,Long> availableSeatsByDay(Ride r) {
        Map<DayOfWeek,Long> seats=new EnumMap<>(DayOfWeek.class);
        r.days.forEach(day -> seats.put(day,(long)r.capacity));
        participations.findByRideId(r.id).stream().filter(p -> p.status==RequestStatus.ACCEPTED)
            .forEach(p -> participationDays(p).forEach(day -> seats.computeIfPresent(day,(key,count) -> Math.max(0,count-1))));
        return seats;
    }
    private void requireSeats(Ride r,Set<DayOfWeek> days) {
        Map<DayOfWeek,Long> seats=availableSeatsByDay(r);
        if (days.stream().anyMatch(day -> seats.getOrDefault(day,0L)<=0)) throw conflict("Não há vagas em todos os dias solicitados. Atualize a carona.");
    }
    private RideView rideView(Ride r,Double lat,Double lon) {
        Map<DayOfWeek,Long> seats=availableSeatsByDay(r);
        boolean eligible=r.active && r.driver.active && r.vehicle.status==VehicleStatus.APPROVED && participations.findByRideId(r.id).stream()
            .anyMatch(p -> p.status==RequestStatus.ACCEPTED && !p.relative && p.passenger.active);
        Double km=lat==null||r.latitude==null?null:distance(lat,lon,r.latitude,r.longitude);
        return new RideView(r.id,r.driver.id,r.driver.name,r.vehicle.model,r.vehicle.color,r.origin,r.destination,r.departureTime,r.capacity,
            seats.values().stream().mapToLong(Long::longValue).min().orElse(0),Set.copyOf(r.days),r.active,km,eligible,seats);
    }
    static double distance(double lat1,double lon1,double lat2,double lon2) {
        double a=Math.pow(Math.sin(Math.toRadians(lat2-lat1)/2),2)+Math.cos(Math.toRadians(lat1))*Math.cos(Math.toRadians(lat2))*Math.pow(Math.sin(Math.toRadians(lon2-lon1)/2),2);
        return 6371*2*Math.asin(Math.sqrt(Math.min(1,a)));
    }
    Group group(Long actor,Long rideId) {
        Member m=member(actor); Ride r=rides.findById(rideId).orElseThrow(ApiException::missing);
        boolean privileged=m.role!=Role.MEMBER || r.driver.id.equals(actor);
        Participation own=participations.findByRideIdAndPassengerId(rideId,actor).orElse(null);
        if (!privileged && (own==null || own.status!=RequestStatus.ACCEPTED)) throw forbidden();
        return new Group(rideView(r,null,null),r.driver.whatsapp,r.vehicle.plate,participations.findByRideId(rideId).stream()
            .filter(p -> privileged || p.status==RequestStatus.ACCEPTED).map(this::participationView).toList());
    }
    Group journeyGroup(Long actor,Long rideId) {
        Group group=group(actor,rideId);
        requireOpen(rides.findById(rideId).orElseThrow(ApiException::missing));
        return group;
    }
    List<ParticipationView> requests(Long actor) {
        collaborator(actor);
        // Offline request history has no contact details. Group contacts are fetched online.
        return participations.findByPassengerId(actor).stream().map(p -> participationView(p,false)).toList();
    }
    ParticipationView join(Long actor,Long rideId,Join input) {
        Member passenger=collaborator(actor); Ride r=rides.lock(rideId).orElseThrow(ApiException::missing);
        if (passenger.whatsapp.isBlank()) throw bad("Complete seu perfil e WhatsApp antes de solicitar carona.");
        if (r.driver.id.equals(actor)) throw bad("Você já é o motorista desta carona.");
        requireOpen(r);
        if (input.days()==null || input.days().isEmpty() || input.days().stream().anyMatch(Objects::isNull) || !r.days.containsAll(input.days())) throw bad("Selecione ao menos um dia oferecido nesta carona.");
        requireSeats(r,input.days());
        Participation p=participations.findByRideIdAndPassengerId(rideId,actor).orElseGet(Participation::new);
        if (p.id!=null && (p.status==RequestStatus.PENDING||p.status==RequestStatus.ACCEPTED)) throw conflict("Você já participa ou possui uma solicitação pendente.");
        p.ride=r; p.passenger=passenger; p.relative=input.relative(); p.status=RequestStatus.PENDING; p.updatedAt=Instant.now();
        p.days=new HashSet<>(input.days()); p.driverApproved=false; p.rhApproved=false;
        return participationView(participations.save(p));
    }
    ParticipationView decide(Long actor,Long rideId,Long requestId,Decision input) {
        Member reviewer=member(actor); Ride r=rides.lock(rideId).orElseThrow(ApiException::missing);
        boolean driverDecision=r.driver.id.equals(actor);
        if (!driverDecision && reviewer.role==Role.MEMBER) throw forbidden();
        requireOpen(r);
        Participation p=participations.findById(requestId).orElseThrow(ApiException::missing);
        if (!p.ride.id.equals(rideId)) throw missing();
        if (p.status!=RequestStatus.PENDING) throw conflict("Esta solicitação já foi respondida.");
        if (!p.passenger.active) throw bad("O colaborador está desativado.");
        if (input.accepted()) {
            if (Boolean.TRUE.equals(driverDecision?p.driverApproved:p.rhApproved)) throw conflict("Sua aprovação já foi registrada. Aguarde a outra aprovação.");
            boolean bothApproved=driverDecision?Boolean.TRUE.equals(p.rhApproved):Boolean.TRUE.equals(p.driverApproved);
            if (bothApproved) requireSeats(r,participationDays(p));
            if (driverDecision) p.driverApproved=true; else p.rhApproved=true;
            if (bothApproved) p.status=RequestStatus.ACCEPTED;
        } else {
            if (driverDecision) p.driverApproved=false; else p.rhApproved=false;
            p.status=RequestStatus.REJECTED;
        }
        p.updatedAt=Instant.now(); return participationView(p);
    }
    void leave(Long actor,Long rideId) {
        collaborator(actor); rides.lock(rideId).orElseThrow(ApiException::missing);
        Participation p=participations.findByRideIdAndPassengerId(rideId,actor).orElseThrow(ApiException::missing);
        if (p.status!=RequestStatus.PENDING && p.status!=RequestStatus.ACCEPTED) throw conflict("Não há participação ativa nesta carona.");
        p.status=RequestStatus.LEFT; p.updatedAt=Instant.now();
    }
    void remove(Long actor,Long rideId,Long requestId) {
        collaborator(actor); Ride r=rides.lock(rideId).orElseThrow(ApiException::missing); owner(actor,r);
        Participation p=participations.findById(requestId).orElseThrow(ApiException::missing);
        if (!p.ride.id.equals(rideId)) throw missing();
        if (p.status!=RequestStatus.ACCEPTED) throw conflict("Este passageiro não está na carona.");
        p.status=RequestStatus.REMOVED; p.updatedAt=Instant.now();
    }
    void cancel(Long actor,Long rideId) {
        collaborator(actor); Ride r=rides.lock(rideId).orElseThrow(ApiException::missing); owner(actor,r); r.active=false; closeParticipants(rideId);
    }
    private void closeParticipants(Long rideId) {
        participations.findByRideId(rideId).forEach(p -> {
            if (p.status==RequestStatus.PENDING || p.status==RequestStatus.ACCEPTED) { p.status=RequestStatus.REMOVED; p.updatedAt=Instant.now(); }
        });
    }
    List<RideView> groups(Long actor) { staff(actor); return rides.findAll().stream().map(r -> rideView(r,null,null)).toList(); }
    private void owner(Long actor,Ride r) { if (!r.driver.id.equals(actor)) throw forbidden(); }
    private void requireOpen(Ride r) { if (!r.active || !r.driver.active || r.vehicle.status!=VehicleStatus.APPROVED) throw conflict("Esta carona não está disponível."); }
    private ParticipationView participationView(Participation p) { return participationView(p,true); }
    private ParticipationView participationView(Participation p,boolean contacts) {
        return new ParticipationView(p.id,p.ride.id,p.passenger.id,p.passenger.name,contacts?p.passenger.whatsapp:"",p.status,p.relative,
            participationDays(p),Boolean.TRUE.equals(p.driverApproved),Boolean.TRUE.equals(p.rhApproved));
    }
}
