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

## 6. Integración con ChromaDB

En esta etapa conectamos la aplicación con el servidor de ChromaDB iniciado mediante Docker Compose. ChromaDB funciona como la base vectorial: recibe los chunks de los documentos junto con sus embeddings y permite recuperar los fragmentos más relacionados con una pregunta.

### Configuración

El cliente utiliza la colección `documents` y configura la distancia coseno. Los embeddings se generan previamente en la aplicación, por lo que ChromaDB no crea embeddings por su cuenta (`embeddingFunction: null`). Esto garantiza que tanto los documentos indexados como las consultas utilicen el mismo modelo definido en la sección anterior.

Con la configuración actual, Docker publica ChromaDB en el puerto `8001` del equipo y lo conecta con el puerto `8000` dentro del contenedor:

```text
localhost:8001 -> contenedor ChromaDB:8000
```

### Indexación implementada

El script `src/scripts/chroma.ts` comienza eliminando la colección anterior para que cada ejecución sea reproducible. Después procesa dos documentos:

- `DOC001`: `storage/contrato-fideicomiso.pdf`
- `DOC003`: `storage/otro-contrato.pdf`

Para cada documento se extrae el texto, se divide en chunks y se genera un embedding por chunk. ChromaDB almacena estos datos:

- `id`: identificador compuesto, por ejemplo `DOC001::7`.
- `document`: texto del chunk.
- `embedding`: vector de 384 dimensiones.
- `metadata`: `documentId`, `documentName` y `chunkIndex`.

### Consultas y permisos

Después de indexar los documentos, el script ejecuta una búsqueda semántica para la pregunta `desistir del fideicomiso`. La consulta solicita los cuatro resultados más cercanos y muestra sus documentos, chunks, distancias y similitudes.

También se ejecuta la misma búsqueda con un filtro:

```ts
where: {
  documentId: {
    $in: ["DOC001"];
  }
}
```

El filtro representa la futura validación de permisos. Aunque `DOC003` también está indexado, una consulta autorizada únicamente para `DOC001` no debe devolver ningún chunk de `DOC003`.

Finalmente, se comparan tres formulaciones de una misma intención para observar cómo cambia el ranking según la pregunta. El experimento identifica el chunk 7 como el más relevante porque contiene la información sobre la pena del 3 % y los `$5.000`.

### Archivos relacionados

- `docker-compose.yml`: levanta ChromaDB con almacenamiento persistente.
- `src/chroma/chroma.ts`: crea el cliente, define la colección y el tipo de metadata.
- `src/scripts/chroma.ts`: indexa documentos, consulta la colección y prueba el filtro por documento.
- `src/ingest/embeddings.ts`: genera los vectores que se guardan y consultan en ChromaDB.
- `src/ingest/pdf.ts`: extrae el texto de los documentos.
- `src/ingest/chunking.ts`: divide el texto en fragmentos.
- `package.json`: contiene el script `chroma` y la dependencia `chromadb`.

Para ejecutar esta etapa:

```bash
docker compose up -d chroma
npm run chroma
```

Para detener únicamente ChromaDB:

```bash
docker compose stop chroma
```

## 7. Pipeline de ingesta

La ingesta completa conecta el archivo Excel, PostgreSQL, los archivos PDF, el modelo de embeddings y ChromaDB. A diferencia del script de pruebas de la sección anterior, este pipeline procesa los documentos registrados en PostgreSQL y conserva su estado de indexación mediante la columna `indexed_at`.

### Flujo completo

```text
data/documents.xlsx
        │
        ├──► users, documents, user_documents ───► PostgreSQL
        │
        └──► por cada documento pendiente de indexar:
                │
                ├── storage/documento.pdf
                │       │
                │       └── extraer texto
                │
                ├── texto plano
                │       └── crear chunks con solapamiento
                │
                ├── chunks
                │       └── generar embeddings de 384 dimensiones
                │
                ├── vectores y metadata
                │       └── collection.upsert() ───► ChromaDB
                │
                └── actualizar indexed_at ─────────► PostgreSQL
```

### Comportamiento del pipeline

1. Lee las filas de `data/documents.xlsx` y obtiene los usuarios y documentos únicos.
2. Guarda usuarios, documentos y relaciones de permisos en PostgreSQL sin duplicar registros existentes.
3. Consulta los documentos registrados y procesa únicamente aquellos cuyo `indexed_at` sea `NULL`.
4. Extrae el texto del PDF, lo divide en chunks y genera sus embeddings.
5. Guarda cada chunk en ChromaDB mediante `upsert`, usando IDs con el formato `DOCUMENT_ID_chunkIndex`.
6. Al terminar correctamente, actualiza `documents.indexed_at` para marcar el documento como indexado.
7. Muestra un resumen de documentos indexados, documentos omitidos, chunks procesados y permisos finales.

