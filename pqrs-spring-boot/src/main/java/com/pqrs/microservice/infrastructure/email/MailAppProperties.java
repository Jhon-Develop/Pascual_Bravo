package com.pqrs.microservice.infrastructure.email;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.mail")
public record MailAppProperties(
        boolean enabled,
        String from,
        String fromName
) {
}
