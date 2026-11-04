package br.com.caronasolidaria;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.actuate.observability.AutoConfigureObservability;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:observability-test;DB_CLOSE_DELAY=-1",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "app.bootstrap.email=metrics-admin@test.local", "app.bootstrap.password=testing-password-123",
    "app.observability.metrics-token=metrics-test-token"
})
@AutoConfigureMockMvc
@AutoConfigureObservability
class ObservabilityIntegrationTest {
    @Autowired MockMvc mvc;

    @Test void prometheusRequiresItsOwnTokenAndExportsApplicationMetrics() throws Exception {
        mvc.perform(get("/actuator/prometheus")).andExpect(status().isUnauthorized());
        mvc.perform(get("/actuator/prometheus").header("Authorization", "Bearer wrong"))
            .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/health")).andExpect(status().isOk());
        mvc.perform(get("/actuator/prometheus").header("Authorization", "Bearer metrics-test-token"))
            .andExpect(status().isOk())
            .andExpect(content().string(containsString("jvm_memory_used_bytes")))
            .andExpect(content().string(containsString("application=\"carona-solidaria\"")))
            .andExpect(content().string(containsString("http_server_requests_seconds_bucket")))
            .andExpect(content().string(containsString("hikaricp_connections")));
    }

    @Test @WithMockUser(roles = "ADMIN")
    void apiAdministratorCannotScrapeWithoutMetricsToken() throws Exception {
        mvc.perform(get("/actuator/prometheus")).andExpect(status().isForbidden());
    }

    @Test void metricsTokenDoesNotGrantApiAccessOrExposeOtherActuators() throws Exception {
        mvc.perform(get("/api/me").header("Authorization", "Bearer metrics-test-token"))
            .andExpect(status().isUnauthorized());
        for (String endpoint : new String[]{"/actuator", "/actuator/env", "/actuator/heapdump", "/actuator/health"}) {
            mvc.perform(get(endpoint).header("Authorization", "Bearer metrics-test-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().string(not(containsString("metrics-test-token"))));
        }
        mvc.perform(post("/actuator/prometheus").header("Authorization", "Bearer metrics-test-token"))
            .andExpect(status().isUnauthorized());
    }

    @Test void deniedRequestsAreLoggedWithoutRawPathQueryOrCredentials() throws Exception {
        Logger logger = (Logger) LoggerFactory.getLogger(RequestLoggingFilter.class);
        var appender = new ListAppender<ILoggingEvent>() {
            @Override protected void append(ILoggingEvent event) {
                event.prepareForDeferredProcessing();
                super.append(event);
            }
        };
        appender.start();
        logger.addAppender(appender);
        try {
            var response = mvc.perform(get("/api/rides/private-member-id")
                    .queryParam("email", "private@example.com")
                    .header("Authorization", "Bearer confidential-token")
                    .header("X-Request-ID", "untrusted-id"))
                .andExpect(status().isUnauthorized()).andReturn().getResponse();
            String requestId = response.getHeader("X-Request-ID");
            assertThat(UUID.fromString(requestId).toString()).isEqualTo(requestId);
            assertThat(appender.list).hasSize(1);
            var event = appender.list.get(0);
            Map<String, Object> fields = event.getKeyValuePairs().stream()
                .collect(Collectors.toMap(pair -> pair.key, pair -> pair.value));
            assertThat(event.getMDCPropertyMap()).containsEntry("requestId", requestId);
            assertThat(fields).containsEntry("http.route", "UNMATCHED")
                .containsEntry("http.response.status_code", 401)
                .containsEntry("http.request.method", "GET");
            assertThat((Double) fields.get("duration_ms")).isGreaterThanOrEqualTo(0);
            assertThat(fields.toString() + event.getFormattedMessage() + event.getMDCPropertyMap())
                .doesNotContain("private-member-id", "private@example.com", "confidential-token", "untrusted-id");
            assertThat(MDC.get("requestId")).isNull();
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
    }
}
