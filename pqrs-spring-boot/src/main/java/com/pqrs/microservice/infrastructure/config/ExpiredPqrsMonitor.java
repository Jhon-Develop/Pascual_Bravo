package com.pqrs.microservice.infrastructure.config;

import com.pqrs.microservice.application.PqrsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ExpiredPqrsMonitor {

    private static final Logger log = LoggerFactory.getLogger(ExpiredPqrsMonitor.class);
    private final PqrsService service;

    public ExpiredPqrsMonitor(PqrsService service) {
        this.service = service;
    }

    @Scheduled(cron = "${pqrs.monitor.cron:0 0 * * * *}")
    public void logExpiredCases() {
        var alerts = service.getExpiredAlerts();
        if (!alerts.isEmpty()) {
            log.warn("Se detectaron {} PQRS vencidas.", alerts.size());
        }
    }
}
