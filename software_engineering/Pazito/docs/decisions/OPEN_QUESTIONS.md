# Decisiones abiertas

## Confirmadas por el equipo

1. Audiencia: compañeros de apartamento, parejas, familias, amigos, viajeros y organizadores de eventos desde el comienzo.
2. Offline: desde el MVP, con registro local y sincronización.
3. Invitaciones: enlace/QR, el invitado debe registrarse para participar.
4. Divisas: varias monedas y conversión.
5. Repartos: equitativo, importe personalizado y porcentaje.
6. Liquidaciones: declaración manual y confirmación del receptor; ninguna transferencia bancaria real.
7. Permisos: configuración por grupo.
8. Recibos y exportación de informes: sí.
9. Idioma: español inicial e internacionalización preparada.
10. Repositorio: monorepo recomendado con `apps/web`, `apps/api`, `packages/contracts`.
11. Email: proveedor gratuito si sirve; documentar límites y tratamiento de datos.
12. Despliegue: solo local por ahora.
13. Negocio: gratis y sin anuncios; modelo de ingresos pendiente.
14. Datos: historial completo, exportación y eliminación de cuenta, preservando integridad de historia compartida.

## Pendientes antes de producción

- Seleccionar proveedor SMTP (y revisar condiciones/limites free-tier, privacidad y reputación de entrega).
- Elegir hosting, dominio, TLS, backups, retención y restauración probada.
- Definir política de retención de auditoría y exportaciones.
- Validar qué tasas FX sirven para los casos de uso del equipo y con qué tolerancia de antigüedad.
- Definir si los informes deben incluir eventos de liquidaciones disputadas/canceladas y qué datos personales se exportan.
- Ejecutar E2E con dos cuentas y dos dispositivos, incluyendo revocaciones durante el modo offline.
- Acordar licencia de código antes de publicarlo.
