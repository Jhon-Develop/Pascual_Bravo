package com.pqrs.microservice.application.event;

public record PqrsAssignedEvent(
        String reference,
        String responsibleName,
        String responsibleEmail,
        String citizenEmail
) {
}
