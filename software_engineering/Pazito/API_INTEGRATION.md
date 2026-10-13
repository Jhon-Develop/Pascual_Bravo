# Integración frontend ↔ backend de Pazito

## Configuración local

- Frontend: `apps/web/.env`, `PUBLIC_API_BASE_URL=http://localhost:3000/api/v1`, `PUBLIC_DEMO_MODE=false`.
- Backend: `apps/api/.env`, `API_HOST=127.0.0.1`, `API_PORT=3000`, `FRONTEND_ORIGINS=http://localhost:4321,http://127.0.0.1:4321` y `DATABASE_URL` local.
- El cliente React envía `credentials: 'include'` y `Authorization: Bearer <accessToken en memoria>` cuando el token está disponible. El backend también establece cookie HttpOnly para sesión web.
- No persistas el `accessToken` en `localStorage`. La PWA solo puede crear operaciones offline con datos que ya tiene localmente; al sincronizar, el servidor valida sesión/permisos actuales.

## Contratos existentes

| Acción frontend | Método/ruta | Forma general |
|---|---|---|
| Registrar / login | `POST /auth/register`, `POST /auth/login` | `{user, accessToken, expiresAt}` + cookie de sesión |
| Usuario actual | `GET /auth/me` | Usuario público |
| Logout | `POST /auth/logout` | `204` y revocación de sesión |
| Recuperar contraseña | `POST /auth/forgot-password`, `POST /auth/reset-password` | Respuesta genérica; reset `204` |
| CRUD grupos | `GET/POST /groups`, `GET/PATCH/DELETE /groups/:id` | Listas paginadas; grupo/archivado |
| Miembros | `GET /groups/:id/members`, `PATCH/DELETE /groups/:id/members/:memberId` | `{data,meta}` / miembro / `204` |
| Invitaciones | `POST/GET /groups/:id/invitations`, `DELETE /groups/:id/invitations/:invitationId`, `POST /invitations/accept` | URL para QR; token un solo uso y cuenta autenticada |
| Gastos | `GET/POST /expenses`, `GET/PATCH/DELETE /expenses/:id` | `Expense` o `{data,meta}`; borrado lógico responde `204` |
| Categorías | `GET /categories?groupId=...`, `POST /categories`, `DELETE /categories/:id` | Array / categoría / `204` |
| Balance | `GET /groups/:id/balances`, `GET /groups/:id/balances/detail` | Balance de grupo / transferencias sugeridas |
| Liquidaciones | `GET/POST /settlements`, `POST /settlements/:id/confirm`, `/dispute`, `/cancel` | Lista paginada; transiciones de estado |
| Tasa FX | `GET /fx/rate?from=USD&to=COP&manualRate=...` | `{from,to,rate,source,asOf,indicative}` |
| Recibo | `POST /expenses/:id/receipts` (multipart `file`), `GET/DELETE /receipts/:receiptId` | Metadata/archivo autorizado/`204` |
| Informe grupo | `GET /groups/:id/export?format=csv|pdf&from=YYYY-MM-DD&to=YYYY-MM-DD` | Descarga privada CSV/PDF |
| Exportación personal | `GET /users/me/export` | JSON con datos personales e historia relacionada |
| Eliminación cuenta | `DELETE /users/me` con `{confirmation:"ELIMINAR MI CUENTA",password}` | `204`; requiere resolver saldos y liquidaciones pendientes |
| Salud | `GET /health`, `/health/live`, `/health/ready` | Diagnóstico sin secretos |

El documento OpenAPI vive en `apps/api/docs/openapi.json`, expuesto en `/api/v1/openapi.json`. Es la referencia versionada a completar junto a cualquier endpoint nuevo; ejecutar `bun run openapi:check` detecta ausencia de operaciones críticas, pero no sustituye a una prueba de contrato generada.

## Idempotencia y modo offline

- En solicitudes mutables el cliente transmite `Idempotency-Key`. Para crear grupos, invitaciones, gastos y liquidaciones, el backend guarda un resultado vinculado a usuario + operación + hash del payload. Las operaciones críticas de gastos también registran idempotencia en `PATCH` y `DELETE`.
- Igual clave + payload devuelve el resultado guardado; misma clave + payload distinto devuelve `409 IDEMPOTENCY_KEY_REUSED`.
- La cola offline conserva la clave al reintentar. No inventes otra clave al recuperarse la conexión.
- El frontend actual sincroniza gastos mediante llamadas individuales POST/PATCH/DELETE. `POST /sync/expenses` existe como endpoint batch para creaciones (`expense.create`) con resultado individual por operación, pero no es necesario para el flujo actual de hooks.
- Tras cada sincronización, la respuesta del servidor es canónica. Los IDs locales se relacionan con `serverId`; no se debe suponer que una edición o eliminación encolada siempre puede aplicarse: el usuario puede perder membresía/permisos mientras está offline, o la versión del gasto puede cambiar en otro dispositivo.
- No guardar tokens, contraseñas ni secretos en IndexedDB. El modo offline no es bypass de autorización. Las operaciones batch son parcialmente exitosas: procesa `results[]` por estado y deja visibles los fallos recuperables.

## Dinero y cambio de divisas

- `amountMinor` y `splits[].amountMinor` en el gasto expresan unidad menor de la moneda original.
- `settlementAmountMinor` del gasto y `splits[].settlementAmountMinor` expresan moneda de liquidación del grupo.
- La tasa FX es decimal string con hasta 12 decimales; no uses `number` binario para recalcular dinero.
- `fxRate`, `fxSource`, `fxAsOf` representan la cotización usada al crear/editar ese gasto. No recalcules gastos históricos con la última tasa externa.
- Los importes de la API son enteros seguros JSON que el backend convierte a `bigint`; si la aplicación necesita importes mayores que `Number.MAX_SAFE_INTEGER`, hay que versionar el contrato y transmitir unidades menores como strings antes de aceptar ese rango.
- Los balances oficiales incluyen solo liquidaciones confirmadas. Las declaradas/disputadas aparecen en el historial y reservan saldo para evitar que se comprometa dos veces la misma deuda.

## Errores

Formato común: `{code, message, details?, statusCode, requestId}`. Estados más comunes: `400` validación, `401` no autenticado, `403` permiso/CSRF, `404` recurso no disponible, `409` estado/version/idempotencia conflictiva, `422` regla de negocio, `429` límite de intentos y `503` servicio externo/DB no disponible. El servidor no entrega stack traces en respuestas.

## Diferencias que necesitan validación con el frontend

- El frontend aún no tiene UI para todas las nuevas capacidades (FX, adjuntos, reportes, permisos configurables, exportación/eliminación de cuenta).
- Algunas funciones del backend no tienen todavía tests de integración con MySQL. La existencia de una ruta o de una definición OpenAPI no significa que el flujo E2E esté certificado.
- El contrato actual del navegador representa importes como `number`; conserva la política actual de enteros seguros y no serialices `bigint` directamente.
