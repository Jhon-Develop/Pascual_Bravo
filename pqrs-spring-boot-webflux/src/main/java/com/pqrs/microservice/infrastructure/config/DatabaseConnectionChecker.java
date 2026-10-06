package com.pqrs.microservice.infrastructure.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.r2dbc.core.DatabaseClient;

@Configuration(proxyBeanMethods = false)
public class DatabaseConnectionChecker {

    private static final Logger log = LoggerFactory.getLogger(DatabaseConnectionChecker.class);

    @Bean
    ApplicationRunner verifyReactiveDatabase(DatabaseClient databaseClient) {
        return args -> databaseClient.sql("SELECT 1 AS ok")
                .map((row, metadata) -> row.get("ok", Integer.class))
                .one()
                .doOnNext(ok -> log.info("Reactive R2DBC database connection OK (SELECT {}).", ok))
                .doOnError(ex -> log.error("Reactive R2DBC database connection failed: {}", ex.getMessage(), ex))
                .block();
    }
}
