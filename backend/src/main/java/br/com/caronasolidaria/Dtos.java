package br.com.caronasolidaria;
import br.com.caronasolidaria.Domain.*;
import jakarta.validation.constraints.*;
import java.time.DayOfWeek;
import java.time.Instant;
import java.util.Set;

public final class Dtos {
    private Dtos() {}
    public record Login(@NotBlank @Email String email, @NotBlank @Size(max=72) String password) {}
    public record Registration(@NotBlank @Email String email, @NotBlank String employeeId,
        @NotBlank String invitationCode, @NotBlank @Size(min=10,max=72) String password) {}
    public record Profile(@NotBlank @Size(max=100) String name,
        @NotNull @Pattern(regexp="[0-9]{10,15}",message="Informe WhatsApp com DDI e DDD (somente números)") String whatsapp,
        @NotBlank @Size(max=120) String neighborhood, @NotNull @Size(min=1,max=7) Set<@NotNull DayOfWeek> days) {}
    public record Person(Long id, String name, String email, String employeeId, String whatsapp,
        String neighborhood, Set<DayOfWeek> days, Role role, boolean active, boolean registered) {}
    public record Auth(String token, Instant expiresAt, Person user) {}
    public record Invitation(@NotBlank @Size(max=100) String name, @NotBlank @Email String email,
        @NotBlank @Size(max=40) String employeeId) {}
    public record InviteResult(Person user, String invitationCode) {}
    public record RhInput(@NotBlank @Size(max=100) String name, @NotBlank @Email String email,
        @NotBlank @Size(max=40) String employeeId, @NotBlank @Size(min=10,max=72) String password) {}
    public record AccountUpdate(@NotBlank @Size(max=100) String name, boolean active) {}
    public record VehicleInput(@NotBlank @Pattern(regexp="[A-Za-z]{3}[- ]?[0-9][A-Za-z0-9][0-9]{2}") String plate,
        @NotBlank @Size(max=100) String model, @NotBlank @Size(max=40) String color, @Min(1) @Max(8) int seats) {}
    public record VehicleView(Long id, Long ownerId, String ownerName, String plate, String model,
        String color, int seats, VehicleStatus status, String rejectionReason, Instant submittedAt) {}
    public record Review(boolean approved, @Size(max=500) String reason) {}
    public record RideInput(@NotBlank @Size(max=150) String origin, @NotBlank @Size(max=150) String destination,
        @NotBlank @Pattern(regexp="([01][0-9]|2[0-3]):[0-5][0-9]") String departureTime,
        @Min(1) @Max(8) int capacity, @NotNull @Size(min=1,max=7) Set<@NotNull DayOfWeek> days,
        @DecimalMin("-90") @DecimalMax("90") Double latitude,
        @DecimalMin("-180") @DecimalMax("180") Double longitude) {}
    public record RideView(Long id, Long driverId, String driverName, String model, String color,
        String origin, String destination, String departureTime, int capacity, long availableSeats,
        Set<DayOfWeek> days, boolean active, Double distanceKm, boolean specialParkingEligible) {}
    public record Join(boolean relative) {}
    public record Decision(boolean accepted) {}
    public record ParticipationView(Long id, Long rideId, Long passengerId, String passengerName,
        String whatsapp, RequestStatus status, boolean relative) {}
    public record Group(RideView ride, String driverWhatsapp, String plate, java.util.List<ParticipationView> participants) {}
}
