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
        RideView r=ride(1);ParticipationView p=service.join(passenger.id,r.id(),new Join(false));
        service.decide(driver.id,r.id(),p.id(),new Decision(true));
        assertThat(service.search(other.id,null,null,null,null,null)).isEmpty();
        assertThat(service.group(passenger.id,r.id()).ride().specialParkingEligible()).isTrue();
        service.leave(passenger.id,r.id());assertThat(service.search(other.id,null,null,null,null,null)).hasSize(1);
        assertThat(service.group(driver.id,r.id()).ride().availableSeats()).isEqualTo(1);
        assertThatThrownBy(()->service.group(passenger.id,r.id())).isInstanceOf(ApiException.class);
    }
    @Test void relativesUseSeatsButDoNotGrantSpecialParking() {
        RideView r=ride(2);ParticipationView p=service.join(passenger.id,r.id(),new Join(true));service.decide(driver.id,r.id(),p.id(),new Decision(true));
        Group group=service.group(driver.id,r.id());assertThat(group.ride().availableSeats()).isEqualTo(1);assertThat(group.ride().specialParkingEligible()).isFalse();
    }
    @Test void preventsDuplicateRequestsSelfJoinAndUnauthorizedDecisions() {
        RideView r=ride(2);assertThatThrownBy(()->service.join(driver.id,r.id(),new Join(false))).isInstanceOf(ApiException.class);
        ParticipationView p=service.join(passenger.id,r.id(),new Join(false));
        assertThatThrownBy(()->service.join(passenger.id,r.id(),new Join(false))).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->service.decide(other.id,r.id(),p.id(),new Decision(true))).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->service.group(other.id,r.id())).isInstanceOf(ApiException.class);
        service.decide(driver.id,r.id(),p.id(),new Decision(false));assertThat(service.requests(passenger.id).get(0).status()).isEqualTo(RequestStatus.REJECTED);
    }
    @Test void removingAndCancellingReleaseSeatsAndRejectFurtherRequests() {
        RideView r=ride(1);ParticipationView p=service.join(passenger.id,r.id(),new Join(false));service.decide(driver.id,r.id(),p.id(),new Decision(true));
        service.remove(driver.id,r.id(),p.id());assertThat(service.group(driver.id,r.id()).ride().availableSeats()).isEqualTo(1);
        service.join(other.id,r.id(),new Join(false));service.cancel(driver.id,r.id());
        assertThat(service.requests(other.id).get(0).status()).isEqualTo(RequestStatus.REMOVED);
        assertThatThrownBy(()->service.join(passenger.id,r.id(),new Join(false))).isInstanceOf(ApiException.class);
    }
    @Test void concurrentApprovalsCannotOverbookLastSeat() throws Exception {
        RideView r=ride(1);ParticipationView a=service.join(passenger.id,r.id(),new Join(false)),b=service.join(other.id,r.id(),new Join(false));
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
        assertThatThrownBy(()->service.join(passenger.id,r.id(),new Join(false))).isInstanceOf(ApiException.class);
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
}
