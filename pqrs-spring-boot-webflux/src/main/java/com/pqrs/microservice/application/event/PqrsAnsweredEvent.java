package com.pqrs.microservice.application.event;

import java.time.LocalDate;

public record PqrsAnsweredEvent(
        String reference,
        String citizenEmail,
        String answerContent,
        String authorName,
        LocalDate answerDate
) {
}
