package com.pqrs.microservice.api.rest.dto;

import com.pqrs.microservice.domain.enums.PqrsState;
import com.pqrs.microservice.domain.enums.PqrsType;

import java.time.LocalDate;

public record PqrsResponse(
        String reference,
        PqrsType type,
        int maximumAnswerDays,
        String description,
        PqrsState state,
        LocalDate createdDate,
        LocalDate limitedDate,
        CitizenResponse citizen,
        ResponsibleResponse responsible,
        AnswerResponse answer
) {
}
