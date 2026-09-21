--Users
create table if not exists users (
    id text primary key, --USR001
    name text not null
);

-- Documents availables
create table if not exists documents (
    id text primary key, --DOC001
    name text not null,
    path text not null,
    indexed_at timestamp
);

-- Who can see which documents
create table if not exists user_documents (
    user_id text not null references users(id) on delete cascade,
    document_id text not null references documents(id) on delete cascade,
    primary key (user_id, document_id)
);