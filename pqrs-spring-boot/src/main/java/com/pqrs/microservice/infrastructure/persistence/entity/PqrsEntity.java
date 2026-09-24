package com.pqrs.microservice.infrastructure.persistence.entity;

import com.pqrs.microservice.domain.enums.PqrsState;
import com.pqrs.microservice.domain.enums.PqrsType;
import com.pqrs.microservice.domain.exception.BusinessRuleException;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

import java.time.LocalDate;

@Entity
@Table(name = "pqrs")
public class PqrsEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, length = 30)
    private String reference;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PqrsType type;

    @Column(nullable = false, length = 5000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PqrsState state;

    @Column(nullable = false)
    private LocalDate createdDate;

    @Column(nullable = false)
    private LocalDate limitedDate;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "citizen_id", nullable = false)
    private CitizenEntity citizen;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "responsible_id")
    private ResponsibleEntity responsible;

    @OneToOne(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JoinColumn(name = "answer_id")
    private AnswerEntity answer;

    protected PqrsEntity() {
    }

    public PqrsEntity(
            PqrsType type,
            String description,
            LocalDate createdDate,
            CitizenEntity citizen
    ) {
        this.type = type;
        this.description = description;
        this.createdDate = createdDate;
        this.limitedDate = createdDate.plusDays(type.maximumAnswerDays());
        this.state = PqrsState.RADICADA;
        this.citizen = citizen;
    }

    public void assignResponsible(ResponsibleEntity responsible) {
        if (state == PqrsState.CERRADA) {
            throw new BusinessRuleException("Una PQRS cerrada no puede ser reasignada.");
        }
        this.responsible = responsible;
        this.state = PqrsState.ASIGNADA;
    }

    public void passToManagement() {
        if (responsible == null) {
            throw new BusinessRuleException(
                    "VIOLATED BUSINESS RULE: A PQRS must be assigned to a responsible before moving to 'EN_GESTION'."
            );
        }
        if (state != PqrsState.ASIGNADA) {
            throw new BusinessRuleException(
                    "Solo una PQRS en estado ASIGNADA puede pasar a EN_GESTION."
            );
        }
        this.state = PqrsState.EN_GESTION;
    }

    public void recordAnswer(AnswerEntity answer) {
        if (state != PqrsState.EN_GESTION && state != PqrsState.ASIGNADA) {
            throw new BusinessRuleException(
                    "The PQRS must be in EN_GESTION or ASIGNADA to record an answer."
            );
        }
        if (answer == null) {
            throw new BusinessRuleException("La respuesta no puede ser nula.");
        }
        this.answer = answer;
        this.state = PqrsState.RESPONDIDA;
    }

    public void closeCase() {
        if (answer == null) {
            throw new BusinessRuleException(
                    "VIOLATED BUSINESS RULE: A PQRS cannot be closed without a recorded response."
            );
        }
        if (state != PqrsState.RESPONDIDA) {
            throw new BusinessRuleException(
                    "Solo una PQRS RESPONDIDA puede pasar a CERRADA."
            );
        }
        this.state = PqrsState.CERRADA;
    }

    public Long getId() { return id; }
    public String getReference() { return reference; }
    public PqrsType getType() { return type; }
    public String getDescription() { return description; }
    public PqrsState getState() { return state; }
    public LocalDate getCreatedDate() { return createdDate; }
    public LocalDate getLimitedDate() { return limitedDate; }
    public CitizenEntity getCitizen() { return citizen; }
    public ResponsibleEntity getResponsible() { return responsible; }
    public AnswerEntity getAnswer() { return answer; }

    public void setReference(String reference) {
        this.reference = reference;
    }
}
