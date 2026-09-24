package com.pqrs.microservice.infrastructure.email;

import com.pqrs.microservice.application.event.PqrsAnsweredEvent;
import com.pqrs.microservice.application.event.PqrsAssignedEvent;
import com.pqrs.microservice.application.event.PqrsCreatedEvent;
import com.pqrs.microservice.application.port.out.EmailSenderPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.event.TransactionPhase;

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
                "Hola,\n\n" +
                        "Tu PQRS fue registrada correctamente.\n" +
                        "Referencia: " + event.reference() + "\n" +
                        "Tipo: " + event.type() + "\n" +
                        "Fecha límite de respuesta: " + event.limitedDate() + "\n\n" +
                        "Descripción:\n" + event.description() + "\n\n" +
                        "Este mensaje fue generado automáticamente por el microservicio de PQRS."
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
                "Hola " + event.responsibleName() + ",\n\n" +
                        "Se te ha asignado la PQRS " + event.reference() + ".\n" +
                        "Por favor, revisa el caso desde la API y realiza la gestión correspondiente."
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
                "Hola,\n\n" +
                        "La PQRS " + event.reference() + " recibió una respuesta el " + event.answerDate() + ".\n" +
                        "Responsable: " + event.authorName() + "\n\n" +
                        "Respuesta:\n" + event.answerContent() + "\n\n" +
                        "Este mensaje fue generado automáticamente por el microservicio de PQRS."
        );
    }

    private void safeSend(String to, String subject, String body) {
        try {
            emailSender.send(to, subject, body);
            log.info("Notificación de correo enviada con asunto: {}.", subject);
        } catch (RuntimeException ex) {
            // El correo no debe revertir una transacción de negocio ya confirmada.
            log.error("No se pudo enviar una notificación de correo: {}", ex.getMessage(), ex);
        }
    }
}