Usar `upsert` permite volver a ejecutar la ingesta sin duplicar los chunks. Los documentos que ya tienen fecha en `indexed_at` se omiten en ejecuciones posteriores.

### Reinicio completo

El argumento `--reset` elimina la colección de ChromaDB y limpia `indexed_at` en PostgreSQL. De esta forma, la siguiente ejecución vuelve a procesar todos los documentos:

```bash
npm run ingest -- --reset
```

### Ejecución normal

```bash
npm run ingest
```

### Archivos relacionados

- `src/ingest/ingest.ts`: coordina el pipeline completo.
- `src/ingest/excel.ts`: lee las filas del archivo Excel.
- `src/ingest/pdf.ts`: extrae texto de los documentos PDF.
- `src/ingest/chunking.ts`: divide el texto en chunks.
- `src/ingest/embeddings.ts`: genera los vectores.
- `src/chroma/chroma.ts`: configura la colección de ChromaDB.
- `src/db/schema.sql`: define `indexed_at` y las tablas de PostgreSQL.
- `package.json`: contiene el script `ingest`.

## 8. RAG: pregunta, embeddings y búsqueda con permisos

En esta etapa se integra el flujo RAG completo de recuperación. El sistema recibe una pregunta, la transforma en un embedding, consulta la base vectorial ChromaDB y recupera los chunks más relevantes sin exponer documentos que el usuario no tiene autorizados.

La generación de la respuesta todavía no forma parte de este stage. Actualmente se implementa la fase de retrieval, que prepara el contexto que posteriormente utilizará el modelo generativo.

### Flujo de recuperación

1. El usuario realiza una pregunta en lenguaje natural.
2. PostgreSQL obtiene los documentos permitidos para el usuario mediante la tabla `user_documents`.
3. La pregunta se convierte en un embedding usando el mismo modelo empleado durante la indexación.
4. ChromaDB busca los chunks más similares aplicando un filtro por `documentId`.
5. El resultado devuelve el documento, el índice del chunk, su texto y la distancia calculada.

La búsqueda no se realiza si el usuario no tiene documentos autorizados. En ese caso, el resultado es una lista vacía y ChromaDB ni siquiera se consulta.

### Ejemplo de permisos

```text
USR001 -> DOC001, DOC002
USR002 -> DOC003
USR999 -> ningún documento
```

Para `USR001`, ChromaDB recibe únicamente `DOC001` y `DOC002` en el filtro. Aunque `DOC003` esté indexado, ningún chunk de ese documento puede aparecer en los resultados autorizados.

Para `USR999`, PostgreSQL devuelve una lista vacía y no se ejecuta ninguna consulta contra ChromaDB.

### Distancia, similitud y orden de resultados

Antes de interpretar los resultados, hay que revisar el nombre del campo que devuelve la biblioteca:

- `distance` o `dist`: un valor menor significa que el resultado está más cerca de la pregunta.
- `score`, `similarity` o `certainty`: un valor mayor significa que el resultado es más relevante.

En este proyecto ChromaDB devuelve `distance` porque la colección utiliza la métrica coseno. Por eso los resultados deben ordenarse de menor a mayor distancia. La similitud equivalente puede expresarse como `1 - distance`, pero el ranking se basa en la distancia que devuelve ChromaDB.

### Validación con un caso obvio

Para comprobar que el ranking funciona, se utiliza una pregunta cuya respuesta conocemos de antemano:

```text
Pregunta: ¿Qué debo pagar si quiero desistir de mi fideicomiso?
```

El chunk que contiene la pena convencional debe aparecer entre los primeros resultados. En las pruebas actuales, el chunk 7 contiene la información de la pena del 3 % y los `$5.000`, por lo que debe quedar por encima de fragmentos irrelevantes. Esta comprobación sencilla ayuda a detectar rápidamente un modelo, una métrica o un ordenamiento configurado incorrectamente.

### No interpretar el valor absoluto

El número de `distance`, `similarity`, `score` o `certainty` no representa necesariamente un porcentaje de coincidencia. Un valor como `0.51` no significa que exista un 51 % de coincidencia.

El valor absoluto depende del modelo de embeddings, el idioma, la métrica y el conjunto de documentos. Lo importante es comparar el orden relativo de los resultados dentro de la misma consulta.

### Archivos relacionados

