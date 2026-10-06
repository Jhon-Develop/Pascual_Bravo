package com.pqrs.microservice.infrastructure.persistence.entity;

import com.pqrs.microservice.domain.enums.PqrsState;
import com.pqrs.microservice.domain.enums.PqrsType;
import com.pqrs.microservice.domain.exception.BusinessRuleException;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.LocalDate;

@Table("pqrs")
public class PqrsEntity {

    @Id
    private Long id;

    @Column("reference")
    private String reference;

    @Column("type")
    private PqrsType type;

    @Column("description")
    private String description;

    @Column("state")
    private PqrsState state;

    @Column("created_date")
    private LocalDate createdDate;

    @Column("limited_date")
    private LocalDate limitedDate;

    @Column("citizen_id")
    private Long citizenId;

    @Column("responsible_id")
    private Long responsibleId;

    @Column("answer_id")
    private Long answerId;

    @Transient
    private CitizenEntity citizen;

    @Transient
    private ResponsibleEntity responsible;

    @Transient
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
        this.citizenId = citizen == null ? null : citizen.getId();
    }

    public void assignResponsible(ResponsibleEntity responsible) {
        if (state == PqrsState.CERRADA) {
            throw new BusinessRuleException("Una PQRS cerrada no puede ser reasignada.");
        }
        this.responsible = responsible;
        this.responsibleId = responsible == null ? null : responsible.getId();
        this.state = PqrsState.ASIGNADA;
    }

    public void passToManagement() {
        if (responsibleId == null) {
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
        if (answer == null || answer.getId() == null) {
            throw new BusinessRuleException("La respuesta no puede ser nula.");
        }
        this.answer = answer;
        this.answerId = answer.getId();
        this.state = PqrsState.RESPONDIDA;
    }

    public void closeCase() {
        if (answerId == null) {
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
    public Long getCitizenId() { return citizenId; }
    public Long getResponsibleId() { return responsibleId; }
    public Long getAnswerId() { return answerId; }
    public CitizenEntity getCitizen() { return citizen; }
    public ResponsibleEntity getResponsible() { return responsible; }
    public AnswerEntity getAnswer() { return answer; }

    public void setReference(String reference) { this.reference = reference; }
    public void attachCitizen(CitizenEntity citizen) { this.citizen = citizen; }
    public void attachResponsible(ResponsibleEntity responsible) { this.responsible = responsible; }
    public void attachAnswer(AnswerEntity answer) { this.answer = answer; }
}
