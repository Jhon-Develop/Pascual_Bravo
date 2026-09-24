package com.pqrs.microservice.api.rest.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AnswerRequest(
        @NotBlank(message = "El contenido de la respuesta es obligatorio")
        @Size(max = 5000, message = "La respuesta no puede superar 5000 caracteres")
        String content,

        @NotBlank(message = "El documento del autor es obligatorio")
        @Size(max = 30, message = "El documento no puede superar 30 caracteres")
        String authorDocument
) {
}
