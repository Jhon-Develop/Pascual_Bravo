package com.pqrs.microservice.infrastructure.persistence.repository;

import com.pqrs.microservice.infrastructure.persistence.entity.CitizenEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CitizenRepository extends JpaRepository<CitizenEntity, Long> {
    Optional<CitizenEntity> findByDocument(String document);
}
