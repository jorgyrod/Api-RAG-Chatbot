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

## 3. Lectura de PDF's

Para validar que efectivamente estamos leyendo los archivos contaremos con 3 archivos de prueba que se encontraran en el folder 'storage', estos junto
con el script creado para ver en consola que efectivamente se esta extrayendo el texto de estos PDF's, son como pruebas aproximadamente.

### Archivos relacionados

- `src/ingest/pdf.ts`: contiene la lógica de trabajo con archivos PDF.
- `src/scripts/read-pdf.ts`: lee y muestra los datos del archivo.
- `package.json`: contiene los scripts lectura.

Para visualizar como funciona:

```bash
npm run pdf:read
```

## 4. Chunking

Ahora haremos el respectivo chunking o particionamiento de texto para pasarlo a nuestro modelo de embeddings posteriormente,
la estrategia a utilizar por ahora es cortar por caracteres y solapamiento, mas adelante se trabajaran otros modos de chunking

### Archivos relacionados

- `src/ingest/chunking.ts`: contiene la lógica chunking.
- `src/scripts/chunks.ts`: lee y muestra los datos despues de procesarlo por chunking
- `package.json`: contiene los scripts lectura.

Para visualizar como funciona:

```bash
npm run chunks
```

## 5. Embeddings

En esta etapa convertimos el texto en vectores numéricos para poder comparar significados. Se utiliza `@chroma-core/default-embed` con el modelo multilingüe `Xenova/paraphrase-multilingual-MiniLM-L12-v2`, adecuado para trabajar con contenido en español.

El modelo se ejecuta localmente dentro de Node.js, por lo que no requiere una API key ni llamadas a un servicio externo después de la primera descarga. Se utiliza la variante cuantizada `q8`, que ocupa aproximadamente 118 MB. Cada texto produce un vector de 384 dimensiones, sin importar si el texto es corto o largo.

### Flujo implementado

1. Se genera un embedding para una frase individual y se muestran sus dimensiones, algunos valores, su rango y su longitud.
2. Se compara una pregunta con varios textos candidatos mediante similitud coseno.
3. Se comprueba que la búsqueda encuentre significados relacionados aunque no existan exactamente las mismas palabras.
4. Se extrae el texto del contrato, se divide en chunks y se genera un vector para cada chunk.
5. Se calcula el ranking de los chunks más parecidos a la pregunta del usuario.

La similitud coseno produce valores cercanos a `1` cuando dos vectores tienen un significado similar y valores más bajos cuando el contenido está menos relacionado. Esta es la misma medida que utilizará ChromaDB para comparar los vectores almacenados.

### Archivos relacionados

- `src/ingest/embeddings.ts`: configura el modelo y expone funciones para generar embeddings individuales o por lotes.
- `src/scripts/embeddings.ts`: ejecuta las pruebas de similitud y vectoriza los chunks del contrato.
- `src/ingest/pdf.ts`: extrae el texto del PDF utilizado en la prueba.
- `src/ingest/chunking.ts`: divide el texto en chunks antes de vectorizarlo.
- `package.json`: contiene el script `embeddings` y la dependencia del modelo.

Para ejecutar la etapa:

```bash
npm run embeddings
```

La primera ejecución descarga el modelo y puede tardar más. Las siguientes ejecuciones reutilizan la descarga almacenada en la caché local.

### Reglas importantes

- El mismo modelo y la misma función deben utilizarse al indexar documentos y al realizar consultas. Si se utilizan modelos diferentes, sus vectores no serán comparables.
- En aplicaciones RAG en español conviene validar el modelo con una frase que deba acertar, otra relacionada y una frase claramente irrelevante. El contenido irrelevante debe quedar por debajo de los resultados relacionados.
