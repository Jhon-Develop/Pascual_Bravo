package com.pqrs.microservice.infrastructure.persistence.repository;

import com.pqrs.microservice.domain.enums.PqrsState;
import com.pqrs.microservice.domain.enums.PqrsType;
import com.pqrs.microservice.infrastructure.persistence.entity.PqrsEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PqrsRepository extends JpaRepository<PqrsEntity, Long> {
    Optional<PqrsEntity> findByReferenceIgnoreCase(String reference);
    List<PqrsEntity> findAllByStateNotAndLimitedDateBefore(PqrsState state, LocalDate date);
    boolean existsByReference(String reference);
}
