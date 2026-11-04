package br.com.caronasolidaria;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerMapping;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
class RequestLoggingFilter extends OncePerRequestFilter {
    private static final Logger LOG = LoggerFactory.getLogger(RequestLoggingFilter.class);

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith(request.getContextPath() + "/api/")
            || request.getRequestURI().equals(request.getContextPath() + "/api/health");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long start = System.nanoTime();
        String requestId = UUID.randomUUID().toString();
        response.setHeader("X-Request-ID", requestId);
        boolean failed = true;
        try (var ignored = MDC.putCloseable("requestId", requestId)) {
            try {
                chain.doFilter(request, response);
                failed = false;
            } finally {
                int status = failed ? 500 : response.getStatus();
                Object pattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
                // Never record raw paths, queries, bodies, credentials or member identifiers.
                var event = status >= 500 ? LOG.atError() : status >= 400 ? LOG.atWarn() : LOG.atInfo();
                event.addKeyValue("http.request.method", request.getMethod())
                    .addKeyValue("http.route", pattern == null ? "UNMATCHED" : pattern.toString())
                    .addKeyValue("http.response.status_code", status)
                    .addKeyValue("duration_ms", (System.nanoTime() - start) / 1_000_000.0)
                    .log("HTTP request completed");
            }
        }
    }
}
