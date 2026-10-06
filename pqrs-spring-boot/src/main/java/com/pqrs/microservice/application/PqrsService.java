package com.pqrs.microservice.application;

import com.pqrs.microservice.api.rest.dto.AlertResponse;
import com.pqrs.microservice.api.rest.dto.AnswerRequest;
import com.pqrs.microservice.api.rest.dto.AnswerResponse;
import com.pqrs.microservice.api.rest.dto.AssignResponsibleRequest;
import com.pqrs.microservice.api.rest.dto.CitizenResponse;
import com.pqrs.microservice.api.rest.dto.CreatePqrsRequest;
import com.pqrs.microservice.api.rest.dto.PqrsResponse;
import com.pqrs.microservice.api.rest.dto.ResponsibleRequest;
import com.pqrs.microservice.api.rest.dto.ResponsibleResponse;
import com.pqrs.microservice.application.event.PqrsAnsweredEvent;
import com.pqrs.microservice.application.event.PqrsAssignedEvent;
import com.pqrs.microservice.application.event.PqrsCreatedEvent;
import org.springframework.context.ApplicationEventPublisher;
import com.pqrs.microservice.domain.exception.PqrsNotFoundException;
import com.pqrs.microservice.domain.exception.ResponsibleNotFoundException;
import com.pqrs.microservice.infrastructure.persistence.entity.AnswerEntity;
import com.pqrs.microservice.infrastructure.persistence.entity.CitizenEntity;
import com.pqrs.microservice.infrastructure.persistence.entity.PqrsEntity;
import com.pqrs.microservice.infrastructure.persistence.entity.ResponsibleEntity;
import com.pqrs.microservice.infrastructure.persistence.repository.CitizenRepository;
import com.pqrs.microservice.infrastructure.persistence.repository.PqrsRepository;
import com.pqrs.microservice.infrastructure.persistence.repository.ResponsibleRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class PqrsService {

    private final PqrsRepository pqrsRepository;
    private final CitizenRepository citizenRepository;
    private final ResponsibleRepository responsibleRepository;
    private final ApplicationEventPublisher eventPublisher;

    public PqrsService(
            PqrsRepository pqrsRepository,
            CitizenRepository citizenRepository,
            ResponsibleRepository responsibleRepository,
            ApplicationEventPublisher eventPublisher
    ) {
        this.pqrsRepository = pqrsRepository;
        this.citizenRepository = citizenRepository;
        this.responsibleRepository = responsibleRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public PqrsResponse create(CreatePqrsRequest request) {
        CitizenEntity citizen = citizenRepository.findByDocument(request.citizen().document())
                .map(existing -> {
                    existing.updateFrom(
                            request.citizen().name(),
                            request.citizen().email(),
                            request.citizen().phone()
                    );
                    return existing;
                })
                .orElseGet(() -> citizenRepository.save(new CitizenEntity(
                        request.citizen().document(),
                        request.citizen().name(),
                        request.citizen().email(),
                        request.citizen().phone()
                )));

        PqrsEntity pqrs = pqrsRepository.save(new PqrsEntity(
                request.type(),
                request.description().trim(),
                LocalDate.now(),
                citizen
        ));

        pqrs.setReference(String.format("RAD-%d-%04d", LocalDate.now().getYear(), pqrs.getId()));
        pqrs = pqrsRepository.save(pqrs);

        PqrsResponse response = toResponse(pqrs);
        eventPublisher.publishEvent(new PqrsCreatedEvent(
                response.reference(),
                response.type(),
                response.description(),
                response.citizen().email(),
                response.limitedDate()
        ));
        return response;
    }

    @Transactional(readOnly = true)
    public PqrsResponse findByReference(String reference) {
        return toResponse(getEntity(reference));
    }

    @Transactional(readOnly = true)
    public List<PqrsResponse> findAll() {
        return pqrsRepository.findAll(Sort.by(Sort.Direction.DESC, "id"))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public PqrsResponse assignResponsible(
            String reference,
            AssignResponsibleRequest request
    ) {
        PqrsEntity pqrs = getEntity(reference);
        ResponsibleEntity responsible = responsibleRepository.findByDocument(request.responsibleDocument())
                .orElseThrow(() -> new ResponsibleNotFoundException(request.responsibleDocument()));

        pqrs.assignResponsible(responsible);
        PqrsResponse response = toResponse(pqrsRepository.save(pqrs));
        eventPublisher.publishEvent(new PqrsAssignedEvent(
                response.reference(),
                responsible.getName(),
                responsible.getEmail(),
                response.citizen().email()
        ));
        return response;
    }

    @Transactional
    public PqrsResponse passToManagement(String reference) {
        PqrsEntity pqrs = getEntity(reference);
        pqrs.passToManagement();
        return toResponse(pqrsRepository.save(pqrs));
    }

    @Transactional
    public PqrsResponse recordAnswer(String reference, AnswerRequest request) {
        PqrsEntity pqrs = getEntity(reference);
        ResponsibleEntity author = responsibleRepository.findByDocument(request.authorDocument())
                .orElseThrow(() -> new ResponsibleNotFoundException(request.authorDocument()));

        AnswerEntity answer = new AnswerEntity(
                request.content().trim(),
                LocalDate.now(),
                author
        );

        pqrs.recordAnswer(answer);
        PqrsResponse response = toResponse(pqrsRepository.save(pqrs));
        eventPublisher.publishEvent(new PqrsAnsweredEvent(
                response.reference(),
                response.citizen().email(),
                answer.getContent(),
                author.getName(),
                answer.getAnswerDate()
        ));
        return response;
    }

    @Transactional
    public PqrsResponse closeCase(String reference) {
        PqrsEntity pqrs = getEntity(reference);
        pqrs.closeCase();
        return toResponse(pqrsRepository.save(pqrs));
    }

    @Transactional(readOnly = true)
    public List<AlertResponse> getExpiredAlerts() {
        LocalDate today = LocalDate.now();
        return pqrsRepository
                .findAllByStateNotAndLimitedDateBefore(
                        com.pqrs.microservice.domain.enums.PqrsState.CERRADA,
                        today
                )
                .stream()
                .map(pqrs -> new AlertResponse(
                        pqrs.getReference(),
                        pqrs.getType(),
                        pqrs.getState(),
                        pqrs.getLimitedDate(),
                        ChronoUnit.DAYS.between(pqrs.getLimitedDate(), today),
                        pqrs.getResponsible() != null ? pqrs.getResponsible().getArea() : "N/A",
                        pqrs.getResponsible() != null ? pqrs.getResponsible().getName() : "SIN ASIGNAR"
                ))
                .toList();
    }

    @Transactional
    public ResponsibleResponse createOrUpdateResponsible(ResponsibleRequest request) {
        ResponsibleEntity responsible = responsibleRepository.findByDocument(request.document())
                .map(existing -> {
                    existing.updateFrom(
                            request.name(),
                            request.email(),
                            request.area(),
                            request.role()
                    );
                    return existing;
                })
                .orElseGet(() -> new ResponsibleEntity(
                        request.document(),
                        request.name(),
                        request.email(),
                        request.area(),
                        request.role()
                ));

        return toResponsibleResponse(responsibleRepository.save(responsible));
    }

    @Transactional(readOnly = true)
    public List<ResponsibleResponse> findAllResponsibles() {
        return responsibleRepository.findAll(Sort.by(Sort.Direction.ASC, "name"))
                .stream()
                .map(this::toResponsibleResponse)
                .toList();
    }

    private PqrsEntity getEntity(String reference) {
        return pqrsRepository.findByReferenceIgnoreCase(reference.trim())
                .orElseThrow(() -> new PqrsNotFoundException(reference));
    }

    private PqrsResponse toResponse(PqrsEntity pqrs) {
        ResponsibleResponse responsible = pqrs.getResponsible() == null
                ? null
                : toResponsibleResponse(pqrs.getResponsible());

        AnswerResponse answer = pqrs.getAnswer() == null
                ? null
                : new AnswerResponse(
                        pqrs.getAnswer().getContent(),
                        pqrs.getAnswer().getAnswerDate(),
                        toResponsibleResponse(pqrs.getAnswer().getAuthor())
                );

        CitizenResponse citizen = new CitizenResponse(
                pqrs.getCitizen().getDocument(),
                pqrs.getCitizen().getName(),
                pqrs.getCitizen().getEmail(),
                pqrs.getCitizen().getPhone()
        );

        return new PqrsResponse(
                pqrs.getReference(),
                pqrs.getType(),
                pqrs.getType().maximumAnswerDays(),
                pqrs.getDescription(),
                pqrs.getState(),
                pqrs.getCreatedDate(),
                pqrs.getLimitedDate(),
                citizen,
                responsible,
                answer
        );
    }

    private ResponsibleResponse toResponsibleResponse(ResponsibleEntity responsible) {
        return new ResponsibleResponse(
                responsible.getDocument(),
                responsible.getName(),
                responsible.getEmail(),
                responsible.getArea(),
                responsible.getRole()
        );
    }
}
