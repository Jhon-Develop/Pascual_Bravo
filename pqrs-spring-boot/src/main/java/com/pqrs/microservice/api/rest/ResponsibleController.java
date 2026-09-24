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

import java.util.List;

@RestController
@RequestMapping("/api/v1/responsibles")
public class ResponsibleController {

    private final PqrsService service;

    public ResponsibleController(PqrsService service) {
        this.service = service;
    }

    @GetMapping
    public List<ResponsibleResponse> findAll() {
        return service.findAllResponsibles();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ResponsibleResponse createOrUpdate(
            @Valid @RequestBody ResponsibleRequest request
    ) {
        return service.createOrUpdateResponsible(request);
    }
}
