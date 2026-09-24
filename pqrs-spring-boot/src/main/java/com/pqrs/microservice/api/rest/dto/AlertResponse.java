package com.pqrs.microservice.api.rest.dto;

import com.pqrs.microservice.domain.enums.PqrsState;
import com.pqrs.microservice.domain.enums.PqrsType;

import java.time.LocalDate;

public record AlertResponse(
        String reference,
        PqrsType type,
        PqrsState state,
        LocalDate limitedDate,
        long daysOverdue,
        String area,
        String responsibleName
) {
}
