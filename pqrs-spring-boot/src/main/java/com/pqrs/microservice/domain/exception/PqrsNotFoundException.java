package com.pqrs.microservice.domain.exception;

public class PqrsNotFoundException extends RuntimeException {
    public PqrsNotFoundException(String reference) {
        super("No existe una PQRS con referencia: " + reference);
    }
}
