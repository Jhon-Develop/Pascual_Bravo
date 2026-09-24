package com.pqrs.microservice.infrastructure.email;

import com.pqrs.microservice.application.port.out.EmailSenderPort;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;

@Component
@ConditionalOnProperty(prefix = "app.mail", name = "enabled", havingValue = "true")
public class GmailEmailAdapter implements EmailSenderPort {

    private final JavaMailSender mailSender;
    private final MailAppProperties properties;

    public GmailEmailAdapter(JavaMailSender mailSender, MailAppProperties properties) {
        this.mailSender = mailSender;
        this.properties = properties;
    }

    @Override
    public void send(String to, String subject, String body) {
        if (to == null || to.isBlank()) {
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(
                    message,
                    false,
                    StandardCharsets.UTF_8.name()
            );
            helper.setTo(to);
            helper.setFrom(properties.from(), properties.fromName());
            helper.setSubject(subject);
            helper.setText(body, false);
            mailSender.send(message);
        } catch (MessagingException | UnsupportedEncodingException ex) {
            throw new IllegalStateException("No fue posible construir el correo de notificación.", ex);
        }
    }
}
