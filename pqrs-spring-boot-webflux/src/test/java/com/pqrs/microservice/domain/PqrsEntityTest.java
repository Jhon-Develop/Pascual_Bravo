package com.pqrs.microservice.domain;

import com.pqrs.microservice.domain.enums.PqrsState;
import com.pqrs.microservice.domain.enums.PqrsType;
import com.pqrs.microservice.domain.exception.BusinessRuleException;
import com.pqrs.microservice.infrastructure.persistence.entity.AnswerEntity;
import com.pqrs.microservice.infrastructure.persistence.entity.CitizenEntity;
import com.pqrs.microservice.infrastructure.persistence.entity.PqrsEntity;
import com.pqrs.microservice.infrastructure.persistence.entity.ResponsibleEntity;
import com.pqrs.microservice.domain.enums.ResponsibleRole;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PqrsEntityTest {

    private final CitizenEntity citizen = new CitizenEntity(
            "101823948",
            "Carlos Mendoza",
            "carlos@gmail.com",
            "3001234567"
    );

    private final ResponsibleEntity responsible = new ResponsibleEntity(
            "987654321",
            "Ana Gomez",
            "ana.gomez@empresa.com",
            "Soporte Tecnico",
            ResponsibleRole.ANALISTA
    );

    @Test
    void shouldCalculateDeadlineFromType() {
        PqrsEntity pqrs = new PqrsEntity(
                PqrsType.SUGERENCIA,
                "Una sugerencia válida",
                LocalDate.of(2026, 9, 1),
                citizen
        );

        assertEquals(LocalDate.of(2026, 9, 11), pqrs.getLimitedDate());
        assertEquals(PqrsState.RADICADA, pqrs.getState());
    }

    @Test
    void shouldNotPassToManagementWithoutResponsible() {
        PqrsEntity pqrs = new PqrsEntity(
                PqrsType.RECLAMO,
                "Un reclamo válido",
                LocalDate.now(),
                citizen
        );

        assertThrows(BusinessRuleException.class, pqrs::passToManagement);
    }

    @Test
    void shouldNotCloseWithoutAnswer() {
        PqrsEntity pqrs = new PqrsEntity(
                PqrsType.QUEJA,
                "Una queja válida",
                LocalDate.now(),
                citizen
        );

        ReflectionTestUtils.setField(responsible, "id", 1L);
        pqrs.assignResponsible(responsible);
        pqrs.passToManagement();

        assertThrows(BusinessRuleException.class, pqrs::closeCase);
    }

    @Test
    void shouldCompleteFullLifecycle() {
        PqrsEntity pqrs = new PqrsEntity(
                PqrsType.PETICION,
                "Una petición válida",
                LocalDate.now(),
                citizen
        );

        ReflectionTestUtils.setField(responsible, "id", 1L);
        pqrs.assignResponsible(responsible);
        pqrs.passToManagement();

        AnswerEntity answer = new AnswerEntity("Respuesta", LocalDate.now(), responsible);
        ReflectionTestUtils.setField(answer, "id", 1L);
        pqrs.recordAnswer(answer);
        pqrs.closeCase();

        assertEquals(PqrsState.CERRADA, pqrs.getState());
    }
}
