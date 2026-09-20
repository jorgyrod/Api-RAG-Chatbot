# Apuntes/Notas

Iniciaremos creando o conectandonos a las respectivas bases de datos, en este caso utilizaremos PostgreSQL y ChromaDB

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
