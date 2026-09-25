package br.com.caronasolidaria;

import br.com.caronasolidaria.Domain.Member;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.context.annotation.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.*;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.List;

@Configuration
class SecurityConfig {
    @Bean static PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }
    @Bean SecurityFilterChain security(HttpSecurity http, AuthService auth,
        @Value("${app.cors.origins}") String origins) throws Exception {
        CorsConfiguration cors = new CorsConfiguration();
        cors.setAllowedOrigins(List.of(origins.split(",")));
        cors.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cors.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource(); source.registerCorsConfiguration("/api/**", cors);
        return http.cors(c -> c.configurationSource(source))
            .csrf(c -> c.disable()) // Bearer tokens only; no cookie-based authentication.
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a
                .requestMatchers("/api/auth/login", "/api/auth/register", "/api/health").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/rh/**").hasAnyRole("RH", "ADMIN")
                .requestMatchers("/api/**").authenticated().anyRequest().denyAll())
            .exceptionHandling(e -> e.authenticationEntryPoint((req, res, ex) -> error(res, 401, "Sua sessão expirou. Entre novamente."))
                .accessDeniedHandler((req, res, ex) -> error(res, 403, "Você não tem permissão para esta operação.")))
            .addFilterBefore(new OncePerRequestFilter() {
                @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
                    String header = request.getHeader("Authorization");
                    if (header != null && header.startsWith("Bearer ") && header.length() < 200) {
                        Member m = auth.authenticate(header.substring(7));
                        if (m != null) SecurityContextHolder.getContext().setAuthentication(
                            new UsernamePasswordAuthenticationToken(m.id, null, List.of(new SimpleGrantedAuthority("ROLE_" + m.role))));
                    }
                    chain.doFilter(request, response);
                }
            }, UsernamePasswordAuthenticationFilter.class).build();
    }
    private static void error(HttpServletResponse res, int status, String message) throws IOException {
        res.setStatus(status); res.setContentType("application/json;charset=UTF-8");
        res.getWriter().write("{\"message\":\"" + message + "\"}");
    }
}
