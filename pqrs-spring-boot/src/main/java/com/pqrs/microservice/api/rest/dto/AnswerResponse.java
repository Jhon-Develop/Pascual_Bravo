package com.pqrs.microservice.api.rest.dto;

import java.time.LocalDate;

public record AnswerResponse(
        String content,
        LocalDate answerDate,
        ResponsibleResponse author
) {
}
