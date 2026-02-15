-- ============================================================
-- Скрипт исправления схемы базы данных Open WebUI
-- ============================================================
-- ВАЖНО: Перед выполнением сделайте бэкап базы!
-- Скрипт выполняется в транзакции - при ошибке всё откатится
-- ============================================================

BEGIN;

-- ============================================================
-- 0. Временно удаляем Foreign Key constraints
-- ============================================================
ALTER TABLE oauth_session DROP CONSTRAINT IF EXISTS oauth_session_user_id_fkey;

-- ============================================================
-- 1. Исправление таблицы PROMPT
--    Проблема: есть лишняя колонка id (bigint) как PK
--    Решение: удалить id, сделать command как PK
-- ============================================================

-- Удаляем старый PK constraint
ALTER TABLE prompt DROP CONSTRAINT IF EXISTS idx_16411_prompt_pkey;

-- Удаляем уникальный индекс на command (мы сделаем его PK)
DROP INDEX IF EXISTS idx_16411_prompt_command;

-- Делаем command NOT NULL
ALTER TABLE prompt ALTER COLUMN command SET NOT NULL;

-- Добавляем PK на command
ALTER TABLE prompt ADD PRIMARY KEY (command);

-- Удаляем лишнюю колонку id
ALTER TABLE prompt DROP COLUMN IF EXISTS id;

-- ============================================================
-- 2. Исправление таблицы DOCUMENT
--    Проблема: есть лишняя колонка id (bigint) как PK
--    Решение: удалить id, сделать collection_name как PK
-- ============================================================

-- Удаляем старый PK constraint
ALTER TABLE document DROP CONSTRAINT IF EXISTS idx_16406_document_pkey;

-- Удаляем уникальный индекс на collection_name
DROP INDEX IF EXISTS idx_16406_document_collection_name;

-- Делаем collection_name NOT NULL
ALTER TABLE document ALTER COLUMN collection_name SET NOT NULL;

-- Добавляем PK на collection_name
ALTER TABLE document ADD PRIMARY KEY (collection_name);

-- Удаляем лишнюю колонку id
ALTER TABLE document DROP COLUMN IF EXISTS id;

-- ============================================================
-- 3. Добавление PRIMARY KEY для таблиц без него
-- ============================================================

-- AUTH: добавляем PK на id
ALTER TABLE auth ALTER COLUMN id SET NOT NULL;
DROP INDEX IF EXISTS idx_16395_auth_id;
ALTER TABLE auth ADD PRIMARY KEY (id);

-- CHAT: добавляем PK на id
ALTER TABLE chat ALTER COLUMN id SET NOT NULL;
DROP INDEX IF EXISTS idx_16400_chat_id;
ALTER TABLE chat ADD PRIMARY KEY (id);

-- CHATIDTAG: добавляем PK на id
ALTER TABLE chatidtag ALTER COLUMN id SET NOT NULL;
DROP INDEX IF EXISTS idx_16390_chatidtag_id;
ALTER TABLE chatidtag ADD PRIMARY KEY (id);

-- FILE: добавляем PK на id
ALTER TABLE file ALTER COLUMN id SET NOT NULL;
DROP INDEX IF EXISTS idx_16462_file_id;
ALTER TABLE file ADD PRIMARY KEY (id);

-- FUNCTION: добавляем PK на id
ALTER TABLE function ALTER COLUMN id SET NOT NULL;
DROP INDEX IF EXISTS idx_16437_function_id;
ALTER TABLE function ADD PRIMARY KEY (id);

-- MEMORY: добавляем PK на id
ALTER TABLE memory ALTER COLUMN id SET NOT NULL;
DROP INDEX IF EXISTS idx_16421_memory_id;
ALTER TABLE memory ADD PRIMARY KEY (id);

-- MODEL: добавляем PK на id
ALTER TABLE model ALTER COLUMN id SET NOT NULL;
DROP INDEX IF EXISTS idx_16426_model_id;
ALTER TABLE model ADD PRIMARY KEY (id);

-- TOOL: добавляем PK на id
ALTER TABLE tool ALTER COLUMN id SET NOT NULL;
DROP INDEX IF EXISTS idx_16432_tool_id;
ALTER TABLE tool ADD PRIMARY KEY (id);

-- USER: добавляем PK на id
ALTER TABLE "user" ALTER COLUMN id SET NOT NULL;
DROP INDEX IF EXISTS idx_16416_user_id;
ALTER TABLE "user" ADD PRIMARY KEY (id);

-- ============================================================
-- 4. Восстанавливаем Foreign Key constraints
-- ============================================================
ALTER TABLE oauth_session
    ADD CONSTRAINT oauth_session_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES "user"(id);

COMMIT;

-- ============================================================
-- Проверка после изменений (вне транзакции)
-- ============================================================
\echo ''
\echo '=== Структура prompt после изменений ==='
\d prompt

\echo ''
\echo '=== Структура document после изменений ==='
\d document

\echo ''
\echo '=== Проверка PRIMARY KEY для всех таблиц ==='
SELECT
    tc.table_name,
    tc.constraint_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_name IN ('prompt', 'document', 'auth', 'chat', 'chatidtag', 'file', 'function', 'memory', 'model', 'tool', 'user')
ORDER BY tc.table_name;

\echo ''
\echo '=== Проверка Foreign Keys ==='
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';

\echo ''
\echo 'Все изменения успешно применены!'
