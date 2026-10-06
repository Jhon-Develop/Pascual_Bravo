package com.pqrs.microservice;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("dev")
class PqrsApplicationTests {

    @Test
    void contextLoadsWithReactiveStack() {
    }
}
