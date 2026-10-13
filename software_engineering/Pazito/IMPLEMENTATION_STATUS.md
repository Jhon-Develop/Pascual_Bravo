# Pazito — estado de implementación

**Fecha de la revisión:** 2026-10-12. **Estado global: backend implementado a nivel de código, verificación de entorno pendiente; no declarar MVP listo.**

## Cambios principales de esta entrega

- Se creó el monorepo Bun workspaces: `apps/web`, `apps/api`, `packages/contracts`.
- Se preservó el frontend Astro/React/Tailwind existente y se añadió un backend Express/TypeScript modular con MySQL/Drizzle.
- Cada aplicación declara dependencias y scripts propios. Los scripts de raíz orquestan contratos compartidos, dev/build/typecheck/test/lint/db.
- Se añadió esquema Drizzle y migración SQL inicial, seed de categorías globales, configuración de entorno y compose MySQL solo local.
- Se implementó autenticación con sesión opaca revocable y password hashing; recuperación de contraseña con adaptador de email y enlace de desarrollo sin envío real.
- Se implementaron rutas de perfil, exportación de datos y eliminación/anonymización, grupos/membresías/roles, permisos configurables, invitaciones, gastos, repartos, balances, liquidaciones, categorías, FX, recibos, exportación de informes, sync offline y health checks.
- Se incorporaron documentos de arquitectura, ADRs, OpenAPI y pruebas unitarias/de aplicación.
- Se añadieron bloqueos de grupo/operaciones transaccionales en flujos críticos, reserva de saldo para pagos declarados/disputados y guardas de eliminación de cuenta.

## Verificación en este entorno

En el entorno de construcción de este ZIP no se encontró Bun ni se pudo instalar/ejecutar el grafo completo de dependencias. Por lo tanto, no se puede afirmar que `bun install`, el build, Vitest, ESLint o conexión/migración MySQL se hayan ejecutado con éxito aquí. No marcar esas verificaciones como aprobadas sin ejecutarlas en el equipo del usuario.

Verificaciones reproducibles después de descargar:

```bash
bun install
bun run openapi:check
bun run typecheck
bun run lint:api
bun run test
bun run build
bun run db:migrate
bun run db:seed
bun run dev
```

Probar además el inicio individual: `bun run dev:web` y `bun run dev:api`.

## Funcionalidades implementadas en código

- Auth: register, login, logout, `me`, forgot/reset/change password.
- Sesiones revocables: hash de token almacenado, cookie HttpOnly y soporte Bearer del cliente actual.
- Grupos: CRUD/archive, miembros, transferencia de propiedad, rol/permiso configurables.
- Invitaciones: token con hash, expiración/uso único, revocación, enlace y adaptador opcional de correo.
- Gastos: list/create/get/update/archive, filtros/paginación, reparto equitativo/custom/porcentaje, conversión a moneda del grupo con snapshot de tasa.
- Balances: balances derivados y sugerencias greedy deterministas.
- Liquidaciones: declaración, confirmación, disputa, cancelación e historial de eventos; reservas de saldo pendiente en creación.
- Categorías, tasa FX, recibos privados, informe CSV/PDF, exportación de datos y eliminación de cuenta.
- Endpoint batch `POST /sync/expenses` por operación y claves idempotentes individuales.
- Health checks, request ID, logs estructurados y límites de tasa.

## Pendiente de prueba o evolución

1. Build/test/lint con las versiones resueltas por Bun en Windows del equipo y corrección de cualquier error de tipos/paquete revelado allí.
2. MySQL real: crear DB limpia, aplicar migración, seed, probar backup/restore y revisar que schema generado coincida con SQL versionado.
3. Suite integración con DB: auth/cookies/CSRF, roles, BOLA, invitaciones simultáneas, gasto/FX/balance, liquidaciones concurrentes, idempotencia, exportación/recibos y eliminación.
4. E2E frontend contra API: verificar shapes exactos de respuesta, filtros, error UX y sesión; el contrato OpenAPI debe permanecer sincronizado con cambios futuros.
5. Offline: edición/borrado en cola, conflictos de versión, revocación de membresía, logout, cambio de usuario/dispositivo, batches parcialmente fallidos y UX de reintento.
6. La migración incluye el esquema inicial. Cualquier cambio de esquema futuro necesita nueva migración versionada; no editar una migración que ya se aplicó a un entorno usado.
7. Verificar aislamiento por usuario/grupo y tratar edge cases de cuentas en múltiples grupos en pruebas de integración.
8. Configurar SMTP real de proveedor elegido (no seleccionado), HTTPS/cookies/CORS correctos y almacenamiento privado persistente para recibos en despliegue futuro.
9. Agregar contrato de eventos de auditoría/retención, backups/restore y métricas básicas antes de producción.
10. Producto: confirmar UX de monedas, tasa manual, si gastar en grupo con monedas base distinta es claro, conflictos offline y el balance visual de “pendiente” vs “confirmado”.

## Definición de terminado

No considerar MVP acabado hasta que los comandos de verificación pasen en local, las migraciones arranquen sobre una DB limpia, los flujos de negocio pasen pruebas con varias cuentas y los escenarios de offline/sincronización/conflicto hayan sido validados en navegador real.


## Corrección de registro y demo (2026-10-12)

- Causa confirmada en el código: frontend validaba registro/restablecimiento con mínimo de 8 caracteres mientras el contrato API exigía 12. Una contraseña de 8–11 caracteres se enviaba y era rechazada antes de insertar el usuario (`400 VALIDATION_ERROR`).
- Alineadas las validaciones de la UI y los esquemas compartidos en 12 caracteres; los errores del contrato incluyen detalles legibles en el formulario.
- El CTA de demo ahora entra a `/app/#/demo`, proporciona una sesión ficticia en memoria sin crear una cuenta ni escribir a Clever Cloud y muestra un aviso persistente del modo demo.
- Validación pendiente en el equipo local: `bun run typecheck`, `bun run test`, `bun run check:web` y un recorrido manual de registro/demo/login.
