-- =========================================================================
-- 001 — Esquema inicial
--
-- Reparto de responsabilidades (ver Capítulo 0, §6.1):
--   PostgreSQL → fuente de verdad: quién puede ver qué, estado de ingesta.
--   ChromaDB   → índice derivado y reconstruible: vectores.
--
-- Nota sobre los tipos enumerados: usamos `text` + CHECK en lugar de los
-- tipos ENUM de PostgreSQL. Un ENUM permite añadir valores pero no eliminarlos
-- ni reordenarlos, y cambiarlo exige DDL sobre el tipo. Un CHECK se modifica
-- con un ALTER TABLE normal, se lee sin consultar el catálogo, y llega a Node
-- como un string que TypeScript puede tipar como unión literal.
-- =========================================================================


-- -------------------------------------------------------------------------
-- Función de apoyo: mantiene `updated_at` sin depender de que la aplicación
-- se acuerde. Un `UPDATE` hecho a mano desde psql también lo actualiza.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- -------------------------------------------------------------------------
-- tenants
--
-- Hoy sembramos uno solo. Existe desde el principio porque añadir tenant_id
-- a ocho tablas con datos es una migración dolorosa, y omitirlo obligaría a
-- reescribir todas las consultas de autorización más adelante.
-- -------------------------------------------------------------------------
CREATE TABLE tenants (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text        NOT NULL UNIQUE,
  name       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenants_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$')
);


-- -------------------------------------------------------------------------
-- users
--
-- `external_id` ("USR-001") es el identificador del sistema de origen, el que
-- aparece en el Excel. `id` es nuestra clave interna. Mantenerlos separados
-- evita que un cambio de formato en el sistema de RRHH rompa nuestras claves
-- foráneas.
-- -------------------------------------------------------------------------
CREATE TABLE users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  external_id   text        NOT NULL,
  email         text        NOT NULL,
  full_name     text        NOT NULL,
  password_hash text        NOT NULL,
  status        text        NOT NULL DEFAULT 'ACTIVE',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT users_status_valid CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  -- Único DENTRO del tenant, no globalmente: dos empresas distintas pueden
  -- tener cada una su "USR-001".
  CONSTRAINT users_tenant_external_id_unique UNIQUE (tenant_id, external_id)
);

-- El email se compara en minúsculas: "Juan@x.com" y "juan@x.com" son la misma
-- persona. Un UNIQUE normal dejaría crear ambas.
CREATE UNIQUE INDEX users_tenant_email_unique ON users (tenant_id, lower(email));

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -------------------------------------------------------------------------
-- groups y roles
--
-- Dos tablas casi idénticas a propósito, porque significan cosas distintas:
-- un GRUPO es una agrupación organizativa ("Clientes Premium"); un ROL es una
-- capacidad funcional ("Auditor"). Fundirlas ahorraría una tabla y costaría
-- claridad en cada conversación futura sobre permisos.
-- -------------------------------------------------------------------------
CREATE TABLE groups (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code       text        NOT NULL,
  name       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT groups_tenant_code_unique UNIQUE (tenant_id, code)
);

CREATE TABLE roles (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code       text        NOT NULL,
  name       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT roles_tenant_code_unique UNIQUE (tenant_id, code)
);

CREATE TABLE user_groups (
  user_id    uuid        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  group_id   uuid        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, group_id)
);

CREATE TABLE user_roles (
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id    uuid        NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, role_id)
);

-- El resolver de permisos parte del usuario. Sin estos índices, cada consulta
-- de chat haría un seq scan sobre las tablas de pertenencia.
CREATE INDEX user_groups_user_idx ON user_groups (user_id);
CREATE INDEX user_roles_user_idx  ON user_roles  (user_id);


-- -------------------------------------------------------------------------
-- documents
--
-- Dos campos que parecen redundantes y no lo son (mejora M7 del Capítulo 0):
--
--   active → decisión de NEGOCIO. "Este documento ya no aplica."
--   status → estado TÉCNICO de la ingesta. "No se pudo indexar."
--
-- Con un solo campo no se puede expresar "el negocio lo quiere activo pero la
-- indexación falló", que es justo el estado que hay que poder ver y arreglar.
--
-- `checksum_sha256` + `content_version` son el mecanismo de idempotencia
-- (Capítulo 0, §4.1): el checksum decide SI reprocesar, la versión permite
-- purgar los vectores antiguos de forma exacta.
-- -------------------------------------------------------------------------
CREATE TABLE documents (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  external_id     text        NOT NULL,
  name            text        NOT NULL,
  storage_path    text        NOT NULL,
  document_type   text        NOT NULL,
  active          boolean     NOT NULL DEFAULT true,

  status          text        NOT NULL DEFAULT 'PENDING',
  checksum_sha256 text,
  content_version integer     NOT NULL DEFAULT 0,
  page_count      integer,
  chunk_count     integer     NOT NULL DEFAULT 0,
  last_error      text,
  indexed_at      timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT documents_status_valid
    CHECK (status IN ('PENDING', 'PROCESSING', 'INDEXED', 'FAILED')),
  CONSTRAINT documents_type_valid
    CHECK (document_type IN ('PDF', 'DOCX')),
  CONSTRAINT documents_tenant_external_id_unique
    UNIQUE (tenant_id, external_id),
  -- Un documento INDEXED sin checksum sería un estado imposible: significaría
  -- que se indexó sin haberse leído. La base lo impide.
  CONSTRAINT documents_indexed_requires_checksum
    CHECK (status <> 'INDEXED' OR checksum_sha256 IS NOT NULL),
  CONSTRAINT documents_content_version_positive
    CHECK (content_version >= 0)
);

