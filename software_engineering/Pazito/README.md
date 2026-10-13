# Pazito — monorepo de gastos compartidos

Pazito es una aplicación web/PWA para registrar gastos compartidos, mostrar balances explicables y registrar declaraciones de pago que la otra persona debe confirmar. **No procesa ni ejecuta transferencias bancarias.** El proyecto está organizado como monorepo con aplicaciones desplegables por separado y dependencias declaradas por paquete.

> **Estado del ZIP:** se integró una primera implementación real del backend y se preservó el frontend existente. Esta entrega no debe considerarse lista para producción hasta instalar dependencias y ejecutar las verificaciones localmente, probar migraciones sobre MySQL limpio y completar pruebas E2E de los flujos financieros/offline.

## Arquitectura

```text
apps/
  web/       Astro + React + TypeScript + Tailwind (frontend existente)
  api/       Node.js + Express + TypeScript + MySQL + Drizzle (backend)
packages/
  contracts/ Esquemas Zod y tipos compartidos
```

- **Monolito modular**, no microservicios.
- `apps/web` y `apps/api` tienen su propio `package.json`, dependencias y scripts. Bun workspaces permite compartir el paquete `@pazito/contracts` sin fusionar las dependencias declaradas de las aplicaciones.
- `packages/contracts` mantiene tipos y esquemas de validación compartidos. Se compila a `dist/`; por eso los comandos de raíz construyen primero ese paquete.
- Node.js `>=22.12.0` y Bun reciente con soporte de workspaces. MySQL 8.4 es el perfil recomendado para desarrollo local.
- REST versionada en `/api/v1`, OpenAPI en `/api/v1/openapi.json` y health checks en `/health/live` y `/api/v1/health/ready`.

## Requisitos y preparación local

1. Instala Node.js (>=22.12.0), Bun y MySQL 8.4. Docker es opcional.
2. Desde la raíz del repositorio, instala dependencias:

   ```bash
   bun install
   ```

   Este comando resuelve las versiones y crea `bun.lock` para tu sistema; el ZIP no trae un lockfile generado en otro entorno operativo.

3. Crea los archivos de entorno locales:

   **PowerShell:**
   ```powershell
   Copy-Item apps/api/.env.example apps/api/.env
   Copy-Item apps/web/.env.example apps/web/.env
   ```

   **macOS/Linux:**
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```

4. Genera un secreto para sesiones y sustituye el placeholder de `apps/api/.env`:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
   ```

   No uses este valor de ejemplo en un entorno compartido. Nunca subas los `.env` reales al control de versiones.

5. Inicia MySQL. Si Docker está instalado, desde la raíz ejecuta:

   ```bash
   docker compose up -d mysql
   ```

   El compose expone MySQL únicamente en `127.0.0.1:3306` y usa credenciales explícitamente locales. Si no usas Docker, crea una base `pazito` y un usuario local, y actualiza `DATABASE_URL` en `apps/api/.env`.

6. Ejecuta migraciones y prepara categorías base:

   ```bash
   bun run db:migrate
   bun run db:seed
   ```

7. Arranca la aplicación (frontend y API en paralelo):

   ```bash
   bun run dev
   ```

   Normalmente Astro estará en `http://localhost:4321` y Express en `http://localhost:3000`. La API no inicia sesiones ni datos financieros ficticios automáticamente.

8. Para ver el prototipo sin registrar una cuenta, pulsa **Probar demo sin registrarme** en la portada (o abre `/app/#/demo`). La demo utiliza fixtures ficticios en memoria del navegador; no crea usuarios, no envía mutaciones de negocio a la API ni escribe en MySQL/Clever Cloud. Al recargar la pestaña se reinicia. Las pantallas identificadas como prototipos siguen pendientes.

## Comandos separados

Desde la raíz:

| Comando | Resultado |
|---|---|
| `bun run dev` | Frontend y API en paralelo |
| `bun run dev:web` | Solo Astro/React |
| `bun run dev:api` | Solo Express API |
| `bun run build:web` | Build frontend |
| `bun run build:api` | Build backend |
| `bun run build` | Build de ambos |
| `bun run typecheck:web` | Typecheck frontend |
| `bun run typecheck:api` | Typecheck backend |
| `bun run typecheck` | Contratos + ambas aplicaciones |
| `bun run check:web` | Comprobación Astro |
| `bun run test:web` | Pruebas frontend |
| `bun run test:api` | Pruebas backend |
| `bun run test:api:integration` | Pruebas HTTP sin depender de MySQL cuando se indica así en el test |
| `bun run test` | Suites frontend y backend |
| `bun run lint:api` | ESLint del backend |
| `bun run openapi:check` | Comprueba que el documento OpenAPI incluye operaciones críticas |
| `bun run db:generate` | Genera un borrador de migración Drizzle (revisar antes de usar) |
| `bun run db:migrate` | Aplica migraciones SQL versionadas |
| `bun run db:seed` | Añade categorías globales predeterminadas; no crea usuarios demo |
| `bun run db:studio` | Interfaz Drizzle Studio |
| `bun run audit:api` | Auditoría de dependencias según la versión de Bun instalada |

También se puede trabajar directamente en cada paquete. En `apps/web`, ejecuta `bun run dev`; en `apps/api`, ejecuta `bun run dev`. Ambos ejecutan el build de contratos antes de arrancar.

## Backend incluido

