package com.pqrs.microservice.infrastructure.email;

import com.pqrs.microservice.application.port.out.EmailSenderPort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

@Component
@ConditionalOnProperty(prefix = "app.mail", name = "enabled", havingValue = "false", matchIfMissing = true)
public class NoOpEmailAdapter implements EmailSenderPort {

    @Override
    public Mono<Void> send(String to, String subject, String body) {
        return Mono.empty();
    }
}