-- Índice del camino crítico: el resolver filtra por tenant + active + status
-- en cada petición de chat.
CREATE INDEX documents_tenant_active_status_idx
  ON documents (tenant_id, active, status);

CREATE TRIGGER documents_set_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -------------------------------------------------------------------------
-- document_grants  ← EL CORAZÓN DE LA SEGURIDAD
--
-- Sujeto polimórfico (mejora M2): una sola tabla cubre concesiones a usuario,
-- a grupo y a rol. La alternativa —tres tablas— triplicaría el resolver, que
-- es justo el código donde menos queremos complejidad.
--
-- El precio consciente: no hay clave foránea declarativa sobre `subject_id`,
-- porque apunta a tres tablas distintas. Lo compensamos con el CHECK sobre
-- `subject_type` y con tests de integridad.
--
-- La revocación es `revoked_at`, nunca DELETE (mejora M4): borrar la fila
-- destruye la evidencia de quién tuvo acceso a qué y cuándo, que es
-- exactamente lo primero que pide un auditor en un sistema de fideicomisos.
-- -------------------------------------------------------------------------
CREATE TABLE document_grants (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
  document_id  uuid        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  subject_type text        NOT NULL,
  subject_id   uuid        NOT NULL,
  permission   text        NOT NULL DEFAULT 'READ',
  granted_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz,

  CONSTRAINT document_grants_subject_type_valid
    CHECK (subject_type IN ('USER', 'GROUP', 'ROLE')),
  CONSTRAINT document_grants_permission_valid
    CHECK (permission IN ('READ')),
  CONSTRAINT document_grants_revoked_after_granted
    CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

-- Índice único PARCIAL: como máximo UNA concesión activa por
-- (documento, sujeto, permiso), pero tantas revocadas como haya habido.
-- Es lo que permite conservar el historial completo sin permitir duplicados
-- vigentes. Un UNIQUE normal impediría volver a conceder algo ya revocado.
CREATE UNIQUE INDEX document_grants_active_unique
  ON document_grants (document_id, subject_type, subject_id, permission)
  WHERE revoked_at IS NULL;

-- Índice del camino crítico del resolver: buscar por sujeto entre los
-- grants vigentes.
CREATE INDEX document_grants_subject_active_idx
  ON document_grants (subject_type, subject_id)
  WHERE revoked_at IS NULL;

CREATE INDEX document_grants_document_idx ON document_grants (document_id);


-- -------------------------------------------------------------------------
-- document_chunks  (mejora M8)
--
-- Duplica el texto que también vive en ChromaDB. Es deliberado, y compra tres
-- cosas: mostrar en el frontend el fragmento exacto que sustenta la respuesta,
-- auditar y evaluar el retrieval sin depender de Chroma, y reconstruir el
-- índice vectorial sin volver a parsear los PDFs.
--
-- `vector_id` es el puente con ChromaDB: "DOC-001::v3::0007".
-- -------------------------------------------------------------------------
CREATE TABLE document_chunks (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content_version integer     NOT NULL,
  chunk_index     integer     NOT NULL,
  page            integer     NOT NULL,
  char_start      integer     NOT NULL,
  char_end        integer     NOT NULL,
  content         text        NOT NULL,
  vector_id       text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT document_chunks_unique
    UNIQUE (document_id, content_version, chunk_index),
  CONSTRAINT document_chunks_vector_id_unique
    UNIQUE (vector_id),
  CONSTRAINT document_chunks_offsets_valid
    CHECK (char_end > char_start AND char_start >= 0),
  CONSTRAINT document_chunks_page_positive
    CHECK (page >= 1)
);

CREATE INDEX document_chunks_document_version_idx
  ON document_chunks (document_id, content_version);


-- -------------------------------------------------------------------------
-- ingestion_runs / ingestion_document_results
--
-- Un run agrupa una ejecución del job. Los resultados por documento permiten
-- responder "¿por qué DOC-007 no aparece en las búsquedas?" sin leer logs.
-- -------------------------------------------------------------------------
CREATE TABLE ingestion_runs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source      text        NOT NULL,
  status      text        NOT NULL DEFAULT 'RUNNING',
  dry_run     boolean     NOT NULL DEFAULT false,
  stats       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  error       text,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,

  CONSTRAINT ingestion_runs_status_valid
    CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
  CONSTRAINT ingestion_runs_finished_after_started
    CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE INDEX ingestion_runs_tenant_started_idx
  ON ingestion_runs (tenant_id, started_at DESC);

CREATE TABLE ingestion_document_results (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id         uuid        NOT NULL REFERENCES ingestion_runs(id) ON DELETE CASCADE,
  document_id    uuid        NOT NULL REFERENCES documents(id)      ON DELETE CASCADE,
  action         text        NOT NULL,
  chunks_indexed integer     NOT NULL DEFAULT 0,
  duration_ms    integer     NOT NULL DEFAULT 0,
  error          text,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ingestion_results_action_valid
    CHECK (action IN ('SKIPPED', 'INDEXED', 'REINDEXED', 'FAILED', 'PURGED')),
  CONSTRAINT ingestion_results_run_document_unique
    UNIQUE (run_id, document_id)
);

CREATE INDEX ingestion_results_run_idx ON ingestion_document_results (run_id);
