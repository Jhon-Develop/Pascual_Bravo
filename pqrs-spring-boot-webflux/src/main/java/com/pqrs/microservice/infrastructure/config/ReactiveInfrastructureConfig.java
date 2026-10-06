package com.pqrs.microservice.infrastructure.config;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.reactive.TransactionalEventPublisher;

@Configuration(proxyBeanMethods = false)
public class ReactiveInfrastructureConfig {

    @Bean
    TransactionalEventPublisher transactionalEventPublisher(ApplicationEventPublisher applicationEventPublisher) {
        return new TransactionalEventPublisher(applicationEventPublisher);
    }
}
