# Diagnóstico: registro, login y demo sin cuenta

Fecha: 2026-10-12

## Causa del `400 VALIDATION_ERROR`

El contrato compartido de la API exige contraseñas de al menos 12 caracteres. El formulario React y las páginas de autenticación Astro validaban inicialmente solo 8 caracteres. Con una contraseña de 8–11 caracteres, la interfaz enviaba la petición `POST /api/v1/auth/register` y el backend la rechazaba en `validateBody(registerSchema)`, antes de insertar el usuario. Por tanto, el `401 UNAUTHORIZED` del login posterior es coherente: ese intento de registro no creó una cuenta.

Se alinearon validaciones del frontend y contratos a un mínimo de 12 caracteres, se añadieron mensajes en español y la interfaz muestra los detalles de validación que devuelva el backend. No requiere una migración de base de datos.

## Demo sin registro

El CTA de la portada apuntaba a `/app/#/auth/register`; no existía una ruta de entrada a demo. Se agregó `/app/#/demo`. Al pulsar la entrada, el cliente habilita un modo de datos ficticios en memoria y crea una sesión de demo local. No crea un usuario, no ejecuta mutaciones contra la API real ni modifica Clever Cloud. El chequeo inicial de sesión de la aplicación puede hacer un `GET /api/v1/auth/me`, pero no escribe datos.

La demostración es temporal y se reinicia al recargar. Las pantallas que actualmente muestran `esta sección todavía está en desarrollo` siguen siendo placeholders; este cambio arregla la entrada a la demo, pero no convierte por sí solo esas pantallas en funcionalidades completas. En la barra de la aplicación se muestra un aviso y un enlace para salir de la demo.

## Verificación local

Desde la raíz del monorepo:

```powershell
bun run typecheck
bun run test
bun run check:web
bun run dev
```

No es necesario volver a ejecutar `db:migrate` ni `db:seed` para estas correcciones. Si el registro sigue devolviendo `400`, revisa el mensaje de validación que mostrará la interfaz y la pestaña Network del navegador; no compartas la contraseña ni `DATABASE_URL`. Si el registro devuelve `201` y después el login falla, conserva el `requestId` y el código de respuesta para seguir el diagnóstico sin exponer secretos.

## Resultados de verificación en el entorno de revisión

- TypeScript de `packages/contracts`: compilación satisfactoria.
- Typecheck del frontend: satisfactorio, incluido el nuevo test de contrato.
- Comprobación directa de esquema: 11 caracteres rechazados; 12 caracteres aceptados en registro y recuperación.
- Vitest no llegó a iniciar porque falta el binding nativo `@rolldown/binding-wasm32-wasi` en el entorno de revisión. Debe volver a ejecutarse en el equipo de desarrollo tras reparar/reinstalar dependencias.
