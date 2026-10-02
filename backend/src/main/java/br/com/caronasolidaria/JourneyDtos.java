package br.com.caronasolidaria;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.*;
import java.util.List;

final class JourneyDtos {
    record Stop(@NotBlank @Size(max=80) String id, Long passengerId,
        @NotNull @Pattern(regexp="origin|passenger|destination") String kind, @Min(0) @Max(9) int order,
        @NotBlank @Size(max=100) String label, @NotBlank @Size(max=300) String address,
        @DecimalMin("-90") @DecimalMax("90") double lat, @DecimalMin("-180") @DecimalMax("180") double lng) {}
    record Segment(@Min(0) @Max(8) int fromIndex, @Min(1) @Max(9) int toIndex,
        @PositiveOrZero double distance, @PositiveOrZero double duration,
        @NotNull @Size(min=2,max=10000) List<@NotNull @Size(min=2,max=2) List<@NotNull Double>> geometry) {}
    record Plan(@NotNull @Size(min=2,max=10) List<@NotNull @Valid Stop> stops,
        @NotNull @Size(min=1,max=9) List<@NotNull @Valid Segment> segments,
        @PositiveOrZero double totalDistance, @PositiveOrZero double totalDuration) {}
    record Progress(@Min(0) @Max(8) int segmentIndex, @DecimalMin("0") @DecimalMax("1") double fraction,
        @NotNull @Pattern(regexp="moving|boarding|arrived") String phase, @Min(1) @Max(9) int nextStopIndex) {}
    record State(@DecimalMin("-90") @DecimalMax("90") double lat, @DecimalMin("-180") @DecimalMax("180") double lng,
        @NotNull @Valid Progress progress, @Min(0) @Max(5) int boardingLeft) {}
    record Start(@NotNull DayOfWeek day, @NotNull @Pattern(regexp="simulator|gps") String source, @NotNull @Valid Plan plan, @NotNull @Valid State state) {}
    record Update(@Positive long sequence, @NotNull @Valid State state) {}
    record Journey(String id, DayOfWeek day, String source, Plan plan, State state, Instant updatedAt, long sequence) {}
}