- Registro/login/logout, sesiones opacas revocables, cambio/recuperación de contraseña, perfil, exportación personal y eliminación anonimizada con conservación de historia financiera.
- Grupos, membresías, cambio de propietario, invitaciones por token de uso único/caducidad, roles y permisos por grupo configurables.
- Gastos archivables, paginados y filtrables; repartos equitativos, personalizados por importe y porcentajes con residuos deterministas.
- Importe original por moneda y conversión guardada a la moneda de liquidación del grupo; tasa y procedencia congeladas en el gasto.
- Balances derivados de gastos/participaciones y únicamente liquidaciones confirmadas; sugerencias greedy deterministas (no se afirma optimalidad global en todos los casos).
- Declaración/confirmación/disputa/cancelación de liquidaciones; no hay pagos bancarios reales.
- Recibos privados PDF/JPEG/PNG/WEBP con límites y comprobación de MIME real; informes CSV/PDF por grupo con gastos y estado/historial resumido de liquidaciones.
- Endpoint de sincronización de creación offline y `Idempotency-Key` en mutaciones críticas. Los reintentos del mismo payload no deben duplicar gastos.
- Health checks, request ID, logs estructurados con redacción, limitación de intentos y formato JSON de error.

## Decisiones de producto aplicadas

Todas las audiencias previstas; modo offline desde el MVP; invitación por enlace/QR con registro obligatorio; multimoneda con conversión; reparto equitativo, por importes o porcentajes; pagos declarados y confirmados manualmente; permisos configurables por grupo; recibos e informes; español inicial con internacionalización; monorepo; correo con adaptador intercambiable y modo de desarrollo sin envío real; desarrollo local primero; sin publicidad por ahora; historial, exportación y eliminación de cuenta.

## Seguridad y límites importantes

- Las contraseñas se almacenan con Argon2id, no en texto plano. Las sesiones se guardan por hash y son revocables.
- Se usan cookies `HttpOnly` y `SameSite=Lax`; requests mutables autenticadas por cookie requieren `Origin`/`Referer` confiable. `Secure` se activa en producción.
- Configure `FRONTEND_ORIGINS` con orígenes exactos. `TRUST_PROXY` solo debe activarse tras configurar un proxy confiable correcto.
- Si se elige `EMAIL_TRANSPORT=log`, no se envía correo real; en desarrollo la API devuelve un enlace de reset de prueba. Producción exige SMTP configurado. Proveedor, cuotas y límites gratuitos se deben verificar antes de seleccionar uno.
- El proveedor FX predeterminado consulta códigos de moneda y tasa de referencia (no información personal). Las cotizaciones externas son indicativas, no precios bancarios garantizados en tiempo real. Se guarda la tasa usada en cada gasto; pueden introducirse tasas manuales si corresponde.
- Los recibos usan almacenamiento local privado. Para un despliegue con múltiples instancias debe elegirse almacenamiento compartido privado, control de acceso, copias de seguridad y política de retención.
- Cambiar `SESSION_SECRET` invalida sesiones existentes y también impide descifrar respuestas idempotentes históricas cifradas con el secreto anterior; para rotarlo en un entorno real se requiere una migración planificada.
- El estado del balance se calcula desde los datos fuente; no se acepta un balance enviado por el navegador como fuente de verdad.
- Las migraciones se aplican manualmente, no al arrancar HTTP; primero revisa copias de seguridad y entorno. No ejecutes sobre datos importantes sin backup probado.

## Documentación

- [`PRODUCT_REQUIREMENTS.md`](./PRODUCT_REQUIREMENTS.md): decisiones del producto y criterios del MVP.
- [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md): qué está implementado y qué requiere verificación.
- [`CODE_REVIEW_AND_MVP_ROADMAP.md`](./CODE_REVIEW_AND_MVP_ROADMAP.md): revisión del frontend/base técnica y roadmap.
- [`API_INTEGRATION.md`](./API_INTEGRATION.md): integración entre frontend y API.
- [`apps/api/docs/openapi.json`](./apps/api/docs/openapi.json): contrato OpenAPI.
- [`docs/architecture/overview.md`](./docs/architecture/overview.md): arquitectura y límites de seguridad.
- [`docs/decisions/`](./docs/decisions/): ADRs y preguntas abiertas.

## Qué falta antes de llamar a esto “MVP terminado”

1. Ejecutar `bun install` y verificar build/typecheck/lint/test en un entorno real de desarrollo.
2. Aplicar migración sobre un MySQL limpio y probar migración/backup/restore.
3. E2E con dos o más usuarios reales de prueba: permisos, invitaciones, pagos, deudas, conflicto de sincronización offline y eliminación de cuenta.
4. Pruebas de integración de todas las rutas de negocio contra MySQL. Las pruebas unitarias no sustituyen estos flujos.
5. Recibos/exportación: probar formatos límite, caracteres, archivos grandes y permisos cruzados.
6. Verificar contrato contra el frontend existente, sobre todo auth, grupos, gastos, estado offline, filtros y codificación monetaria.
7. Elegir un proveedor SMTP gratuito o aceptar el flujo de email en modo limitado; documentar cuotas, retención y datos enviados.
8. Resolver UX de conflictos offline y reconciliación al cambiar permisos, moneda del grupo o gasto desde otro dispositivo.
9. Elegir infraestructura y política de backup solo después de validar localmente; aún no se ha desplegado nada.

## Licencia

No se añadió una licencia de distribución. Confirma la decisión de licencia del equipo antes de publicar el repositorio.
