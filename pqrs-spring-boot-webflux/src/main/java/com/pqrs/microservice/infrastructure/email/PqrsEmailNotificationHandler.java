package com.pqrs.microservice.infrastructure.email;

import com.pqrs.microservice.application.event.PqrsAnsweredEvent;
import com.pqrs.microservice.application.event.PqrsAssignedEvent;
import com.pqrs.microservice.application.event.PqrsCreatedEvent;
import com.pqrs.microservice.application.port.out.EmailSenderPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class PqrsEmailNotificationHandler {

    private static final Logger log = LoggerFactory.getLogger(PqrsEmailNotificationHandler.class);

    private final EmailSenderPort emailSender;
    private final MailAppProperties properties;

    public PqrsEmailNotificationHandler(EmailSenderPort emailSender, MailAppProperties properties) {
        this.emailSender = emailSender;
        this.properties = properties;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCreated(PqrsCreatedEvent event) {
        if (!properties.enabled() || event.recipientEmail() == null || event.recipientEmail().isBlank()) {
            return;
        }
        safeSend(
                event.recipientEmail(),
                "PQRS radicada " + event.reference(),
                """
                Hola,

                Tu PQRS fue registrada correctamente.
                Referencia: %s
                Tipo: %s
                Fecha límite de respuesta: %s

                Descripción:
                %s

                Este mensaje fue generado automáticamente por el microservicio de PQRS.
                """.formatted(event.reference(), event.type(), event.limitedDate(), event.description())
        );
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onAssigned(PqrsAssignedEvent event) {
        if (!properties.enabled() || event.responsibleEmail() == null || event.responsibleEmail().isBlank()) {
            return;
        }
        safeSend(
                event.responsibleEmail(),
                "PQRS asignada " + event.reference(),
                """
                Hola %s,

                Se te ha asignado la PQRS %s.
                Por favor, revisa el caso desde la API y realiza la gestión correspondiente.
                """.formatted(event.responsibleName(), event.reference())
        );
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onAnswered(PqrsAnsweredEvent event) {
        if (!properties.enabled() || event.citizenEmail() == null || event.citizenEmail().isBlank()) {
            return;
        }
        safeSend(
                event.citizenEmail(),
                "Respuesta a tu PQRS " + event.reference(),
                """
                Hola,

                La PQRS %s recibió una respuesta el %s.
                Responsable: %s

                Respuesta:
                %s

                Este mensaje fue generado automáticamente por el microservicio de PQRS.
                """.formatted(event.reference(), event.answerDate(), event.authorName(), event.answerContent())
        );
    }

    private void safeSend(String to, String subject, String body) {
        emailSender.send(to, subject, body)
                .doOnSuccess(ignored -> log.info("Notificación de correo enviada con asunto: {}.", subject))
                .doOnError(ex -> log.error("No se pudo enviar una notificación de correo: {}", ex.getMessage(), ex))
                .subscribe();
    }
}
