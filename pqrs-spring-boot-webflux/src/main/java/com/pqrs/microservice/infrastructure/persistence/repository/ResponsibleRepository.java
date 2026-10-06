package com.pqrs.microservice.infrastructure.persistence.repository;

import com.pqrs.microservice.infrastructure.persistence.entity.ResponsibleEntity;
import org.springframework.data.r2dbc.repository.R2dbcRepository;
import reactor.core.publisher.Mono;

public interface ResponsibleRepository extends R2dbcRepository<ResponsibleEntity, Long> {
    Mono<ResponsibleEntity> findByDocument(String document);
}
