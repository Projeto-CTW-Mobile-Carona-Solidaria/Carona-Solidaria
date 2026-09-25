package br.com.caronasolidaria;
import br.com.caronasolidaria.Domain.Role;
import br.com.caronasolidaria.Dtos.*;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.DayOfWeek;
import java.util.*;

@RestController @RequestMapping("/api")
class ApiController {
    private final AuthService auth; private final CaronaService service;
    ApiController(AuthService auth,CaronaService service) { this.auth=auth; this.service=service; }
    @GetMapping("/health") Map<String,String> health() { return Map.of("status","UP"); }
    @PostMapping("/auth/login") Auth login(@Valid @RequestBody Login input) { return auth.login(input); }
    @PostMapping("/auth/register") Auth register(@Valid @RequestBody Registration input) { return auth.register(input); }
    @PostMapping("/auth/logout") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    void logout(@RequestHeader("Authorization") String header) { auth.logout(header.substring(7)); }
    @GetMapping("/me") Person me(@AuthenticationPrincipal Long id) { return service.profile(id); }
    @PutMapping("/me") Person updateProfile(@AuthenticationPrincipal Long id,@Valid @RequestBody Profile input) { return service.updateProfile(id,input); }
    @GetMapping("/me/vehicle") VehicleView vehicle(@AuthenticationPrincipal Long id) { return service.myVehicle(id); }
    @PutMapping("/me/vehicle") VehicleView submit(@AuthenticationPrincipal Long id,@Valid @RequestBody VehicleInput input) { return service.submitVehicle(id,input); }
    @GetMapping("/me/rides") List<RideView> mine(@AuthenticationPrincipal Long id) { return service.mine(id); }
    @GetMapping("/me/requests") List<ParticipationView> requests(@AuthenticationPrincipal Long id) { return service.requests(id); }
    @GetMapping("/rides") List<RideView> search(@AuthenticationPrincipal Long id,@RequestParam(required=false) String query,@RequestParam(required=false) DayOfWeek day,
        @RequestParam(required=false) Double latitude,@RequestParam(required=false) Double longitude,@RequestParam(required=false) Double radius) { return service.search(id,query,day,latitude,longitude,radius); }
    @PostMapping("/rides") @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    RideView offer(@AuthenticationPrincipal Long id,@Valid @RequestBody RideInput input) { return service.offer(id,input); }
    @GetMapping("/rides/{rideId}") Group group(@AuthenticationPrincipal Long id,@PathVariable Long rideId) { return service.group(id,rideId); }
    @PostMapping("/rides/{rideId}/requests") ParticipationView join(@AuthenticationPrincipal Long id,@PathVariable Long rideId,@Valid @RequestBody Join input) { return service.join(id,rideId,input); }
    @PatchMapping("/rides/{rideId}/requests/{requestId}") ParticipationView decide(@AuthenticationPrincipal Long id,@PathVariable Long rideId,@PathVariable Long requestId,@Valid @RequestBody Decision input) { return service.decide(id,rideId,requestId,input); }
    @DeleteMapping("/rides/{rideId}/membership") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    void leave(@AuthenticationPrincipal Long id,@PathVariable Long rideId) { service.leave(id,rideId); }
    @DeleteMapping("/rides/{rideId}/participants/{requestId}") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    void remove(@AuthenticationPrincipal Long id,@PathVariable Long rideId,@PathVariable Long requestId) { service.remove(id,rideId,requestId); }
    @DeleteMapping("/rides/{rideId}") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    void cancel(@AuthenticationPrincipal Long id,@PathVariable Long rideId) { service.cancel(id,rideId); }
    @GetMapping("/rh/vehicles") List<VehicleView> queue(@AuthenticationPrincipal Long id) { return service.reviewQueue(id); }
    @PatchMapping("/rh/vehicles/{vehicleId}") VehicleView review(@AuthenticationPrincipal Long id,@PathVariable Long vehicleId,@Valid @RequestBody Review input) { return service.review(id,vehicleId,input); }
    @GetMapping("/rh/members") List<Person> members(@AuthenticationPrincipal Long id) { return service.accounts(id,Role.MEMBER); }
    @PostMapping("/rh/members") InviteResult invite(@AuthenticationPrincipal Long id,@Valid @RequestBody Invitation input) { return service.invite(id,input); }
    @PostMapping("/rh/members/{memberId}/invitation") InviteResult renew(@AuthenticationPrincipal Long id,@PathVariable Long memberId) { return service.renewInvite(id,memberId); }
    @PatchMapping("/rh/members/{memberId}") Person updateMember(@AuthenticationPrincipal Long id,@PathVariable Long memberId,@Valid @RequestBody AccountUpdate input) { return service.updateAccount(id,memberId,Role.MEMBER,input); }
    @GetMapping("/rh/groups") List<RideView> groups(@AuthenticationPrincipal Long id) { return service.groups(id); }
    @GetMapping("/admin/rh") List<Person> rh(@AuthenticationPrincipal Long id) { return service.accounts(id,Role.RH); }
    @PostMapping("/admin/rh") Person createRh(@AuthenticationPrincipal Long id,@Valid @RequestBody RhInput input) { return service.createRh(id,input); }
    @PatchMapping("/admin/rh/{rhId}") Person updateRh(@AuthenticationPrincipal Long id,@PathVariable Long rhId,@Valid @RequestBody AccountUpdate input) { return service.updateAccount(id,rhId,Role.RH,input); }
}
