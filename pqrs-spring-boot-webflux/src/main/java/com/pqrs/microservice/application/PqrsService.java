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
import com.pqrs.microservice.domain.enums.PqrsState;
import com.pqrs.microservice.domain.exception.PqrsNotFoundException;
import com.pqrs.microservice.domain.exception.ResponsibleNotFoundException;
import com.pqrs.microservice.infrastructure.persistence.entity.AnswerEntity;
import com.pqrs.microservice.infrastructure.persistence.entity.CitizenEntity;
import com.pqrs.microservice.infrastructure.persistence.entity.PqrsEntity;
import com.pqrs.microservice.infrastructure.persistence.entity.ResponsibleEntity;
import com.pqrs.microservice.infrastructure.persistence.repository.AnswerRepository;
import com.pqrs.microservice.infrastructure.persistence.repository.CitizenRepository;
import com.pqrs.microservice.infrastructure.persistence.repository.PqrsRepository;
import com.pqrs.microservice.infrastructure.persistence.repository.ResponsibleRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.reactive.TransactionalEventPublisher;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

@Service
public class PqrsService {

    private final PqrsRepository pqrsRepository;
    private final CitizenRepository citizenRepository;
    private final ResponsibleRepository responsibleRepository;
    private final AnswerRepository answerRepository;
    private final TransactionalEventPublisher eventPublisher;