- `src/scripts/retrieval.ts`: ejecuta las pruebas de recuperación para `USR001`, `USR002` y `USR999`.
- `src/services/user.service.ts`: obtiene desde PostgreSQL los documentos autorizados para cada usuario.
- `src/services/rag.service.ts`: genera el embedding de la pregunta y consulta ChromaDB con el filtro de documentos.
- `src/ingest/embeddings.ts`: utiliza el mismo modelo para generar el vector de la pregunta.
- `src/chroma/chroma.ts`: proporciona la colección configurada con distancia coseno.
- `package.json`: contiene el script `retrieval`.

Para ejecutar esta etapa:

```bash
npm run retrieval
```

La consulta sin filtro que aparece en el script es únicamente una demostración del riesgo: permite observar qué documentos podrían filtrarse si se olvidaran los permisos. La búsqueda real debe obtener primero los documentos permitidos desde PostgreSQL y aplicar siempre ese filtro en ChromaDB.

## 9. RAG híbrido: documentos y datos de una API

El siguiente stage combina dos fuentes de información para responder preguntas que no pueden resolverse utilizando únicamente documentos o únicamente datos operativos:

- **ChromaDB** aporta el conocimiento semántico del contrato, por ejemplo la regla que indica una pena convencional del 3 % y `$5.000` de gastos.
- **La API** aporta datos actuales del fideicomiso, por ejemplo el saldo, el estado y la fecha de apertura de un usuario.

La respuesta se construye combinando ambas fuentes. En este ejemplo, el documento explica qué cálculo debe realizarse y la API proporciona el saldo sobre el que se aplica:

```text
Contrato: pena del 3 % del saldo + $5.000 de gastos
API:      saldo de USR001 = 12.000.000 COP
Resultado: 360.000 COP + 5.000 COP de gastos
```

Ninguna fuente por separado puede responder completamente esta pregunta: el contrato contiene la regla de negocio, pero no necesariamente el saldo actual; la API contiene el saldo, pero no explica la penalización contractual.

### Cliente de la API

El servicio `getTrusts` consulta el endpoint `GET /mock/trust/:userId` usando el usuario recibido. La URL base se configura mediante `API_BASE_URL` y, si no existe, utiliza `http://localhost:3000`.

La petición tiene un tiempo máximo de espera de tres segundos. Si el endpoint devuelve un estado distinto de `2xx` o no responde, el servicio devuelve `null` y registra el error sin interrumpir todo el proceso.

### Casos probados

El script prueba tres usuarios:

```text
USR001 -> devuelve el fideicomiso FID001
USR002 -> devuelve el fideicomiso FID002
USR999 -> devuelve null porque no existe información
```

El endpoint mock expone datos de prueba para `USR001` y `USR002`. Para otros usuarios responde con `404`.

### Archivos relacionados

- `src/services/trusts.service.ts`: consulta el fideicomiso de un usuario mediante HTTP.
- `src/scripts/trusts.ts`: prueba la API con varios usuarios y combina el saldo con la regla del contrato.
- `src/routes/mockApi.routes.ts`: expone el endpoint mock `GET /mock/trust/:userId`.
- `src/server.ts`: inicia el servidor Express y registra la ruta `/mock`.
- `package.json`: contiene el script `trusts` y el script `dev`.

### Ejecución

En una terminal, inicia el servidor:

```bash
npm run dev
```

En otra terminal, ejecuta las consultas:

```bash
npm run trusts
```

El servidor queda disponible por defecto en `http://localhost:3000`. La comprobación de salud está disponible en:

```text
http://localhost:3000/health
```

También se puede consultar directamente el endpoint mock:

```text
http://localhost:3000/mock/trust/USR001
```

Este stage todavía no genera una respuesta final con un modelo de lenguaje. Actualmente demuestra la integración de contexto documental y datos externos, que posteriormente serán entregados al modelo generativo como contexto para construir la respuesta al usuario.

## 10. El LLM

En esta etapa se incorpora un modelo de lenguaje para generar la respuesta final a partir del contexto recuperado. El modelo utilizado es `claude-haiku-4-5`, consumido mediante el SDK oficial `@anthropic-ai/sdk`.

El flujo RAG completo queda así:

```text
Pregunta del usuario
  │
  ├──► PostgreSQL: documentos permitidos
  │
  ├──► ChromaDB: chunks relevantes con filtro de permisos
  │
  ├──► API: datos actuales del fideicomiso
  │
  └──► Prompt: documentos + datos de API + pregunta
       │
       ▼
        Claude Haiku
       │
       ▼
     Respuesta en español
```

### Flujo implementado

El script `src/scripts/llm.ts` ejecuta los siguientes pasos:

