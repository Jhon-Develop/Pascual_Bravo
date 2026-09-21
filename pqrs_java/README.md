# Sistema de Gestión y Seguimiento de PQRS

Este proyecto es una solución integral desarrollada en **Java** bajo el paradigma de **Programación Orientada a Objetos (POO)**. Permite registrar, clasificar, asignar, supervisar y gestionar el ciclo de vida completo de Peticiones, Quejas, Reclamos y Sugerencias (PQRS), garantizando la trazabilidad y el cumplimiento de las reglas de negocio de la organización.

---

## 1. Estructura del Proyecto en VS Code

Crea la siguiente estructura de carpetas dentro de la carpeta `src` de tu proyecto Java en Visual Studio Code:

```text
pqrs-project/
├── README.md
└── src/
    ├── Main.java
    ├── enums/
    │   ├── EstadoPQRS.java
    │   └── TipoPQRS.java
    ├── interfaces/
    │   └── Gestionable.java
    ├── models/
    │   ├── Ciudadano.java
    │   ├── PQRS.java
    │   ├── Peticion.java
    │   ├── Queja.java
    │   ├── Reclamo.java
    │   ├── Responsable.java
    │   ├── Respuesta.java
    │   ├── Sugerencia.java
    │   └── Usuario.java
    └── services/
        └── PQRSService.java


classDiagram
    class Usuario {
        <<abstract>>
        #String identificacion
        #String nombre
        #String correo
        +obtenerRol()* String
        +getIdentificacion() String
        +getNombre() String
        +getCorreo() String
    }

    class Ciudadano {
        -String telefono
        +obtenerRol() String
        +getTelefono() String
    }

    class Responsable {
        -String area
        -boolean esSupervisor
        +obtenerRol() String
        +getArea() String
        +isEsSupervisor() boolean
    }

    class Gestionable {
        <<interface>>
        +asignarResponsable(Responsable) void
        +ponerEnGestion() void
        +registrarRespuesta(Respuesta) void
        +cerrarCaso() void
    }

    class PQRS {
        <<abstract>>
        -static int contadorRadicado
        -String radicado
        -String descripcion
        -EstadoPQRS estado
        -LocalDate fechaCreacion
        -LocalDate fechaLimite
        +getDiasMaximosRespuesta()* int
        +calcularFechaLimite() void
        +asignarResponsable(Responsable) void
        +ponerEnGestion() void
        +registrarRespuesta(Respuesta) void
        +cerrarCaso() void
    }

    class Peticion {
        +getDiasMaximosRespuesta() int
    }

    class Queja {
        +getDiasMaximosRespuesta() int
    }

    class Reclamo {
        +getDiasMaximosRespuesta() int
    }

    class Sugerencia {
        +getDiasMaximosRespuesta() int
    }

    class Respuesta {
        -String contenido
        -LocalDate fechaRespuesta
        +getContenido() String
        +getFechaRespuesta() LocalDate
        +getAutor() Responsable
    }

    class PQRSService {
        -List~PQRS~ repositorioPQRS
        +registrarPQRS(PQRS) String
        +consultarPorRadicado(String) PQRS
        +asignarResponsable(String, Responsable) void
        +pasarAGestion(String) void
        +responderPQRS(String, String, Responsable) void
        +cerrarPQRS(String) void
        +obtenerCasosVencidos() List~PQRS~
        +obtenerAlertasSupervisor() List~String~
    }

    Usuario <|-- Ciudadano : Herencia (ES-UN)
    Usuario <|-- Responsable : Herencia (ES-UN)
    Gestionable <|.. PQRS : Implementa
    PQRS <|-- Peticion : Herencia (ES-UN)
    PQRS <|-- Queja : Herencia (ES-UN)
    PQRS <|-- Reclamo : Herencia (ES-UN)
    PQRS <|-- Sugerencia : Herencia (ES-UN)
    PQRS "1" o-- "1" Ciudadano : Agregación (TIENE-UN)
    PQRS "0..1" o-- "0..1" Responsable : Agregación (TIENE-UN)
    PQRS "1" *-- "0..1" Respuesta : Composición (TIENE-UN)
    Respuesta "1" --> "1" Responsable : Generada por
    PQRSService "1" --> "*" PQRS : Administra