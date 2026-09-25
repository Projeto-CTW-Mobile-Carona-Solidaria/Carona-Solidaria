package br.com.caronasolidaria;
import br.com.caronasolidaria.Domain.*;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;

interface Members extends JpaRepository<Member, Long> {
    Optional<Member> findByEmailIgnoreCase(String email);
    boolean existsByEmployeeId(String employeeId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Member m where lower(m.email) = lower(:email)")
    Optional<Member> lockEmail(@Param("email") String email);
}
interface Vehicles extends JpaRepository<Vehicle, Long> {
    Optional<Vehicle> findByOwnerId(Long ownerId);
    boolean existsByPlateAndIdNot(String plate, Long id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select v from Vehicle v where v.id = :id")
    Optional<Vehicle> lock(@Param("id") Long id);
}
interface Rides extends JpaRepository<Ride, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Ride r where r.id = :id")
    Optional<Ride> lock(@Param("id") Long id);
    boolean existsByVehicleIdAndActiveTrue(Long vehicleId);
}
interface Participations extends JpaRepository<Participation, Long> {
    List<Participation> findByRideId(Long rideId);
    List<Participation> findByPassengerId(Long passengerId);
    Optional<Participation> findByRideIdAndPassengerId(Long rideId, Long passengerId);
    long countByRideIdAndStatus(Long rideId, RequestStatus status);
}
interface Sessions extends JpaRepository<Session, String> {
    void deleteByMemberId(Long memberId);
}