1. Obtiene desde PostgreSQL los documentos autorizados para el usuario.
2. Busca en ChromaDB los cuatro chunks más relevantes, aplicando el filtro de permisos.
3. Consulta mediante la API la información actual del fideicomiso del usuario.
4. Construye un prompt con los chunks recuperados, los datos del fideicomiso y la pregunta original.
5. Envía el prompt a Claude y muestra la respuesta generada.

El prompt separa la información en tres bloques:

- `CONTEXT`: fragmentos de los documentos, con el nombre del documento y el índice del chunk.
- `TRUST DATA`: identificador, estado, saldo y fecha de apertura del fideicomiso.
- `USER QUESTION`: pregunta original del usuario.

### Reglas del modelo

El mensaje de sistema indica al modelo que debe:

- responder únicamente con la información recibida en el contexto;
- indicar `No encuentro esa información en tus documentos` cuando el contexto sea insuficiente;
- no inventar números, fechas límite ni condiciones;
- citar el documento utilizado entre paréntesis;
- realizar cálculos cuando los datos del fideicomiso lo permitan;
- responder en español, de forma breve y en un máximo de seis líneas.

La respuesta se extrae únicamente de los bloques de texto devueltos por la API. Si el modelo devuelve una negativa explícita, se muestra un mensaje genérico de imposibilidad de respuesta.

### Ejemplo de cálculo con contexto mixto

La pregunta por el desistimiento del fideicomiso requiere combinar dos fuentes:

```text
Documento: pena convencional del 3 % del saldo + $5.000 de gastos
API:       saldo de USR001 = 12.000.000 COP
LLM:       3 % de 12.000.000 = 360.000 COP
     360.000 + 5.000 = 365.000 COP
```

El documento aporta la regla del cálculo y la API aporta el saldo actual. El LLM puede explicar el resultado porque recibe ambas piezas dentro del mismo prompt.

### Configuración y ejecución

La llamada utiliza el modelo `claude-haiku-4-5` con un máximo de `4000` tokens de salida. Es necesario configurar `ANTHROPIC_API_KEY` como variable de entorno antes de ejecutar el script.

Para ejecutar la pregunta por defecto con `USR001`:

```bash
npm run llm
```

También se pueden enviar el usuario y la pregunta como argumentos:

```bash
npm run llm -- USR002 "¿Cuál es el estado de mi fideicomiso?"
```

Si `ANTHROPIC_API_KEY` no está configurada, el script ejecuta igualmente la recuperación y muestra el prompt completo, pero no realiza la llamada al modelo.

### Importante: coste y tokens

Con `claude-haiku-4-5`, el coste estimado de esta consulta es menor de un cuarto de centavo: aproximadamente 425 preguntas por dólar. Si se hubiera utilizado un modelo con precios de `5 USD` por millón de tokens de entrada y `25 USD` por millón de tokens de salida, como el escenario de Opus considerado, la misma pregunta habría costado aproximadamente `0,0117 USD`, cerca de cinco veces más. Para este caso de uso, Haiku ofrece una respuesta suficiente con un coste mucho menor.

En la prueba se utilizaron aproximadamente `1.291` tokens de entrada y `211` tokens de salida. La entrada domina el coste porque contiene principalmente los cuatro chunks recuperados y enviados al prompt. Reducir la cantidad de chunks, o su tamaño, puede disminuir casi proporcionalmente el coste y también la latencia. Esta es una de las principales palancas de ahorro en un sistema RAG.

Los embeddings no generan un coste de API en esta implementación porque el modelo se ejecuta localmente. Si posteriormente se utiliza un proveedor externo para embeddings, cada pregunta y cada documento indexado podrían tener un coste adicional de vectorización.

El servicio registra los tokens de entrada y salida devueltos por Anthropic para poder controlar el consumo a medida que crezca el sistema. Las cifras anteriores son una estimación de la prueba y deben recalcularse si cambian el modelo, sus precios, la cantidad de chunks o el tamaño del prompt.

### Archivos relacionados

- `src/services/llm.service.ts`: construye el prompt y llama a Anthropic.
- `src/scripts/llm.ts`: coordina permisos, retrieval, datos de API y generación de respuesta.
- `src/services/rag.service.ts`: obtiene los chunks filtrados desde ChromaDB.
- `src/services/trusts.service.ts`: obtiene los datos actuales del fideicomiso.
- `src/services/user.service.ts`: obtiene los documentos permitidos desde PostgreSQL.
- `package.json`: contiene el script `llm` y la dependencia `@anthropic-ai/sdk`.

## 11. API de chat y respuesta estructurada

