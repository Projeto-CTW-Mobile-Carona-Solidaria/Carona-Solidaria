package br.com.caronasolidaria;

import br.com.caronasolidaria.Domain.*;
import br.com.caronasolidaria.Dtos.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:carona-test;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000","spring.jpa.hibernate.ddl-auto=create-drop","app.bootstrap.email=admin@test.local","app.bootstrap.password=testing-password-123"})
@AutoConfigureMockMvc
class CaronaIntegrationTest {
    @Autowired Members members; @Autowired Vehicles vehicles; @Autowired Rides rides;
    @Autowired Participations participations; @Autowired Sessions sessions; @Autowired CaronaService service;
    @Autowired AuthService auth; @Autowired PasswordEncoder passwords; @Autowired MockMvc mvc; @Autowired ObjectMapper json;
    @Autowired ParticipationUpgrade upgrade;
    @Autowired JourneyService journeys;
    Member admin,rh,driver,passenger,other; static String passwordHash;
    final Set<DayOfWeek> days=Set.of(DayOfWeek.MONDAY,DayOfWeek.WEDNESDAY);
    @BeforeEach void setup() {
        sessions.deleteAll();participations.deleteAll();rides.deleteAll();vehicles.deleteAll();members.deleteAll();
        if(passwordHash==null)passwordHash=passwords.encode("testing-password-123");
        admin=member("admin",Role.ADMIN);rh=member("rh",Role.RH);driver=member("driver",Role.MEMBER);passenger=member("passenger",Role.MEMBER);other=member("other",Role.MEMBER);
    }
    Member member(String name,Role role) {
        Member m=new Member();m.name=name;m.email=name+"@test.local";m.employeeId=name;m.role=role;
        m.passwordHash=passwordHash;m.whatsapp="5547999999999";m.neighborhood="Centro";m.days=new HashSet<>(days);return members.save(m);
    }
    VehicleView vehicle() {return service.submitVehicle(driver.id,new VehicleInput("ABC1D23","Honda Civic","Azul",4));}
    RideInput input(int seats) {return new RideInput("Centro","WEG","07:00",seats,days,-26.48,-49.07);}
    RideView ride(int seats) {VehicleView v=vehicle();service.review(rh.id,v.id(),new Review(true,null));return service.offer(driver.id,input(seats));}
    String token(Member m) {return auth.login(new Login(m.email,"testing-password-123")).token();}