    public PqrsService(
            PqrsRepository pqrsRepository,
            CitizenRepository citizenRepository,
            ResponsibleRepository responsibleRepository,
            AnswerRepository answerRepository,
            TransactionalEventPublisher eventPublisher
    ) {
        this.pqrsRepository = pqrsRepository;
        this.citizenRepository = citizenRepository;
        this.responsibleRepository = responsibleRepository;
        this.answerRepository = answerRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public Mono<PqrsResponse> create(CreatePqrsRequest request) {
        return findOrCreateCitizen(request)
                .flatMap(citizen -> pqrsRepository.save(new PqrsEntity(
                        request.type(),
                        request.description().trim(),
                        LocalDate.now(),
                        citizen
                )))
                .flatMap(pqrs -> {
                    pqrs.setReference(String.format(
                            "RAD-%d-%04d",
                            LocalDate.now().getYear(),
                            pqrs.getId()
                    ));
                    return pqrsRepository.save(pqrs);
                })
                .flatMap(pqrs -> hydrate(pqrs)
                        .flatMap(response -> eventPublisher.publishEvent(new PqrsCreatedEvent(
                                response.reference(),
                                response.type(),
                                response.description(),
                                response.citizen().email(),
                                response.limitedDate()
                        )).thenReturn(response)));
    }

    @Transactional(readOnly = true)
    public Mono<PqrsResponse> findByReference(String reference) {
        return getEntity(reference).flatMap(this::hydrate);
    }

    public Flux<PqrsResponse> findAll() {
        return pqrsRepository.findAllByOrderByIdDesc()
                .flatMapSequential(this::hydrate, 8);
    }

    @Transactional
    public Mono<PqrsResponse> assignResponsible(
            String reference,
            AssignResponsibleRequest request
    ) {
        return Mono.zip(
                        getEntity(reference),
                        responsibleRepository.findByDocument(request.responsibleDocument())
                                .switchIfEmpty(Mono.error(new ResponsibleNotFoundException(request.responsibleDocument())))
                )
                .flatMap(tuple -> {
                    PqrsEntity pqrs = tuple.getT1();
                    ResponsibleEntity responsible = tuple.getT2();
                    pqrs.assignResponsible(responsible);
                    return pqrsRepository.save(pqrs)
                            .flatMap(saved -> hydrate(saved)
                                    .flatMap(response -> eventPublisher.publishEvent(new PqrsAssignedEvent(
                                            response.reference(),
                                            responsible.getName(),
                                            responsible.getEmail(),
                                            response.citizen().email()
                                    )).thenReturn(response)));
                });
    }

    @Transactional
    public Mono<PqrsResponse> passToManagement(String reference) {
        return getEntity(reference)
                .flatMap(pqrs -> {
                    pqrs.passToManagement();
                    return pqrsRepository.save(pqrs);
                })
                .flatMap(this::hydrate);
    }

    @Transactional
    public Mono<PqrsResponse> recordAnswer(String reference, AnswerRequest request) {
        return Mono.zip(
                        getEntity(reference),
                        responsibleRepository.findByDocument(request.authorDocument())
                                .switchIfEmpty(Mono.error(new ResponsibleNotFoundException(request.authorDocument())))
                )
                .flatMap(tuple -> {
                    PqrsEntity pqrs = tuple.getT1();
                    ResponsibleEntity author = tuple.getT2();
                    AnswerEntity answer = new AnswerEntity(
                            request.content().trim(),
                            LocalDate.now(),
                            author
                    );
                    return answerRepository.save(answer)
                            .flatMap(savedAnswer -> {
                                savedAnswer.attachAuthor(author);
                                pqrs.recordAnswer(savedAnswer);
                                return pqrsRepository.save(pqrs)
                                        .flatMap(this::hydrate)
                                        .flatMap(response -> eventPublisher.publishEvent(new PqrsAnsweredEvent(
                                                response.reference(),
                                                response.citizen().email(),
                                                savedAnswer.getContent(),
                                                author.getName(),
                                                savedAnswer.getAnswerDate()
                                        )).thenReturn(response));
                            });
                });
    }

    @Transactional
    public Mono<PqrsResponse> closeCase(String reference) {
        return getEntity(reference)
                .flatMap(pqrs -> {
                    pqrs.closeCase();
                    return pqrsRepository.save(pqrs);
                })
                .flatMap(this::hydrate);
    }

    public Flux<AlertResponse> getExpiredAlerts() {
        LocalDate today = LocalDate.now();
        return pqrsRepository
                .findAllByStateNotAndLimitedDateBefore(PqrsState.CERRADA, today)
                .flatMap(pqrs -> {
                    Mono<Optional<ResponsibleEntity>> responsible = pqrs.getResponsibleId() == null
                            ? Mono.just(Optional.empty())
                            : responsibleRepository.findById(pqrs.getResponsibleId())
                            .map(Optional::of)
                            .defaultIfEmpty(Optional.empty());

                    return responsible.map(value -> new AlertResponse(
                            pqrs.getReference(),
                            pqrs.getType(),
                            pqrs.getState(),
                            pqrs.getLimitedDate(),
                            ChronoUnit.DAYS.between(pqrs.getLimitedDate(), today),
                            value.map(ResponsibleEntity::getArea).orElse("N/A"),
                            value.map(ResponsibleEntity::getName).orElse("SIN ASIGNAR")
                    ));
                });
    }

    @Transactional
    public Mono<ResponsibleResponse> createOrUpdateResponsible(ResponsibleRequest request) {
        return responsibleRepository.findByDocument(request.document())
                .flatMap(existing -> {
                    existing.updateFrom(
                            request.name(),
                            request.email(),
                            request.area(),
                            request.role()
                    );
                    return responsibleRepository.save(existing);
                })
                .switchIfEmpty(Mono.defer(() -> responsibleRepository.save(new ResponsibleEntity(
                        request.document(),
                        request.name(),
                        request.email(),
                        request.area(),
                        request.role()
                ))))
                .map(this::toResponsibleResponse);
    }

    public Flux<ResponsibleResponse> findAllResponsibles() {
        return responsibleRepository.findAll()
                .sort((a, b) -> a.getName().compareToIgnoreCase(b.getName()))
                .map(this::toResponsibleResponse);
    }

    private Mono<CitizenEntity> findOrCreateCitizen(CreatePqrsRequest request) {
        return citizenRepository.findByDocument(request.citizen().document())
                .flatMap(existing -> {
                    existing.updateFrom(
                            request.citizen().name(),
                            request.citizen().email(),
                            request.citizen().phone()
                    );
                    return citizenRepository.save(existing);
                })
                .switchIfEmpty(Mono.defer(() -> citizenRepository.save(new CitizenEntity(
                        request.citizen().document(),
                        request.citizen().name(),
                        request.citizen().email(),
                        request.citizen().phone()
                ))));
    }

    private Mono<PqrsEntity> getEntity(String reference) {
        return pqrsRepository.findByReferenceIgnoreCase(reference.trim())
                .switchIfEmpty(Mono.error(new PqrsNotFoundException(reference)));
    }

    private Mono<PqrsResponse> hydrate(PqrsEntity pqrs) {
        Mono<CitizenEntity> citizenMono = citizenRepository.findById(pqrs.getCitizenId());
        Mono<Optional<ResponsibleEntity>> responsibleMono = optionalResponsible(pqrs.getResponsibleId());
        Mono<Optional<AnswerEntity>> answerMono = optionalAnswer(pqrs.getAnswerId());

        return Mono.zip(citizenMono, responsibleMono, answerMono)
                .map(tuple -> {
                    CitizenEntity citizen = tuple.getT1();
                    Optional<ResponsibleEntity> responsible = tuple.getT2();
                    Optional<AnswerEntity> answer = tuple.getT3();

                    pqrs.attachCitizen(citizen);
                    pqrs.attachResponsible(responsible.orElse(null));
                    if (answer.isPresent()) {
                        AnswerEntity a = answer.get();
                        ResponsibleEntity author = a.getAuthor();
                        if (author != null) {
                            a.attachAuthor(author);
                        }
                        pqrs.attachAnswer(a);
                    }

                    return toResponse(pqrs);
                });
    }

    private Mono<Optional<ResponsibleEntity>> optionalResponsible(Long id) {
        if (id == null) {
            return Mono.just(Optional.empty());
        }
        return responsibleRepository.findById(id)
                .map(Optional::of)
                .defaultIfEmpty(Optional.empty());
    }

    private Mono<Optional<AnswerEntity>> optionalAnswer(Long id) {
        if (id == null) {
            return Mono.just(Optional.empty());
        }
        return answerRepository.findById(id)
                .flatMap(answer -> responsibleRepository.findById(answer.getAuthorId())
                        .map(author -> {
                            answer.attachAuthor(author);
                            return answer;
                        })
                        .defaultIfEmpty(answer))
                .map(Optional::of)
                .defaultIfEmpty(Optional.empty());
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
