# Inicializacion imagen ChromaDB

## 1. Objetivo

Crear el archivo docker para levantar nuestro servicio de conexion a chromaDB, este sera fundamental para
poder conectarnos a la base de datos vectorial

```yml
name: ragchatbot

services:
  chroma:
    image: chromadb/chroma:1.5.9
    container_name: ragchatbot_chroma
    restart: unless-stopped
    environment:
      IS_PERSISTENT: "TRUE"
      PERSIST_DIRECTORY: "/data"
      ANONYMIZED_TELEMETRY: "TRUE"
    ports:
      - "8001:8000"
    volumes:
      - chroma-data:/data

volumes:
  chroma-data:
```

## 2. Ejecución

```bash
# En la raíz del repositorio
docker compose up -d
docker compose ps

docker compose stop chroma ## Detendra el contenedor
```
