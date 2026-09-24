package com.pqrs.microservice.infrastructure.config;

import com.pqrs.microservice.domain.enums.ResponsibleRole;
import com.pqrs.microservice.infrastructure.persistence.entity.ResponsibleEntity;
import com.pqrs.microservice.infrastructure.persistence.repository.ResponsibleRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true")
public class DataInitializer {

    @Bean
    CommandLineRunner seedResponsibles(ResponsibleRepository repository) {
        return args -> {
            createIfMissing(repository,
                    "987654321",
                    "Ana Gomez",
                    "ana.gomez@empresa.com",
                    "Soporte Tecnico",
                    ResponsibleRole.ANALISTA);

            createIfMissing(repository,
                    "112233445",
                    "Roberto Silva",
                    "roberto.silva@empresa.com",
                    "Soporte Tecnico",
                    ResponsibleRole.SUPERVISOR);
        };
    }

    private void createIfMissing(
            ResponsibleRepository repository,
            String document,
            String name,
            String email,
            String area,
            ResponsibleRole role
    ) {
        if (repository.findByDocument(document).isEmpty()) {
            repository.save(new ResponsibleEntity(document, name, email, area, role));
        }
    }
}
