# Pazito — revisión técnica y ruta al MVP

**Fecha:** 2026-10-12. **Estado:** monorepo creado y backend implementado a nivel de código; aún no certificado como MVP.

## Estructura acordada

- `apps/web`: frontend existente Astro + React + TypeScript + Tailwind, dependencias separadas.
- `apps/api`: API Node.js + Express + TypeScript, Drizzle ORM y MySQL, dependencias propias.
- `packages/contracts`: tipos y esquemas Zod compartidos (paquete interno compilable).
- Workspaces con scripts de raíz para orquestar y scripts por aplicación para ejecutarlas por separado.

## Criterio de producto aplicado

Se incorporaron las decisiones confirmadas: público general desde el inicio; offline y sincronización en el MVP; invitación por enlace/QR con cuenta requerida; múltiples monedas con conversión y tasa histórica por gasto; reparto equitativo, por importes y porcentajes; liquidaciones manuales declaradas y confirmadas; permisos configurables por grupo; recibos e informes; español con internacionalización preparada; monorepo; correo configurable con modo local y SMTP opcional; desarrollo local primero; gratuito y sin publicidad; historial con exportación y eliminación/anonymización de cuenta.

## Qué se ha construido

- Autenticación, sesiones revocables, recuperación/cambio de contraseña y perfil.
- Grupos, miembros, roles y matriz configurable de permisos; invitaciones con expiración, revocación y uso único.
- Gastos, participaciones exactas, tasas de conversión congeladas, balances derivados y sugerencias deterministas de liquidación.
- Declaración/confirmación/disputa/cancelación de liquidaciones con eventos históricos y reserva contra sobredeclaración.
- Categorías, recibos privados, exportación CSV/PDF, exportación personal, eliminación/anonymización de cuenta.
- Contrato inicial de sincronización offline y clave idempotente transaccional para crear gastos.
- Migración SQL versionada, seed de categorías, Docker Compose para MySQL local, OpenAPI, health checks, logs estructurados, límites de peticiones, ADRs y pruebas iniciales.

## Riesgos y trabajo restante para aceptar el MVP

1. Instalar dependencias con Bun en el equipo destino y ejecutar build, typecheck, lint y tests; corregir cualquier incidencia dependiente de versiones/plataforma.
2. Validar en MySQL limpio que la migración se aplica y comparar todas las tablas/índices con el esquema Drizzle.
3. Completar y ejecutar pruebas de integración multiusuario: BOLA/IDOR, permisos por rol, CSRF/cookies, carreras de invitación/liquidación, idempotencia/replay y revocación de membresía.
4. Probar end-to-end las pantallas de frontend contra la API (contrato de respuestas, redirecciones, filtros y mensajes de error).
5. Completar UX y tests de conflictos offline para create/edit/archive, cambios de usuario, logout, operación offline con permisos revocados y reintentos parciales.
6. Revisar exportación contable multi-moneda y liquidaciones, zona horaria, redondeo y casos de moneda con 0/2/3 decimales.
7. Elegir proveedor de correo gratuito aceptable; ahora el modo `log` solo sirve para desarrollo y no envía correos.
8. Para producción faltan dominio/HTTPS, secretos de producción, backups/restauración probados, retención de logs, monitorización y almacenamiento de recibos persistente.

## Comandos de aceptación

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

Los comandos anteriores son el plan de validación, no una afirmación de que se ejecutaron en el entorno de construcción. Allí no se dispuso de Bun ni de MySQL/Docker; hasta correrlos en el equipo destino, la compilación completa, suite, migración y flujo real contra navegador/API permanecen pendientes.
