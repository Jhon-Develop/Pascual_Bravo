package com.pqrs.microservice.infrastructure.persistence.repository;

import com.pqrs.microservice.infrastructure.persistence.entity.CitizenEntity;
import org.springframework.data.r2dbc.repository.R2dbcRepository;
import reactor.core.publisher.Mono;

public interface CitizenRepository extends R2dbcRepository<CitizenEntity, Long> {
    Mono<CitizenEntity> findByDocument(String document);
}