    JourneyDtos.Start journeyInput() {
        var stops=List.of(
            new JourneyDtos.Stop("origin",null,"origin",0,"Saída","Ponto público A",-26.48,-49.07),
            new JourneyDtos.Stop("passenger",passenger.id,"passenger",1,passenger.name,"Ponto público B",-26.49,-49.08),
            new JourneyDtos.Stop("destination",null,"destination",2,"WEG","Ponto público C",-26.5,-49.09));
        var segments=List.of(
            new JourneyDtos.Segment(0,1,1000,100,List.of(List.of(-26.48,-49.07),List.of(-26.49,-49.08))),
            new JourneyDtos.Segment(1,2,1000,100,List.of(List.of(-26.49,-49.08),List.of(-26.5,-49.09))));
        return new JourneyDtos.Start(DayOfWeek.MONDAY,"simulator",new JourneyDtos.Plan(stops,segments,2000,200),new JourneyDtos.State(-26.48,-49.07,new JourneyDtos.Progress(0,0,"moving",1),0));
    }
    ParticipationView confirmed(Member person,RideView ride,Set<DayOfWeek> requestedDays) {
        ParticipationView p=service.join(person.id,ride.id(),new Join(false,requestedDays));
        service.decide(driver.id,ride.id(),p.id(),new Decision(true));return service.decide(rh.id,ride.id(),p.id(),new Decision(true));
    }
    @Test void journeyRequiresBothApprovalsAndRestrictsAudienceByRideAndDay() throws Exception {
        RideView r=ride(2);String path="/api/rides/"+r.id()+"/journey";
        ParticipationView p=service.join(passenger.id,r.id(),new Join(false,Set.of(DayOfWeek.MONDAY)));
        service.decide(driver.id,r.id(),p.id(),new Decision(true));
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        mvc.perform(get(path).header("Authorization","Bearer "+token(passenger))).andExpect(status().isForbidden());
        assertThatThrownBy(()->journeys.start(driver.id,r.id(),journeyInput())).isInstanceOf(ApiException.class);
        service.decide(rh.id,r.id(),p.id(),new Decision(true));
        confirmed(other,r,Set.of(DayOfWeek.WEDNESDAY));
        JourneyDtos.Journey live=journeys.start(driver.id,r.id(),journeyInput());
        mvc.perform(get(path).header("Authorization","Bearer "+token(passenger))).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(live.id())).andExpect(jsonPath("$.source").value("simulator"));
        mvc.perform(get(path).header("Authorization","Bearer "+token(other))).andExpect(status().isForbidden());
        mvc.perform(post(path).header("Authorization","Bearer "+token(passenger)).contentType("application/json").content(json.writeValueAsString(journeyInput()))).andExpect(status().isForbidden());
        assertThat(service.group(driver.id,r.id()).ride().availableSeatsByDay().get(DayOfWeek.MONDAY)).isEqualTo(1);
    }
    @Test void journeyRejectsOutOfOrderUpdatesAndCannotBeResurrectedAfterStop() throws Exception {
        RideView r=ride(1);confirmed(passenger,r,days);var live=journeys.start(driver.id,r.id(),journeyInput());
        String path="/api/rides/"+r.id()+"/journey/"+live.id();
        var update=new JourneyDtos.Update(1,new JourneyDtos.State(-26.49,-49.08,new JourneyDtos.Progress(0,1,"boarding",1),5));
        mvc.perform(put(path).header("Authorization","Bearer "+token(driver)).contentType("application/json").content(json.writeValueAsString(update))).andExpect(status().isOk()).andExpect(jsonPath("$.state.boardingLeft").value(5));
        assertThatThrownBy(()->journeys.update(driver.id,r.id(),live.id(),update)).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->journeys.update(passenger.id,r.id(),live.id(),new JourneyDtos.Update(2,update.state()))).isInstanceOf(ApiException.class);
        journeys.stop(driver.id,r.id(),live.id());assertThat(journeys.read(passenger.id,r.id())).isNull();
        assertThatThrownBy(()->journeys.update(driver.id,r.id(),live.id(),new JourneyDtos.Update(2,update.state()))).isInstanceOf(ApiException.class);
        var next=journeys.start(driver.id,r.id(),journeyInput());journeys.stop(driver.id,r.id(),live.id());
        assertThat(journeys.read(passenger.id,r.id()).id()).isEqualTo(next.id());
    }
    @Test void removalAndCancellationRevokeJourneyAccessWithoutChangingSeatRules() {
        RideView r=ride(1);var p=confirmed(passenger,r,days);journeys.start(driver.id,r.id(),journeyInput());
        service.remove(driver.id,r.id(),p.id());
        assertThatThrownBy(()->journeys.read(passenger.id,r.id())).isInstanceOf(ApiException.class);
        assertThat(journeys.read(driver.id,r.id())).isNull();
        confirmed(passenger,r,days);journeys.start(driver.id,r.id(),journeyInput());service.cancel(driver.id,r.id());
        assertThatThrownBy(()->journeys.read(driver.id,r.id())).isInstanceOf(ApiException.class);
    }
    @Test void journeyExpiresWithoutHeartbeatAndRejectsAnOldLease() {
        RideView r=ride(1);confirmed(passenger,r,days);
        var instant=new java.util.concurrent.atomic.AtomicReference<>(Instant.parse("2026-10-02T12:00:00Z"));
        Clock clock=new Clock(){public ZoneId getZone(){return ZoneOffset.UTC;}public Clock withZone(ZoneId zone){return this;}public Instant instant(){return instant.get();}};
        JourneyService isolated=new JourneyService(service,clock);var live=isolated.start(driver.id,r.id(),journeyInput());
        instant.set(instant.get().plusSeconds(31));assertThat(isolated.read(passenger.id,r.id())).isNull();
        assertThatThrownBy(()->isolated.update(driver.id,r.id(),live.id(),new JourneyDtos.Update(1,live.state()))).isInstanceOf(ApiException.class);
    }
    @Test void journeyValidatesGeometryAndProgressOverHttp() throws Exception {
        RideView r=ride(1);confirmed(passenger,r,days);String path="/api/rides/"+r.id()+"/journey",authorization="Bearer "+token(driver);
        var invalid=json.valueToTree(journeyInput());((com.fasterxml.jackson.databind.node.ObjectNode)invalid.path("plan").path("stops").get(0)).put("lat",91);
        mvc.perform(post(path).header("Authorization",authorization).contentType("application/json").content(json.writeValueAsString(invalid))).andExpect(status().isBadRequest());
        var live=journeys.start(driver.id,r.id(),journeyInput());
        var premature=new JourneyDtos.Update(1,new JourneyDtos.State(-26.48,-49.07,new JourneyDtos.Progress(0,1,"arrived",1),0));
        mvc.perform(put(path+"/"+live.id()).header("Authorization",authorization).contentType("application/json").content(json.writeValueAsString(premature))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/navigation/route").contentType("application/json").content("{\"points\":[]}")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/navigation/route").header("Authorization",authorization).contentType("application/json").content("{\"points\":[{\"lat\":100,\"lng\":0},{\"lat\":0,\"lng\":0}]}")).andExpect(status().isBadRequest());
    }
    @Test void rejectsUnknownRegistrationAndConsumesInvitationOnlyOnce() {
        assertThatThrownBy(()->auth.register(new Registration("outsider@test.local","missing","code","testing-password-123"))).isInstanceOf(ApiException.class);
        InviteResult invite=service.invite(rh.id,new Invitation("Novo","new@test.local","100"));
        Registration input=new Registration("new@test.local","100",invite.invitationCode(),"testing-password-123");
        assertThat(auth.register(input).user().role()).isEqualTo(Role.MEMBER);
        assertThatThrownBy(()->auth.register(input)).isInstanceOf(ApiException.class);
        assertThat(members.findByEmailIgnoreCase("new@test.local").orElseThrow().invitationHash).isNull();
    }
    @Test void enforcesHttpAuthenticationAndRoles() throws Exception {
        mvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/rh/vehicles").header("Authorization","Bearer "+token(passenger))).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/rh").header("Authorization","Bearer "+token(rh))).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/rh").header("Authorization","Bearer "+token(admin))).andExpect(status().isOk());
        mvc.perform(get("/api/me").header("Authorization","Bearer "+token(passenger))).andExpect(jsonPath("$.passwordHash").doesNotExist()).andExpect(jsonPath("$.invitationHash").doesNotExist());
    }
    @Test void validatesProfileAndRejectionReasonOverHttp() throws Exception {
        mvc.perform(put("/api/me").header("Authorization","Bearer "+token(passenger)).contentType("application/json")
            .content("{\"name\":\"\",\"whatsapp\":\"bad\",\"neighborhood\":\"\",\"days\":[]}")).andExpect(status().isBadRequest());
        VehicleView v=vehicle();
        mvc.perform(patch("/api/rh/vehicles/"+v.id()).header("Authorization","Bearer "+token(rh)).contentType("application/json")
            .content("{\"approved\":false,\"reason\":\"\"}")).andExpect(status().isBadRequest());
    }
    @Test void requiresApprovedVehicleAndAllowsCorrectionAfterRejection() {
        VehicleView v=vehicle();assertThatThrownBy(()->service.offer(driver.id,input(2))).isInstanceOf(ApiException.class);
        service.review(rh.id,v.id(),new Review(false,"Corrija a placa"));
        assertThat(service.myVehicle(driver.id).rejectionReason()).isEqualTo("Corrija a placa");
        VehicleView corrected=service.submitVehicle(driver.id,new VehicleInput("ABC1234","Civic","Azul",4));
        assertThat(corrected.status()).isEqualTo(VehicleStatus.PENDING);assertThat(corrected.rejectionReason()).isNull();
        service.review(rh.id,corrected.id(),new Review(true,null));
        assertThat(service.offer(driver.id,input(2)).availableSeats()).isEqualTo(2);
        assertThatThrownBy(()->service.offer(driver.id,input(5))).isInstanceOf(ApiException.class);
    }
    @Test void fullRideDisappearsAndReturnsWhenPassengerLeaves() {
        RideView r=ride(1);ParticipationView p=service.join(passenger.id,r.id(),new Join(false,days));
        service.decide(driver.id,r.id(),p.id(),new Decision(true));service.decide(rh.id,r.id(),p.id(),new Decision(true));
        assertThat(service.search(other.id,null,null,null,null,null)).isEmpty();
        assertThat(service.group(passenger.id,r.id()).ride().specialParkingEligible()).isTrue();
        service.leave(passenger.id,r.id());assertThat(service.search(other.id,null,null,null,null,null)).hasSize(1);
        assertThat(service.group(driver.id,r.id()).ride().availableSeats()).isEqualTo(1);
        assertThatThrownBy(()->service.group(passenger.id,r.id())).isInstanceOf(ApiException.class);
    }
    @Test void relativesUseSeatsButDoNotGrantSpecialParking() {
        RideView r=ride(2);ParticipationView p=service.join(passenger.id,r.id(),new Join(true,days));service.decide(driver.id,r.id(),p.id(),new Decision(true));service.decide(rh.id,r.id(),p.id(),new Decision(true));
        Group group=service.group(driver.id,r.id());assertThat(group.ride().availableSeats()).isEqualTo(1);assertThat(group.ride().specialParkingEligible()).isFalse();
    }
    @Test void preventsDuplicateRequestsSelfJoinAndUnauthorizedDecisions() {
        RideView r=ride(2);assertThatThrownBy(()->service.join(driver.id,r.id(),new Join(false,days))).isInstanceOf(ApiException.class);
        ParticipationView p=service.join(passenger.id,r.id(),new Join(false,days));
        assertThatThrownBy(()->service.join(passenger.id,r.id(),new Join(false,days))).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->service.decide(other.id,r.id(),p.id(),new Decision(true))).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->service.group(other.id,r.id())).isInstanceOf(ApiException.class);
        service.decide(driver.id,r.id(),p.id(),new Decision(false));assertThat(service.requests(passenger.id).get(0).status()).isEqualTo(RequestStatus.REJECTED);
    }
    @Test void removingAndCancellingReleaseSeatsAndRejectFurtherRequests() {
        RideView r=ride(1);ParticipationView p=service.join(passenger.id,r.id(),new Join(false,days));service.decide(driver.id,r.id(),p.id(),new Decision(true));service.decide(rh.id,r.id(),p.id(),new Decision(true));
        service.remove(driver.id,r.id(),p.id());assertThat(service.group(driver.id,r.id()).ride().availableSeats()).isEqualTo(1);
        service.join(other.id,r.id(),new Join(false,days));service.cancel(driver.id,r.id());
        assertThat(service.requests(other.id).get(0).status()).isEqualTo(RequestStatus.REMOVED);
        assertThatThrownBy(()->service.join(passenger.id,r.id(),new Join(false,days))).isInstanceOf(ApiException.class);
    }
    @Test void concurrentApprovalsCannotOverbookLastSeat() throws Exception {
        RideView r=ride(1);ParticipationView a=service.join(passenger.id,r.id(),new Join(false,days)),b=service.join(other.id,r.id(),new Join(false,days));
        service.decide(rh.id,r.id(),a.id(),new Decision(true));service.decide(rh.id,r.id(),b.id(),new Decision(true));
        CountDownLatch start=new CountDownLatch(1);ExecutorService pool=Executors.newFixedThreadPool(2);
        try {
            List<Future<Boolean>> attempts=new ArrayList<>();
            for(ParticipationView p:List.of(a,b)) attempts.add(pool.submit(()->{start.await();try{service.decide(driver.id,r.id(),p.id(),new Decision(true));return true;}catch(ApiException ex){assertThat(ex.status.value()).isEqualTo(409);return false;}}));
            start.countDown();int approved=0;for(Future<Boolean> result:attempts)if(result.get(15,TimeUnit.SECONDS))approved++;
            assertThat(approved).isEqualTo(1);assertThat(service.group(driver.id,r.id()).ride().availableSeats()).isZero();
        } finally {pool.shutdownNow();}
    }
    @Test void disablingMemberRevokesTokenAndClosesDriverGroups() {
        RideView r=ride(2);String token=token(driver);service.updateAccount(rh.id,driver.id,Role.MEMBER,new AccountUpdate("driver",false));
        assertThat(auth.authenticate(token)).isNull();assertThat(service.groups(rh.id).get(0).active()).isFalse();
        assertThatThrownBy(()->service.join(passenger.id,r.id(),new Join(false,days))).isInstanceOf(ApiException.class);
    }
    @Test void logoutAndExpirationRevokeAccess() {
        String token=token(passenger);assertThat(auth.authenticate(token)).isNotNull();auth.logout(token);assertThat(auth.authenticate(token)).isNull();
        String expired=token(passenger);Session s=sessions.findById(AuthService.hash(expired)).orElseThrow();s.expiresAt=Instant.now().minusSeconds(1);sessions.save(s);
        assertThat(auth.authenticate(expired)).isNull();
    }
    @Test void searchHonorsDayQueryAndRadius() {
        ride(2);assertThat(service.search(passenger.id,"Centro",DayOfWeek.MONDAY,-26.48,-49.07,1.0)).hasSize(1);
        assertThat(service.search(passenger.id,"Centro",DayOfWeek.TUESDAY,null,null,null)).isEmpty();
        assertThat(service.search(passenger.id,null,null,0.0,0.0,1.0)).isEmpty();
        assertThatThrownBy(()->service.search(passenger.id,null,null,null,null,10.0)).isInstanceOf(ApiException.class);
    }
    @Test void driverApprovalWaitsForRhWithoutConsumingSeatsOrExposingContacts() {
        RideView r=ride(1);ParticipationView p=service.join(passenger.id,r.id(),new Join(false,days));
        ParticipationView first=service.decide(driver.id,r.id(),p.id(),new Decision(true));
        assertThat(first.status()).isEqualTo(RequestStatus.PENDING);
        assertThat(first.driverApproved()).isTrue();assertThat(first.rhApproved()).isFalse();
        assertThat(service.group(driver.id,r.id()).ride().availableSeats()).isEqualTo(1);
        assertThat(service.group(driver.id,r.id()).ride().specialParkingEligible()).isFalse();
        assertThat(service.requests(passenger.id).get(0).whatsapp()).isEmpty();
        assertThatThrownBy(()->service.group(passenger.id,r.id())).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->service.decide(driver.id,r.id(),p.id(),new Decision(true))).isInstanceOf(ApiException.class);
        ParticipationView confirmed=service.decide(rh.id,r.id(),p.id(),new Decision(true));
        assertThat(confirmed.status()).isEqualTo(RequestStatus.ACCEPTED);
        assertThat(confirmed.driverApproved() && confirmed.rhApproved()).isTrue();
        assertThat(service.group(passenger.id,r.id()).ride().availableSeats()).isZero();
        assertThatThrownBy(()->service.decide(rh.id,r.id(),p.id(),new Decision(true))).isInstanceOf(ApiException.class);
    }
    @Test void staffApprovalCanComeFirstButCannotReplaceDriverApproval() {
        RideView r=ride(1);ParticipationView p=service.join(passenger.id,r.id(),new Join(false,days));
        ParticipationView first=service.decide(admin.id,r.id(),p.id(),new Decision(true));
        assertThat(first.status()).isEqualTo(RequestStatus.PENDING);
        assertThat(first.rhApproved()).isTrue();assertThat(first.driverApproved()).isFalse();
        assertThatThrownBy(()->service.decide(rh.id,r.id(),p.id(),new Decision(true))).isInstanceOf(ApiException.class);
        assertThat(service.group(driver.id,r.id()).ride().availableSeats()).isEqualTo(1);
        assertThat(service.decide(driver.id,r.id(),p.id(),new Decision(true)).status()).isEqualTo(RequestStatus.ACCEPTED);
    }
    @Test void disjointDaysShareOneSeatAndSearchChecksTheRequestedDay() {
        RideView r=ride(1);
        ParticipationView monday=service.join(passenger.id,r.id(),new Join(false,Set.of(DayOfWeek.MONDAY)));
        service.decide(driver.id,r.id(),monday.id(),new Decision(true));service.decide(rh.id,r.id(),monday.id(),new Decision(true));
        assertThat(service.search(other.id,null,DayOfWeek.MONDAY,null,null,null)).isEmpty();
        assertThat(service.search(other.id,null,DayOfWeek.WEDNESDAY,null,null,null)).hasSize(1);
        assertThat(service.search(other.id,null,null,null,null,null)).hasSize(1);
        assertThatThrownBy(()->service.join(other.id,r.id(),new Join(false,days))).isInstanceOf(ApiException.class);
        ParticipationView wednesday=service.join(other.id,r.id(),new Join(false,Set.of(DayOfWeek.WEDNESDAY)));
        service.decide(rh.id,r.id(),wednesday.id(),new Decision(true));service.decide(driver.id,r.id(),wednesday.id(),new Decision(true));
        assertThat(service.group(driver.id,r.id()).ride().availableSeatsByDay()).containsEntry(DayOfWeek.MONDAY,0L).containsEntry(DayOfWeek.WEDNESDAY,0L);
        assertThat(service.requests(passenger.id).get(0).days()).containsExactly(DayOfWeek.MONDAY);
        service.leave(passenger.id,r.id());
        assertThat(service.group(driver.id,r.id()).ride().availableSeatsByDay()).containsEntry(DayOfWeek.MONDAY,1L).containsEntry(DayOfWeek.WEDNESDAY,0L);
        service.remove(driver.id,r.id(),wednesday.id());
        assertThat(service.group(driver.id,r.id()).ride().availableSeatsByDay()).containsEntry(DayOfWeek.MONDAY,1L).containsEntry(DayOfWeek.WEDNESDAY,1L);
    }
    @Test void finalApprovalChecksEveryDayAndRollsBackWhenOneIsFull() {
        RideView r=ride(1);
        ParticipationView a=service.join(passenger.id,r.id(),new Join(false,days));
        ParticipationView b=service.join(other.id,r.id(),new Join(false,Set.of(DayOfWeek.MONDAY)));
        service.decide(driver.id,r.id(),a.id(),new Decision(true));
        service.decide(driver.id,r.id(),b.id(),new Decision(true));service.decide(rh.id,r.id(),b.id(),new Decision(true));
        assertThatThrownBy(()->service.decide(rh.id,r.id(),a.id(),new Decision(true))).isInstanceOf(ApiException.class);
        ParticipationView pending=service.requests(passenger.id).get(0);
        assertThat(pending.status()).isEqualTo(RequestStatus.PENDING);assertThat(pending.rhApproved()).isFalse();
        assertThat(service.group(driver.id,r.id()).ride().availableSeatsByDay()).containsEntry(DayOfWeek.WEDNESDAY,1L);
        service.leave(other.id,r.id());
        assertThat(service.decide(rh.id,r.id(),a.id(),new Decision(true)).status()).isEqualTo(RequestStatus.ACCEPTED);
    }
    @Test void eitherSideCanRejectAndRejoiningResetsDaysAndBothApprovals() {
        RideView r=ride(1);ParticipationView p=service.join(passenger.id,r.id(),new Join(false,days));
        service.decide(driver.id,r.id(),p.id(),new Decision(true));
        assertThat(service.decide(rh.id,r.id(),p.id(),new Decision(false)).status()).isEqualTo(RequestStatus.REJECTED);
        assertThat(service.group(driver.id,r.id()).ride().availableSeats()).isEqualTo(1);
        ParticipationView retry=service.join(passenger.id,r.id(),new Join(true,Set.of(DayOfWeek.WEDNESDAY)));
        assertThat(retry.id()).isEqualTo(p.id());assertThat(retry.days()).containsExactly(DayOfWeek.WEDNESDAY);
        assertThat(retry.driverApproved() || retry.rhApproved()).isFalse();assertThat(retry.relative()).isTrue();
        service.decide(rh.id,r.id(),p.id(),new Decision(true));
        assertThat(service.decide(driver.id,r.id(),p.id(),new Decision(false)).status()).isEqualTo(RequestStatus.REJECTED);
        assertThatThrownBy(()->service.decide(rh.id,r.id(),p.id(),new Decision(true))).isInstanceOf(ApiException.class);
    }
    @Test void cancellationAndDeactivationPreventFinalApproval() {
        RideView r=ride(1);ParticipationView p=service.join(passenger.id,r.id(),new Join(false,days));
        service.decide(driver.id,r.id(),p.id(),new Decision(true));service.leave(passenger.id,r.id());
        assertThatThrownBy(()->service.decide(rh.id,r.id(),p.id(),new Decision(true))).isInstanceOf(ApiException.class);
        service.join(passenger.id,r.id(),new Join(false,days));service.decide(rh.id,r.id(),p.id(),new Decision(true));
        service.updateAccount(rh.id,passenger.id,Role.MEMBER,new AccountUpdate("passenger",false));
        assertThatThrownBy(()->service.decide(driver.id,r.id(),p.id(),new Decision(true))).isInstanceOf(ApiException.class);
        ParticipationView next=service.join(other.id,r.id(),new Join(false,days));service.decide(driver.id,r.id(),next.id(),new Decision(true));
        service.cancel(driver.id,r.id());
        assertThatThrownBy(()->service.decide(rh.id,r.id(),next.id(),new Decision(true))).isInstanceOf(ApiException.class);
    }
    @Test void validatesDaysAndJointApprovalOverHttp() throws Exception {
        RideView r=ride(1);String passengerToken=token(passenger),driverToken=token(driver),rhToken=token(rh);
        String path="/api/rides/"+r.id()+"/requests";
        for(String body:List.of("{\"relative\":false}","{\"days\":[]}","{\"days\":[null]}","{\"days\":[\"TUESDAY\"]}","{\"days\":[\"MONDAY\",\"TUESDAY\"]}")) {
            mvc.perform(post(path).header("Authorization","Bearer "+passengerToken).contentType("application/json").content(body)).andExpect(status().isBadRequest());
        }
        var result=mvc.perform(post(path).header("Authorization","Bearer "+passengerToken).contentType("application/json").content("{\"relative\":false,\"days\":[\"MONDAY\"]}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.days[0]").value("MONDAY")).andExpect(jsonPath("$.driverApproved").value(false)).andReturn();
        long requestId=json.readTree(result.getResponse().getContentAsString()).path("id").asLong();
        mvc.perform(patch(path+"/"+requestId).header("Authorization","Bearer "+passengerToken).contentType("application/json").content("{\"accepted\":true}")).andExpect(status().isForbidden());
        mvc.perform(patch(path+"/"+requestId).header("Authorization","Bearer "+rhToken).contentType("application/json").content("{\"accepted\":true}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PENDING")).andExpect(jsonPath("$.rhApproved").value(true));
        mvc.perform(patch(path+"/"+requestId).header("Authorization","Bearer "+driverToken).contentType("application/json").content("{\"accepted\":true}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACCEPTED"));
        mvc.perform(get("/api/rides/"+r.id()).header("Authorization","Bearer "+driverToken))
            .andExpect(jsonPath("$.ride.availableSeatsByDay.MONDAY").value(0)).andExpect(jsonPath("$.ride.availableSeatsByDay.WEDNESDAY").value(1));
    }
    @Test void upgradesLegacyRequestsOnceWithoutInventingRhApproval() {
        RideView r=ride(1);ParticipationView request=service.join(passenger.id,r.id(),new Join(false,days));
        Participation p=participations.findById(request.id()).orElseThrow();
        p.days=new HashSet<>();p.driverApproved=null;p.rhApproved=null;p.status=RequestStatus.ACCEPTED;participations.save(p);
        upgrade.run();upgrade.run();
        ParticipationView migrated=service.requests(passenger.id).get(0);
        assertThat(migrated.days()).containsExactlyInAnyOrderElementsOf(days);
        assertThat(migrated.status()).isEqualTo(RequestStatus.PENDING);
        assertThat(migrated.driverApproved()).isTrue();assertThat(migrated.rhApproved()).isFalse();
        service.decide(rh.id,r.id(),p.id,new Decision(true));upgrade.run();
        assertThat(service.requests(passenger.id).get(0).status()).isEqualTo(RequestStatus.ACCEPTED);
        assertThat(service.group(driver.id,r.id()).ride().availableSeats()).isZero();
    }
}
