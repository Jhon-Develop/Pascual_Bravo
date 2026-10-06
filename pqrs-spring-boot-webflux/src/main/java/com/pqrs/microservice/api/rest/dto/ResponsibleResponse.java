package com.pqrs.microservice.api.rest.dto;

import com.pqrs.microservice.domain.enums.ResponsibleRole;

public record ResponsibleResponse(
        String document,
        String name,
        String email,
        String area,
        ResponsibleRole role
) {
}
