package com.pqrs.microservice.infrastructure.persistence.repository;

import com.pqrs.microservice.infrastructure.persistence.entity.ResponsibleEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ResponsibleRepository extends JpaRepository<ResponsibleEntity, Long> {
    Optional<ResponsibleEntity> findByDocument(String document);
}
