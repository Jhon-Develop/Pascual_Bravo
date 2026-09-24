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

import java.util.List;

@RestController
@RequestMapping("/api/v1/pqrs")
public class PqrsController {

    private final PqrsService service;

    public PqrsController(PqrsService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PqrsResponse create(@Valid @RequestBody CreatePqrsRequest request) {
        return service.create(request);
    }

    @GetMapping
    public List<PqrsResponse> findAll() {
        return service.findAll();
    }

    @GetMapping("/{reference}")
    public PqrsResponse findByReference(@PathVariable String reference) {
        return service.findByReference(reference);
    }

    @PostMapping("/{reference}/assignment")
    public PqrsResponse assignResponsible(
            @PathVariable String reference,
            @Valid @RequestBody AssignResponsibleRequest request
    ) {
        return service.assignResponsible(reference, request);
    }

    @PostMapping("/{reference}/management")
    public PqrsResponse passToManagement(@PathVariable String reference) {
        return service.passToManagement(reference);
    }

    @PostMapping("/{reference}/answer")
    public PqrsResponse recordAnswer(
            @PathVariable String reference,
            @Valid @RequestBody AnswerRequest request
    ) {
        return service.recordAnswer(reference, request);
    }

    @PostMapping("/{reference}/close")
    public PqrsResponse closeCase(@PathVariable String reference) {
        return service.closeCase(reference);
    }

    @GetMapping("/alerts/expired")
    public List<AlertResponse> getExpiredAlerts() {
        return service.getExpiredAlerts();
    }
}
