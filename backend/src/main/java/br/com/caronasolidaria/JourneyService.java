package br.com.caronasolidaria;

import br.com.caronasolidaria.Domain.RequestStatus;
import br.com.caronasolidaria.Dtos.Group;
import br.com.caronasolidaria.JourneyDtos.*;
import org.springframework.stereotype.Service;
import java.time.*;
import java.util.*;
import static br.com.caronasolidaria.ApiException.*;

@Service
class JourneyService {
    private final CaronaService caronas;
    private final Map<Long,Journey> live = new HashMap<>();
    private final Clock clock;
    @org.springframework.beans.factory.annotation.Autowired
    JourneyService(CaronaService caronas) { this(caronas,Clock.systemUTC()); }
    JourneyService(CaronaService caronas,Clock clock) { this.caronas=caronas;this.clock=clock; }

    private void expire() { live.values().removeIf(j -> j.updatedAt().plusSeconds(30).isBefore(clock.instant())); }
    private void driver(Long actor,Group group) { if (!actor.equals(group.ride().driverId())) throw forbidden(); }
    private void audience(Long actor,Group group,DayOfWeek day) {
        if (!actor.equals(group.ride().driverId()) && group.participants().stream().noneMatch(p -> actor.equals(p.passengerId()) && p.status()==RequestStatus.ACCEPTED && p.days().contains(day))) throw forbidden();
    }
    private void passengers(Group group,Plan plan,DayOfWeek day) {
        if (!group.ride().days().contains(day)) throw bad("Escolha um dia oferecido pela carona.");
        Set<Long> allowed=new HashSet<>();
        group.participants().stream().filter(p -> p.status()==RequestStatus.ACCEPTED && p.days().contains(day)).forEach(p -> allowed.add(p.passengerId()));
        Set<Long> used=new HashSet<>();
        for (Stop stop:plan.stops()) if (stop.kind().equals("passenger") && (!allowed.contains(stop.passengerId()) || !used.add(stop.passengerId()))) throw conflict("As participações mudaram. Recalcule a rota com passageiros confirmados neste dia.");
        if (used.size()>group.ride().capacity()) throw bad("A rota excede a capacidade da carona.");
    }
    synchronized Journey read(Long actor,Long rideId) {
        expire();Group group=caronas.journeyGroup(actor,rideId);Journey journey=live.get(rideId);
        if (journey==null) return null;
        audience(actor,group,journey.day());
        try { passengers(group,journey.plan(),journey.day()); }
        catch(ApiException changed) { live.remove(rideId);return null; }
        return journey;
    }
    synchronized Journey start(Long actor,Long rideId,Start input) {
        expire();Group group=caronas.journeyGroup(actor,rideId);driver(actor,group);
        if (live.containsKey(rideId)) throw conflict("Já existe uma transmissão ativa. Encerre-a antes de iniciar outra.");
        validatePlan(input.plan());passengers(group,input.plan(),input.day());validateState(input.plan(),input.state());
        Journey journey=new Journey(UUID.randomUUID().toString(),input.day(),input.source(),input.plan(),input.state(),clock.instant(),0);
        live.put(rideId,journey);return journey;
    }
    synchronized Journey update(Long actor,Long rideId,String id,Update input) {
        expire();Group group=caronas.journeyGroup(actor,rideId);driver(actor,group);
        Journey old=live.get(rideId);
        if (old==null || !old.id().equals(id)) throw conflict("Transmissão encerrada ou expirada. Inicie novamente.");
        passengers(group,old.plan(),old.day());validateState(old.plan(),input.state());
        if(input.sequence()<=old.sequence()) throw conflict("Atualização de localização fora de ordem.");
        Journey next=new Journey(old.id(),old.day(),old.source(),old.plan(),input.state(),clock.instant(),input.sequence());live.put(rideId,next);return next;
    }
    synchronized void stop(Long actor,Long rideId,String id) {
        // Also allow cleanup after cancellation, without reopening the recurring ride.
        Group group=caronas.group(actor,rideId);driver(actor,group);
        Journey old=live.get(rideId);if(old!=null && old.id().equals(id)) live.remove(rideId);
    }
    private void geo(double lat,double lng) { if(!Double.isFinite(lat)||!Double.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180) throw bad("Coordenadas inválidas."); }
    private void positive(double n) { if(!Double.isFinite(n)||n<0) throw bad("Distância ou duração inválida."); }
    private void validatePlan(Plan plan) {
        if(plan.stops().size()!=plan.segments().size()+1) throw bad("Rota incompleta.");
        Set<String> ids=new HashSet<>();int points=0;
        for(int i=0;i<plan.stops().size();i++) {
            Stop stop=plan.stops().get(i);geo(stop.lat(),stop.lng());
            String kind=i==0?"origin":i==plan.stops().size()-1?"destination":"passenger";
            if(stop.order()!=i||!kind.equals(stop.kind())||!ids.add(stop.id())) throw bad("Ordem de paradas inválida.");
        }
        double meters=0,seconds=0;
        for(int i=0;i<plan.segments().size();i++) {
            Segment s=plan.segments().get(i);positive(s.distance());positive(s.duration());meters+=s.distance();seconds+=s.duration();
            if(s.fromIndex()!=i||s.toIndex()!=i+1) throw bad("Trechos fora de ordem.");
            for(List<Double> point:s.geometry()) { geo(point.get(0),point.get(1));points++; }
        }
        positive(plan.totalDistance());positive(plan.totalDuration());
        if(points>50000 || Math.abs(meters-plan.totalDistance())>1 || Math.abs(seconds-plan.totalDuration())>1) throw bad("Totais ou tamanho da rota inválidos.");
    }
    private void validateState(Plan plan,State state) {
        geo(state.lat(),state.lng());Progress p=state.progress();
        if(!Double.isFinite(p.fraction())||p.fraction()<0||p.fraction()>1||p.segmentIndex()<0||p.segmentIndex()>=plan.segments().size()||p.nextStopIndex()!=p.segmentIndex()+1) throw bad("Progresso de viagem inválido.");
        if(p.phase().equals("boarding") && (!plan.stops().get(p.nextStopIndex()).kind().equals("passenger")||p.fraction()!=1)) throw bad("Embarque inválido.");
        if(p.phase().equals("arrived") && (p.nextStopIndex()!=plan.stops().size()-1||p.fraction()!=1)) throw bad("Chegada inválida.");
        if(!p.phase().equals("boarding") && state.boardingLeft()!=0) throw bad("Contagem de embarque inválida.");
    }
}
