package br.com.caronasolidaria;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
class ObservabilitySecurityConfig {
    @Bean
    @Order(1)
    SecurityFilterChain observabilitySecurity(HttpSecurity http,
            @Value("${app.observability.metrics-token}") String token) throws Exception {
        byte[] expected = ("Bearer " + token).getBytes(StandardCharsets.UTF_8);
        return http.securityMatcher("/actuator", "/actuator/**")
            .csrf(csrf -> csrf.disable())
            .requestCache(cache -> cache.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(requests -> requests
                .requestMatchers(HttpMethod.GET, "/actuator/prometheus").access((authentication, context) -> {
                    String header = context.getRequest().getHeader("Authorization");
                    boolean allowed = !token.isBlank() && header != null && header.length() <= 512
                        && MessageDigest.isEqual(expected, header.getBytes(StandardCharsets.UTF_8));
                    return new AuthorizationDecision(allowed);
                })
                .anyRequest().denyAll())
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((request, response, exception) -> response.setStatus(401))
                .accessDeniedHandler((request, response, exception) -> response.setStatus(403)))
            .build();
    }
}
