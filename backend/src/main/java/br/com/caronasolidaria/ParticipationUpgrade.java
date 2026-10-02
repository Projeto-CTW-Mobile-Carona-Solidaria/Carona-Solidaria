package br.com.caronasolidaria;

import br.com.caronasolidaria.Domain.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.util.HashSet;

/** Upgrade pre-existing requests without inventing an RH approval. */
@Component
class ParticipationUpgrade implements CommandLineRunner {
    private final Participations participations;
    ParticipationUpgrade(Participations participations) { this.participations=participations; }
    @Override @Transactional public void run(String... args) {
        for (Participation p:participations.findAll()) {
            if (p.days.isEmpty()) p.days=new HashSet<>(p.ride.days);
            if (p.driverApproved==null) p.driverApproved=p.status==RequestStatus.ACCEPTED;
            if (p.rhApproved==null) {
                p.rhApproved=false;
                if (p.status==RequestStatus.ACCEPTED) p.status=RequestStatus.PENDING;
            }
        }
    }
}
