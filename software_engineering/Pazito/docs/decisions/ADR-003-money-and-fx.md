# ADR-003 — Aritmética monetaria exacta y conversión

- Estado: aceptado.
- Decisión: el contrato HTTP recibe enteros seguros JSON como unidades menores; la base de datos utiliza `BIGINT` y el backend convierte inmediatamente a `bigint`. Códigos de moneda ISO en mayúsculas y exponente derivado de `Intl.NumberFormat` para el código de moneda. La política de formato visible vive en la interfaz y es independiente de la unidad guardada.
- Multimoneda: cada grupo tiene una moneda de liquidación. El gasto conserva importe/moneda de origen, importe convertido, moneda de liquidación, tasa decimal como string, fuente y fecha de referencia. La conversión usa solo operaciones enteras y redondeo documentado. Las participaciones convertidas se asignan con mayor resto para hacerlas sumar exactamente el total de liquidación.
- Tasa: el proveedor seleccionado se configura; se puede indicar una tasa manual. La tasa es snapshot histórica, no se actualiza al mostrar un gasto anterior.
- Límites: proveedor y conexión pueden fallar; se debe mostrar una tasa manual o fallar explícitamente, nunca asumir `1:1`. La tasa de referencia es orientativa y no ejecuta pagos.
- Compatibilidad de API: `amountMinor` del gasto/split expresa moneda de origen; `settlementAmountMinor` expresa moneda de liquidación.
