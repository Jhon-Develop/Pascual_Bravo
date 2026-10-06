package com.pqrs.microservice.infrastructure.persistence.repository;

import com.pqrs.microservice.infrastructure.persistence.entity.AnswerEntity;
import org.springframework.data.r2dbc.repository.R2dbcRepository;

public interface AnswerRepository extends R2dbcRepository<AnswerEntity, Long> {
}
