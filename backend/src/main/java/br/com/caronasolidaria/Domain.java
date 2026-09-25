package br.com.caronasolidaria;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.DayOfWeek;
import java.util.HashSet;
import java.util.Set;

// Entities never cross the HTTP boundary; DTOs omit credentials.
public final class Domain {
    private Domain() {}
    public enum Role { MEMBER, RH, ADMIN }
    public enum VehicleStatus { PENDING, APPROVED, REJECTED }
    public enum RequestStatus { PENDING, ACCEPTED, REJECTED, LEFT, REMOVED }
    @Entity(name = "Member") @Table(name = "members")
    public static class Member {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
        @Column(nullable = false, unique = true) public String email;
        @Column(nullable = false, unique = true) public String employeeId;
        @Column(nullable = false) public String name;
        public String passwordHash;
        public String invitationHash;
        public String whatsapp = "";
        public String neighborhood = "";
        @Enumerated(EnumType.STRING) @Column(nullable = false) public Role role = Role.MEMBER;
        public boolean active = true;
        @ElementCollection(fetch = FetchType.EAGER) @Enumerated(EnumType.STRING)
        public Set<DayOfWeek> days = new HashSet<>();
    }
    @Entity(name = "Vehicle") @Table(name = "vehicles")
    public static class Vehicle {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
        @OneToOne(optional = false) public Member owner;
        @Column(nullable = false, unique = true) public String plate;
        @Column(nullable = false) public String model;
        public String color;
        public int seats;
        @Enumerated(EnumType.STRING) public VehicleStatus status = VehicleStatus.PENDING;
        public String rejectionReason;
        public Instant submittedAt = Instant.now();
        public Instant reviewedAt;
        @ManyToOne public Member reviewer;
    }
    @Entity(name = "Ride") @Table(name = "rides")
    public static class Ride {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
        @ManyToOne(optional = false) public Member driver;
        @ManyToOne(optional = false) public Vehicle vehicle;
        @Column(nullable = false) public String origin;
        @Column(nullable = false) public String destination;
        public String departureTime;
        public int capacity;
        public boolean active = true;
        public Double latitude;
        public Double longitude;
        @ElementCollection(fetch = FetchType.EAGER) @Enumerated(EnumType.STRING)
        public Set<DayOfWeek> days = new HashSet<>();
    }
    @Entity(name = "Participation")
    @Table(name = "participations", uniqueConstraints = @UniqueConstraint(columnNames = {"ride_id", "passenger_id"}))
    public static class Participation {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
        @ManyToOne(optional = false) public Ride ride;
        @ManyToOne(optional = false) public Member passenger;
        @Enumerated(EnumType.STRING) public RequestStatus status = RequestStatus.PENDING;
        public boolean relative;
        public Instant updatedAt = Instant.now();
    }
    @Entity(name = "Session") @Table(name = "sessions")
    public static class Session {
        @Id public String tokenHash;
        @ManyToOne(optional = false) public Member member;
        public Instant expiresAt;
    }
}