Este último commit agrega la capa de exposición HTTP para que la aplicación pueda responder preguntas reales desde un cliente o un frontend. La diferencia clave con la etapa anterior es que ya no solo se ejecuta una prueba desde consola; ahora existe una ruta HTTP que acepta el `userId` y el `message`, ejecuta el flujo completo de RAG y devuelve una respuesta estructurada.

### Flujo del endpoint

```text
Cliente HTTP
   │
   ├── POST /api/chat
   │       body: { userId, message }
   │
   ├── chat(userId, question)
   │       ├── PostgreSQL: usuarios y documentos permitidos
   │       ├── ChromaDB: chunks semánticos filtrados por permisos
   │       ├── API mock: datos del fideicomiso del usuario
   │       ├── Prompt: contexto + trust data + pregunta
   │       └── Claude Haiku: respuesta final
   │
   └── JSON: { answer, sources }
```

### Rutas y servicios

El punto de entrada es `src/routes/chat.routes.ts`. La ruta expone este endpoint:

```http
POST /api/chat
Content-Type: application/json
```

Payload esperado:

```json
{
  "userId": "USR001",
  "message": "¿Qué debo pagar si quiero desistir de mi fideicomiso?"
}
```

La ruta valida que `userId` y `message` sean cadenas no vacías; si la validación falla, responde con un error `400`. Si la operación interna falla, devuelve `500`.

La lógica principal vive en `src/services/chat.service.ts` y hace este flujo:

1. obtiene los documentos autorizados para el usuario con `getUserDocuments(userId)`;
2. ejecuta la recuperación vectorial con `getChunks(question, documentIds)`;
3. consulta la información del fideicomiso con `getTrusts(userId)`;
4. si no existen chunks ni datos de confianza, devuelve un mensaje seguro de ausencia de información;
5. arma el prompt con `buildPrompt(question, chunks, trusts)`;
6. ejecuta `generateResponse(prompt)`;
7. devuelve la respuesta junto con las fuentes utilizadas.

### Respuesta estructurada

La salida final tiene la siguiente forma:

```json
{
  "answer": "El cálculo se hace sobre el saldo actual del fideicomiso. Con un saldo de 12.000.000 COP, el 3% equivale a 360.000 COP y más 5.000 COP de gastos, para un total de 365.000 COP.",
  "sources": [
    {
      "documentId": "DOC001",
      "documentName": "contrato-fideicomiso.pdf",
      "chunkIndex": 7,
      "distance": 0.31
    }
  ]
}
```

Este formato es importante porque separa claramente dos capas:

- `answer`: la respuesta final en lenguaje natural para el cliente.
- `sources`: la trazabilidad de los chunks que sustentan la respuesta, con el documento, el fragmento y la distancia calculada.

### Integración en el servidor

`src/server.ts` registra la ruta bajo el prefijo `/api`:

```ts
app.use("/api", chatRoutes);
```

Además, el servidor expone el healthcheck de la aplicación en `GET /health` y mantiene la ruta `/mock` para los datos de prueba del fideicomiso. De esta forma, el backend queda listo para ser consumido por un frontend o por una API externa sin depender de ejecuciones manuales desde consola.

### Mejora de resiliencia

En el último commit también se ajusta la inicialización de Anthropic para agregar reintentos con `maxRetries: 5` en `src/services/llm.service.ts`. Esto mejora la tolerancia a fallos transitorios cuando el proveedor responde con un error temporal o una latencia alta. En un flujo de producción real, esta pequeña configuración ayuda a que la aplicación sea más robusta sin cambiar la lógica del prompt o del RAG.

### Archivos relacionados

- `src/routes/chat.routes.ts`: expone la API REST para conversar con el sistema.
- `src/services/chat.service.ts`: orquesta la recuperación, la consulta a la API mock y la generación final.
- `src/server.ts`: registra la ruta `/api` y mantiene el servicio levantado en Express.
- `src/services/llm.service.ts`: genera el prompt y ahora incluye reintentos del cliente de Anthropic.
- `src/services/rag.service.ts`: recupera los chunks relevantes.
- `src/services/trusts.service.ts`: consulta los datos actuales del fideicomiso.

### Ejecución

En una terminal, levanta el backend:

```bash
npm run dev
```

Luego puedes realizar la consulta desde cualquier cliente HTTP:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"userId":"USR001","message":"¿Qué debo pagar si quiero desistir de mi fideicomiso?"}'
```

Con esto, la aplicación ya no es solo un experimento de investigación: pasa a ser una API operativa de chat con contexto documental, permisos, datos de confianza y generación final mediante LLM.
