package com.pqrs.microservice.domain.enums;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Arrays;

public enum PqrsType {
    PETICION(15),
    QUEJA(5),
    RECLAMO(5),
    SUGERENCIA(10);

    private final int maximumAnswerDays;

    PqrsType(int maximumAnswerDays) {
        this.maximumAnswerDays = maximumAnswerDays;
    }

    public int maximumAnswerDays() {
        return maximumAnswerDays;
    }

    @JsonCreator
    public static PqrsType fromValue(String value) {
        if (value == null) {
            return null;
        }
        return Arrays.stream(values())
                .filter(type -> type.name().equalsIgnoreCase(value.trim()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Tipo de PQRS inválido: " + value +
                        ". Valores permitidos: " + Arrays.toString(values())));
    }

    @JsonValue
    public String toValue() {
        return name();
    }
}
