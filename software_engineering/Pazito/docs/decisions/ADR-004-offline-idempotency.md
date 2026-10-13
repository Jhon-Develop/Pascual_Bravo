# ADR-004 — Sincronización offline e idempotencia

- Estado: aceptado para MVP, aún requiere pruebas E2E reales.
- Decisión: IndexedDB conserva operaciones offline con UUID estable y el cliente envía `Idempotency-Key`. El backend asocia cada clave con usuario, operación y hash de payload mediante índice único. Repetir la misma operación/ payload devuelve la respuesta guardada; reutilizar clave con payload diferente produce `409`.
- Las acciones de sync vuelven a verificar autenticación, membresía y permisos vigentes. Un registro offline no autoriza un cambio luego de revocarse el acceso. La hora del cliente es dato informativo, no orden autoritativo del servidor.
- Las creaciones batch de `POST /sync/expenses` se procesan por operación y devuelven éxito/fallo individual. El cliente actual también usa POST/PATCH/DELETE individuales y debe conservar la misma clave al reintentar.
- Los resultados idempotentes se cifran en reposo para evitar guardar tokens de invitación en claro. Rotar el secreto usado para cifrado requiere una estrategia de migración/retención.
- Pendiente: estrategia UX para conflictos de edición simultánea y colas tras logout/deletion; pruebas con navegadores sin Background Sync.
