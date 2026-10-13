# ADR-001 — Monorepo con aplicaciones separadas

- Estado: aceptado.
- Contexto: se requiere conservar el frontend ya avanzado y construir el backend sin mezclar sus dependencias ni sus procesos.
- Decisión: Bun workspaces con `apps/web`, `apps/api` y `packages/contracts`. Cada aplicación declara sus dependencias propias. El frontend y API tienen comandos independientes y despliegues independientes. Un script de raíz facilita el desarrollo en paralelo.
- Consecuencias: el contrato compartido debe compilarse antes de usarlo; el ZIP no debe incluir `node_modules` de un sistema operativo. `bun install` genera un único lockfile de workspace. Dependencias declaradas separadas no implican que Bun duplique físicamente todos los paquetes instalados.
- Alternativas descartadas: dos repositorios desde el día uno (duplicación de trabajo/contratos durante MVP); microservicios (complejidad operacional no justificada).
