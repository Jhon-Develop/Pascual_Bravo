package com.pqrs.microservice.application.event;

import com.pqrs.microservice.domain.enums.PqrsType;

import java.time.LocalDate;

public record PqrsCreatedEvent(
        String reference,
        PqrsType type,
        String description,
        String recipientEmail,
        LocalDate limitedDate
) {
}
