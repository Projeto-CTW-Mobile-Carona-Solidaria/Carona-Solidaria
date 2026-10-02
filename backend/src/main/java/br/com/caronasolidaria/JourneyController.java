package br.com.caronasolidaria;

import br.com.caronasolidaria.JourneyDtos.*;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/rides/{rideId}/journey")
class JourneyController {
    private final JourneyService service;
    JourneyController(JourneyService service) { this.service=service; }
    @GetMapping Journey read(@AuthenticationPrincipal Long actor,@PathVariable Long rideId) { return service.read(actor,rideId); }
    @PostMapping Journey start(@AuthenticationPrincipal Long actor,@PathVariable Long rideId,@Valid @RequestBody Start input) { return service.start(actor,rideId,input); }
    @PutMapping("/{id}") Journey update(@AuthenticationPrincipal Long actor,@PathVariable Long rideId,@PathVariable String id,@Valid @RequestBody Update input) { return service.update(actor,rideId,id,input); }
    @DeleteMapping("/{id}") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    void stop(@AuthenticationPrincipal Long actor,@PathVariable Long rideId,@PathVariable String id) { service.stop(actor,rideId,id); }
}
