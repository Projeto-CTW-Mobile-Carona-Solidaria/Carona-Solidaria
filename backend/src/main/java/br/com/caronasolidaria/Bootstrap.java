package br.com.caronasolidaria;
import br.com.caronasolidaria.Domain.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.util.Locale;
@Component
class Bootstrap implements CommandLineRunner {
    private final Members members; private final AuthService auth; private final String email,password;
    Bootstrap(Members members,AuthService auth,@Value("${app.bootstrap.email}") String email,@Value("${app.bootstrap.password}") String password) {
        this.members=members; this.auth=auth; this.email=email; this.password=password;
    }
    @Override @Transactional public void run(String... args) {
        if (members.findAll().stream().anyMatch(m -> m.role==Role.ADMIN)) return;
        if (email.isBlank() || !email.contains("@") || password.isBlank()) throw new IllegalStateException("Defina ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 10 caracteres) na primeira execução.");
        Member m=new Member(); m.name="Administrador"; m.email=email.trim().toLowerCase(Locale.ROOT);
        m.employeeId="SYSTEM-ADMIN"; m.role=Role.ADMIN; m.passwordHash=auth.encode(password); members.save(m);
    }
}
