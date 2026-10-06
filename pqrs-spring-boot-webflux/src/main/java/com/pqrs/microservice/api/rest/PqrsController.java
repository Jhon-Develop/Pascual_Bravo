package com.pqrs.microservice.api.rest;

import com.pqrs.microservice.api.rest.dto.AlertResponse;
import com.pqrs.microservice.api.rest.dto.AnswerRequest;
import com.pqrs.microservice.api.rest.dto.AssignResponsibleRequest;
import com.pqrs.microservice.api.rest.dto.CreatePqrsRequest;
import com.pqrs.microservice.api.rest.dto.PqrsResponse;
import com.pqrs.microservice.application.PqrsService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/pqrs")
public class PqrsController {

    private final PqrsService service;

    public PqrsController(PqrsService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<PqrsResponse> create(@Valid @RequestBody Mono<CreatePqrsRequest> request) {
        return request.flatMap(service::create);
    }

    @GetMapping
    public Flux<PqrsResponse> findAll() {
        return service.findAll();
    }

    @GetMapping("/{reference}")
    public Mono<PqrsResponse> findByReference(@PathVariable String reference) {
        return service.findByReference(reference);
    }

    @PostMapping("/{reference}/assignment")
    public Mono<PqrsResponse> assignResponsible(
            @PathVariable String reference,
            @Valid @RequestBody Mono<AssignResponsibleRequest> request
    ) {
        return request.flatMap(body -> service.assignResponsible(reference, body));
    }

    @PostMapping("/{reference}/management")
    public Mono<PqrsResponse> passToManagement(@PathVariable String reference) {
        return service.passToManagement(reference);
    }

    @PostMapping("/{reference}/answer")
    public Mono<PqrsResponse> recordAnswer(
            @PathVariable String reference,
            @Valid @RequestBody Mono<AnswerRequest> request
    ) {
        return request.flatMap(body -> service.recordAnswer(reference, body));
    }

    @PostMapping("/{reference}/close")
    public Mono<PqrsResponse> closeCase(@PathVariable String reference) {
        return service.closeCase(reference);
    }

    @GetMapping("/alerts/expired")
    public Flux<AlertResponse> getExpiredAlerts() {
        return service.getExpiredAlerts();
    }
}
