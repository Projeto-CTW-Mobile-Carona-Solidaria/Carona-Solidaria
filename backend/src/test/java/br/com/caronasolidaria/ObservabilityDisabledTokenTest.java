package br.com.caronasolidaria;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:observability-disabled;DB_CLOSE_DELAY=-1",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "app.bootstrap.email=metrics-admin@test.local", "app.bootstrap.password=testing-password-123", "app.observability.metrics-token="
})
@AutoConfigureMockMvc
class ObservabilityDisabledTokenTest {
    @Autowired MockMvc mvc;

    @Test void blankTokenKeepsMetricsClosed() throws Exception {
        mvc.perform(get("/actuator/prometheus")).andExpect(status().isUnauthorized());
        mvc.perform(get("/actuator/prometheus").header("Authorization", "Bearer "))
            .andExpect(status().isUnauthorized());
    }
}
