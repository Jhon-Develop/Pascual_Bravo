package com.pqrs.microservice.infrastructure.persistence.repository;

import com.pqrs.microservice.domain.enums.PqrsState;
import com.pqrs.microservice.infrastructure.persistence.entity.PqrsEntity;
import org.springframework.data.r2dbc.repository.R2dbcRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDate;

public interface PqrsRepository extends R2dbcRepository<PqrsEntity, Long> {
    Mono<PqrsEntity> findByReferenceIgnoreCase(String reference);
    Flux<PqrsEntity> findAllByStateNotAndLimitedDateBefore(PqrsState state, LocalDate date);
    Flux<PqrsEntity> findAllByOrderByIdDesc();
    Mono<Boolean> existsByReference(String reference);
}
