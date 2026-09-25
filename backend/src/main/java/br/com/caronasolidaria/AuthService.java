package br.com.caronasolidaria;

import br.com.caronasolidaria.Domain.*;
import br.com.caronasolidaria.Dtos.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service @Transactional
class AuthService {
    private final Members members;
    private final Sessions sessions;
    private final PasswordEncoder passwords;
    private final String dummyHash;
    AuthService(Members members, Sessions sessions, PasswordEncoder passwords) {
        this.members = members; this.sessions = sessions; this.passwords = passwords;
        this.dummyHash = passwords.encode(randomToken());
    }
    static String randomToken() {
        byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }
    static Person person(Member m) {
        return new Person(m.id, m.name, m.email, m.employeeId, m.whatsapp, m.neighborhood,
            Set.copyOf(m.days), m.role, m.active, m.passwordHash != null);
    }
    Auth login(Login input) {
        Member m = members.findByEmailIgnoreCase(input.email().trim()).orElse(null);
        boolean valid = passwords.matches(input.password(), m == null || m.passwordHash == null ? dummyHash : m.passwordHash);
        if (!valid || m == null || !m.active || m.passwordHash == null)
            throw new ApiException(HttpStatus.UNAUTHORIZED, "E-mail ou senha inválidos.");
        return issue(m);
    }
    Auth register(Registration input) {
        Member m = members.lockEmail(input.email().trim()).orElseThrow(() -> ApiException.bad("Convite inválido. Consulte o RH."));
        if (!m.active || m.role != Role.MEMBER || m.passwordHash != null || !m.employeeId.equals(input.employeeId().trim())
            || m.invitationHash == null || !MessageDigest.isEqual(hash(input.invitationCode().trim()).getBytes(StandardCharsets.UTF_8), m.invitationHash.getBytes(StandardCharsets.UTF_8)))
            throw ApiException.bad("Convite inválido. Consulte o RH.");
        m.passwordHash = encode(input.password()); m.invitationHash = null;
        return issue(m);
    }
    String encode(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72 || password.length() < 10)
            throw ApiException.bad("A senha deve ter pelo menos 10 caracteres e no máximo 72 bytes.");
        return passwords.encode(password);
    }
    private Auth issue(Member m) {
        String token = randomToken(); Session s = new Session();
        s.tokenHash = hash(token); s.member = m; s.expiresAt = Instant.now().plus(12, ChronoUnit.HOURS);
        sessions.save(s); return new Auth(token, s.expiresAt, person(m));
    }
    @Transactional(readOnly = true)
    Member authenticate(String token) {
        Session s = sessions.findById(hash(token)).orElse(null);
        return s != null && s.expiresAt.isAfter(Instant.now()) && s.member.active ? s.member : null;
    }
    void logout(String token) { sessions.deleteById(hash(token)); }
}
