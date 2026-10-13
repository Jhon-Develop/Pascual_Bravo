# ADR-002 — Sesiones opacas revocables y cookies

- Estado: aceptado para el MVP, pendiente de E2E/browser.
- Decisión: token aleatorio de sesión, guardado como SHA-256 en DB, enviado mediante cookie `HttpOnly`/`SameSite=Lax` y Bearer token en memoria cuando lo requiere el cliente API actual. Las contraseñas usan Argon2id; los tokens de restablecimiento se guardan hasheados y son de un solo uso.
- Defensa CSRF: las operaciones mutables que se autentican por cookie requieren un `Origin` o `Referer` permitido. CORS usa allowlist exacta.
- Consecuencia: las sesiones son revocables al cerrar sesión, resetear contraseña o eliminar cuenta. En producción se requiere TLS, secreto robusto, dominio/orígenes correctos, SMTP real y revisión de cabeceras de proxy.
- Límite: aún debe verificarse el comportamiento con todos los navegadores/entornos de despliegue; no desplegar usando el `.env.example`.
