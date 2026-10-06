package com.pqrs.microservice.api.rest.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AssignResponsibleRequest(
        @NotBlank(message = "El documento del responsable es obligatorio")
        @Size(max = 30, message = "El documento no puede superar 30 caracteres")
        String responsibleDocument
) {
}
