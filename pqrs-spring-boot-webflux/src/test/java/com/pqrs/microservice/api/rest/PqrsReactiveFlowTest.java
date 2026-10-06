package com.pqrs.microservice.api.rest;

import com.pqrs.microservice.api.rest.dto.PqrsResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.webtestclient.AutoConfigureWebTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.reactive.server.WebTestClient;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev")
@AutoConfigureWebTestClient
class PqrsReactiveFlowTest {

    @Autowired
    private WebTestClient webTestClient;

    @Test
    void shouldCreateAndReadPqrsThroughWebFluxAndR2dbc() {
        String request = """
                {
                  "type": "PETICION",
                  "description": "Prueba de flujo reactivo WebFlux y R2DBC",
                  "citizen": {
                    "document": "999999999",
                    "name": "Usuario de Prueba",
                    "email": "prueba@example.com",
                    "phone": "3000000000"
                  }
                }
                """;

        PqrsResponse created = webTestClient.post()
                .uri("/api/v1/pqrs")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(PqrsResponse.class)
                .returnResult()
                .getResponseBody();

        assertNotNull(created);
        assertNotNull(created.reference());
        assertTrue(created.reference().startsWith("RAD-"));

        webTestClient.get()
                .uri("/api/v1/pqrs/{reference}", created.reference())
                .accept(MediaType.APPLICATION_JSON)
                .exchange()
                .expectStatus().isOk()
                .expectBody(PqrsResponse.class)
                .value(response -> {
                    assertNotNull(response);
                    assertTrue(created.reference().equals(response.reference()));
                });
    }
}
