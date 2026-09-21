# Apuntes y notas

## 0. Inicialización de Docker, PostgreSQL y ChromaDB

La aplicación utiliza dos bases de datos con responsabilidades diferentes: PostgreSQL controla los usuarios y sus permisos, mientras que ChromaDB almacena el conocimiento vectorial para realizar búsquedas por significado.

```text
┌─────────────────────────┐     ┌─────────────────────────┐
│   PostgreSQL :5432      │     │    ChromaDB :8001       │
│                         │     │                         │
│  ¿QUIÉN puede ver QUÉ?  │     │   ¿QUÉ DICE el texto?   │
│                         │     │                         │
│  Búsqueda EXACTA        │     │  Búsqueda por SIGNIFICADO│
│  "dame las filas donde  │     │  "dame lo más parecido  │
│   user_id = 'USR001'"   │     │   a esta idea"          │
│                         │     │                         │
│  Respuesta: sí/no       │     │  Respuesta: ranking     │
└─────────────────────────┘     └─────────────────────────┘
         SEGURIDAD                      CONOCIMIENTO
```

### Servicios

| Servicio   | Puerto | Responsabilidad                                   |
| ---------- | -----: | ------------------------------------------------- |
| PostgreSQL | `5432` | Usuarios, documentos y permisos de acceso         |
| ChromaDB   | `8001` | Búsqueda semántica y almacenamiento de embeddings |

Para iniciar los servicios desde la raíz del proyecto:

```bash
docker compose up -d
docker compose ps
```

ChromaDB queda disponible en `http://localhost:8001`.

Para detener los servicios:

```bash
docker compose stop
```

## 1. Creación y población de la base de datos PostgreSQL

Se crea el esquema de PostgreSQL con las tablas `users`, `documents` y `user_documents`. Después se insertan los datos iniciales y se muestra qué documentos puede consultar cada usuario.

### Archivos relacionados

- `src/db/postgres.ts`: configura el pool de conexiones y las consultas.
- `src/db/schema.sql`: define las tablas y sus relaciones.
- `src/db/setup.ts`: crea la base de datos, las tablas y los datos iniciales.
- `package.json`: contiene el script de configuración.

Para ejecutar la configuración:

```bash
npm run db:setup
```

## 2. Generación y lectura del archivo Excel

Para preparar datos de prueba, se genera un archivo Excel con la estructura que se utilizará posteriormente durante la ingesta. Después se puede leer su contenido desde la aplicación.

### Archivos relacionados

- `src/ingest/excel.ts`: contiene la lógica de trabajo con archivos Excel.
- `src/scripts/generate-excel.ts`: genera el archivo de prueba.
- `src/scripts/read-excel.ts`: lee y muestra los datos del archivo.
- `package.json`: contiene los scripts de generación y lectura.

Para generar y leer el archivo:

```bash
npm run excel:generate
npm run excel:read
```
