package com.pqrs.microservice.api.rest.dto;

import com.pqrs.microservice.domain.enums.PqrsType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreatePqrsRequest(
        @NotNull(message = "El tipo de PQRS es obligatorio")
        PqrsType type,

        @NotBlank(message = "La descripción es obligatoria")
        @Size(max = 5000, message = "La descripción no puede superar 5000 caracteres")
        String description,

        @NotNull(message = "La información del ciudadano es obligatoria")
        @Valid
        CitizenRequest citizen
) {
}
