package com.pqrs.microservice.domain.exception;

public class ResponsibleNotFoundException extends RuntimeException {
    public ResponsibleNotFoundException(String document) {
        super("No existe un responsable con documento: " + document);
    }
}
