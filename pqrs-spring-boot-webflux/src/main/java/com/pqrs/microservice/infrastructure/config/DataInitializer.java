package com.pqrs.microservice.infrastructure.config;

import com.pqrs.microservice.domain.enums.ResponsibleRole;
import com.pqrs.microservice.infrastructure.persistence.entity.ResponsibleEntity;
import com.pqrs.microservice.infrastructure.persistence.repository.ResponsibleRepository;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true")
public class DataInitializer {

    @Bean
    ApplicationRunner seedResponsibles(ResponsibleRepository repository) {
        return args -> repository.findByDocument("987654321")
                .switchIfEmpty(repository.save(new ResponsibleEntity(
                        "987654321",
                        "Ana Gomez",
                        "ana.gomez@empresa.com",
                        "Soporte Tecnico",
                        ResponsibleRole.ANALISTA
                )))
                .then(repository.findByDocument("112233445"))
                .switchIfEmpty(repository.save(new ResponsibleEntity(
                        "112233445",
                        "Roberto Silva",
                        "roberto.silva@empresa.com",
                        "Soporte Tecnico",
                        ResponsibleRole.SUPERVISOR
                )))
                .block();
    }
}
