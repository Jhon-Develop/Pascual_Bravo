package com.pqrs.microservice.api.rest;

import com.pqrs.microservice.api.rest.dto.ResponsibleRequest;
import com.pqrs.microservice.api.rest.dto.ResponsibleResponse;
import com.pqrs.microservice.application.PqrsService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/responsibles")
public class ResponsibleController {

    private final PqrsService service;

    public ResponsibleController(PqrsService service) {
        this.service = service;
    }

    @GetMapping
    public Flux<ResponsibleResponse> findAll() {
        return service.findAllResponsibles();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<ResponsibleResponse> createOrUpdate(
            @Valid @RequestBody Mono<ResponsibleRequest> request
    ) {
        return request.flatMap(service::createOrUpdateResponsible);
    }
}
