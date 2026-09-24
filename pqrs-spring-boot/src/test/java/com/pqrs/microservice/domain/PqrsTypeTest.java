package com.pqrs.microservice.domain;

import com.pqrs.microservice.domain.enums.PqrsType;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PqrsTypeTest {

    @Test
    void shouldHaveExpectedDeadlines() {
        assertEquals(15, PqrsType.PETICION.maximumAnswerDays());
        assertEquals(5, PqrsType.QUEJA.maximumAnswerDays());
        assertEquals(5, PqrsType.RECLAMO.maximumAnswerDays());
        assertEquals(10, PqrsType.SUGERENCIA.maximumAnswerDays());
    }
}
