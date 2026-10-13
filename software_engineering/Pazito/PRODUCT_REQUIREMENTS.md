# Pazito — requisitos de producto y criterios MVP

## Propuesta de valor

Pazito ayuda a grupos de cualquier tipo (roomies, parejas, familia, amigos, viajeros y organizadores de eventos) a registrar gastos, ver cómo se distribuye cada importe y acordar deudas mediante balances comprensibles. El objetivo es minimizar fricción social y tiempo de registro, sin publicidad y sin ejecutar transferencias bancarias.

## Decisiones confirmadas

| Tema | Decisión |
|---|---|
| Audiencia | Todos los segmentos desde el inicio; lanzamiento gradual y validación con usuarios |
| Offline | Incluido en el MVP con captura local y sincronización idempotente |
| Invitaciones | Enlace/QR; se requiere cuenta para aceptar y participar |
| Monedas | Múltiples monedas con conversión explícita |
| Reparto | Equitativo, importes y porcentajes |
| Pagos | Manuales: declaración, confirmación o disputa; no se mueven fondos |
| Permisos | Configurables por grupo, dentro de límites seguros por rol |
| Archivos e informes | Recibos adjuntos y exportación CSV/PDF |
| Idioma | Español de entrada, preparado para i18n |
| Repositorio | Monorepo con dependencias declaradas separadamente por app |
| Correo | Adaptador SMTP/log intercambiable; buscar opción gratuita y documentar límites |
| Despliegue | Local primero; proveedor todavía no elegido |
| Modelo de negocio | Sin anuncios; ingreso futuro pendiente de validación |
| Historial/datos | Historial y exportación; eliminación con anonimización que no destruya el historial financiero compartido |

## Flujo funcional central

1. Una persona se registra e inicia sesión.
2. Crea grupo, configura moneda base, idioma/zona horaria y permisos.
3. Invita a otras personas por URL/QR o correo. El invitado se registra/inicia sesión y canjea un token de un solo uso.
4. Un miembro registra gasto con pagador, participantes, tipo de reparto, moneda original, tasa FX si hace falta, categoría y fecha.
5. El backend valida todas las reglas, guarda gasto y participaciones en transacción y deriva el balance en moneda del grupo.
6. El grupo ve saldos individuales e instrucciones deterministas “quién debe a quién”.
7. La persona deudora declara el pago; la receptora confirma o disputa. Solo confirmar altera el balance oficial.
8. Se consultan historial, filtros, recibos e informes; el usuario puede exportar sus datos y solicitar eliminación segura de cuenta.
9. La PWA puede encolar una operación offline para sincronizarla luego; el servidor vuelve a validar autorización actual y garantiza idempotencia.

## Reglas de dinero

- HTTP `amountMinor` es entero seguro JSON; DB `BIGINT` y lógica `bigint`.
- Cada moneda tiene un exponente. El formato de interfaz (por ejemplo, mostrar COP sin decimales) no altera la precisión de almacenamiento.
- `Expense.amountMinor`/`currency` conservan importe original.
- `Expense.settlementAmountMinor`/`settlementCurrency` conservan el importe ya convertido a moneda del grupo.
- `ExpenseShare.originalAmountMinor` es el reparto original y `amountMinor` el importe liquidado en moneda del grupo.
- La tasa decimal, fuente y fecha usada son inmutables para ese gasto una vez registrado, salvo edición permitida antes de liquidaciones; toda modificación se audita.
- Partes originales deben sumar el gasto original; partes convertidas deben sumar el total convertido. Residuos distribuidos deterministicamente.
- Balance positivo significa acreedor y negativo deudor. La suma de balances netos es cero.
- Una liquidación pendiente/disputada reserva el saldo disponible pero no se resta del balance oficial hasta confirmarse.

## Alcance del MVP

- Registro/inicio/cierre sesión y recuperación de contraseña con modo dev sin envío real.
- Perfiles básicos.
- Grupos, miembros, invitaciones y autorización por recurso.
- Configuración de permisos por grupo con protección del propietario.
- Gastos CRUD/archivado, repartos equitativo/custom/porcentaje, moneda origen/base y tasas registradas.
- Balances y sugerencia de liquidaciones.
- Historial de liquidaciones con estado declarado, confirmado, disputado o cancelado.
- Categorías, filtro/paginación, recibos privados, exportación CSV/PDF y exportación/eliminación de cuenta.
- PWA offline de creación/sync idempotente, con estado de pendiente/error visible y validación servidor al sincronizar.
- Documentación OpenAPI, migraciones, seed determinista, logs redacted, health check, test unitarios e integración.

## No incluido en el MVP

- Transferencias bancarias/PSP, pagos con tarjeta, custodia o movimiento de dinero.
- OCR de recibos, IA para clasificar gastos o integraciones bancarias.
- Conversión FX como tasa bancaria garantizada en tiempo real.
- Notificaciones push obligatorias o Background Sync como único medio de sincronización.
- Microservicios, cola externa, Kubernetes o infraestructura multi-región.
- Suscripciones/ads; se validará el modelo económico posteriormente.

## Criterios de aceptación

- No hay lectura/escritura de datos de otros grupos a través de IDs adivinados.
- Las mutaciones financieras se procesan dentro de transacción e incluyen audit event.
- Compartir gastos y los balances conservan totales exactos en unidades menores.
- Los pagos no confirmados no cambian el balance oficial; intentos de doble declaración no comprometen el mismo saldo dos veces.
- Reintentar una operación con igual clave/payload no crea un recurso duplicado; payload distinto con la misma clave da `409`.
- La revocación de membresía impide la sincronización de una operación offline posterior.
- Un miembro no abandona/elimina cuenta con saldo o pagos pendientes que dejarían el historial inconsistente.
- Los recibos se comprueban por firma MIME/tamaño y se sirven solo tras autorización activa.
- Las exportaciones están autorizadas, no cacheadas públicamente y no filtran datos de otros grupos sin permiso.
- Los comandos de frontend y backend pueden ejecutarse por separado, además del comando integrado del monorepo.
- Los tests, typecheck, lint, build y migración MySQL se deben ejecutar localmente antes de considerar release; este ZIP no afirma que el ambiente externo los haya ejecutado.
