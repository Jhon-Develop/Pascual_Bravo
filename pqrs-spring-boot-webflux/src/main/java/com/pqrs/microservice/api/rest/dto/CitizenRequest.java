package com.pqrs.microservice.api.rest.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CitizenRequest(
        @NotBlank(message = "El documento es obligatorio")
        @Size(max = 30, message = "El documento no puede superar 30 caracteres")
        String document,

        @NotBlank(message = "El nombre es obligatorio")
        @Size(max = 120, message = "El nombre no puede superar 120 caracteres")
        String name,

        @Email(message = "El correo no tiene un formato válido")
        @Size(max = 150, message = "El correo no puede superar 150 caracteres")
        String email,

        @Size(max = 30, message = "El teléfono no puede superar 30 caracteres")
        String phone
) {
}
