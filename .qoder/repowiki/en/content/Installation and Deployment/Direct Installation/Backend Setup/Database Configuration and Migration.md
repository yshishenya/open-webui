# Database Configuration and Migration

<cite>
**Referenced Files in This Document**   
- [config.py](file://backend/open_webui/config.py)
- [env.py](file://backend/open_webui/env.py)
- [db.py](file://backend/open_webui/internal/db.py)
- [alembic.ini](file://backend/open_webui/alembic.ini)
- [env.py](file://backend/open_webui/migrations/env.py)
- [util.py](file://backend/open_webui/migrations/util.py)
- [001_initial_schema.py](file://backend/open_webui/internal/migrations/001_initial_schema.py)
- [7e5b5dc7342b_init.py](file://backend/open_webui/migrations/versions/7e5b5dc7342b_init.py)
</cite>

## Table of Contents
1. [Database Configuration](#database-configuration)
2. [Migration System Architecture](#migration-system-architecture)
3. [Database Initialization Process](#database-initialization-process)
4. [Running Migrations](#running-migrations)
5. [Migration File Structure and Evolution](#migration-file-structure-and-evolution)
6. [Common Issues and Troubleshooting](#common-issues-and-troubleshooting)
7. [Migration Rollback Procedures](#migration-rollback-procedures)

## Database Configuration

The open-webui application provides flexible database configuration through both environment variables and the config.py file. The primary configuration is managed in the env.py file, which handles database connection settings and pool parameters.

Database connection settings can be configured through environment variables or directly in the application configuration. The main database URL is set using the DATABASE_URL environment variable, with a default value of sqlite:///{DATA_DIR}/webui.db for SQLite databases. For PostgreSQL connections, the URL should follow the format: postgresql://username:password@host:port/database_name.

Key database configuration parameters include:
- DATABASE_URL: Complete database connection string
- DATABASE_TYPE: Type of database (postgresql, sqlite, etc.)
- DATABASE_USER: Database username
- DATABASE_PASSWORD: Database password
- DATABASE_HOST: Database server host
- DATABASE_PORT: Database server port
- DATABASE_NAME: Name of the database

Connection pool settings are also configurable:
- DATABASE_POOL_SIZE: Number of connections to maintain in the pool
- DATABASE_POOL_MAX_OVERFLOW: Maximum number of connections to create beyond the pool size
- DATABASE_POOL_TIMEOUT: Timeout for acquiring a connection from the pool
- DATABASE_POOL_RECYCLE: Time after which connections are recycled
- DATABASE_ENABLE_SQLITE_WAL: Enable SQLite Write-Ahead Logging for better concurrency

The configuration also supports SQLCipher for encrypted SQLite databases, requiring the DATABASE_PASSWORD environment variable when using the sqlite+sqlcipher:// protocol.

**Section sources**
- [env.py](file://backend/open_webui/env.py#L272-L352)
- [db.py](file://backend/open_webui/internal/db.py#L80-L145)

## Migration System Architecture

The open-webui project implements a dual migration system using both Peewee migrations for initial schema setup and Alembic for ongoing database evolution. This architecture supports both SQLite and PostgreSQL databases while maintaining schema consistency across different database backends.

The migration system consists of two distinct directories:
1. internal/migrations: Contains Peewee-based migrations for core schema initialization
2. migrations/versions: Contains Alembic-based migrations for application-level changes

The internal/migrations directory contains numbered Python files (001_initial_schema.py, 002_add_local_sharing.py, etc.) that define the initial database schema and early migrations. These migrations use Peewee's migration framework and are primarily focused on establishing the core data model.

The migrations/versions directory contains Alembic revision files with UUID-style names (7e5b5dc7342b_init.py, 018012973d35_add_indexes.py, etc.) that manage ongoing schema changes. Alembic provides more sophisticated migration capabilities, including autogeneration of migration scripts based on model changes.

The system automatically handles the transition between these two migration systems, ensuring that Peewee migrations are applied first, followed by Alembic migrations. This approach allows for a smooth evolution from the initial schema to the current database structure while maintaining backward compatibility.

```mermaid
graph TD
A[Application Start] --> B[Check DATABASE_URL]
B --> C{Database Type}
C --> |SQLite| D[Initialize SQLite Connection]
C --> |PostgreSQL| E[Initialize PostgreSQL Connection]
D --> F[Run Peewee Migrations]
E --> F
F --> G[Run Alembic Migrations]
G --> H[Database Ready]
```

**Diagram sources **
- [db.py](file://backend/open_webui/internal/db.py#L55-L80)
- [config.py](file://backend/open_webui/config.py#L53-L70)

**Section sources**
- [db.py](file://backend/open_webui/internal/db.py#L53-L80)
- [config.py](file://backend/open_webui/config.py#L53-L70)

## Database Initialization Process

The database initialization process in open-webui follows a specific sequence to ensure proper setup and migration application. When the application starts, it automatically handles database creation and migration through a well-defined process.

The initialization begins with the detection and configuration of the database backend. The system checks for the presence of a DATABASE_URL environment variable, defaulting to a SQLite database in the data directory if not specified. For PostgreSQL connections, the URL must include the username, password, host, port, and database name.

During initialization, the system performs several key operations:
1. Database type detection and connection string normalization
2. Creation of the data directory if it doesn't exist
3. Migration of legacy database files (e.g., ollama.db to webui.db)
4. Configuration of connection pool parameters
5. Setup of database-specific options (e.g., WAL mode for SQLite)

The initialization process also handles special cases such as encrypted databases using SQLCipher, requiring the DATABASE_PASSWORD environment variable. For PostgreSQL connections, the system automatically converts postgres:// URLs to the standard postgresql:// format.

After the database connection is established, the system applies migrations in a specific order: first the Peewee migrations from the internal/migrations directory, followed by Alembic migrations from the migrations/versions directory. This ensures that the core schema is properly established before applying application-level changes.

**Section sources**
- [env.py](file://backend/open_webui/env.py#L272-L352)
- [db.py](file://backend/open_webui/internal/db.py#L53-L80)

## Running Migrations

Migrations in open-webui are automatically executed when the application starts, ensuring that the database schema is always up-to-date. The migration process is handled by the run_migrations() function in config.py, which uses Alembic to apply pending migrations.

To manually run migrations, you can use the Alembic command-line interface. First, ensure you're in the backend directory and have the required dependencies installed. Then, you can use the following commands:

```bash
# Check current migration status
alembic current

# Show available migrations
alembic branches

# Upgrade to the latest migration
alembic upgrade head

# Downgrade to a previous migration
alembic downgrade -1

# Generate a new migration script
alembic revision --autogenerate -m "description of changes"
```

The migration process is configured in the alembic.ini file, which specifies the script location as "migrations" and sets up logging configuration. The migrations/env.py file contains the runtime environment configuration, including database connection setup and target metadata.

When running migrations, Alembic compares the current database schema with the expected schema defined in the application models. If differences are detected, Alembic generates the necessary SQL commands to bring the database up-to-date. The system uses the get_existing_tables() utility function to check for existing tables before creating new ones, preventing "relation already exists" errors.

For production environments, it's recommended to run migrations during maintenance windows and to backup the database before applying significant schema changes. The system supports both online and offline migration modes, with online mode being the default for normal operation.

**Section sources**
- [config.py](file://backend/open_webui/config.py#L53-L70)
- [alembic.ini](file://backend/open_webui/alembic.ini#L1-L115)
- [env.py](file://backend/open_webui/migrations/env.py#L1-L109)

## Migration File Structure and Evolution

The migration files in open-webui follow a structured format that evolves the database schema over time. The system uses two types of migration files: Peewee migrations in the internal/migrations directory and Alembic revisions in the migrations/versions directory.

Peewee migration files (e.g., 001_initial_schema.py) use a Python-based approach with decorator functions to define schema changes. These files contain migrate() and rollback() functions that specify the operations to apply and revert. The initial schema migration creates core tables like auth, chat, document, and user, with different field types for SQLite and external databases.

Alembic migration files (e.g., 7e5b5dc7342b_init.py) follow a standard revision format with upgrade() and downgrade() functions. Each file includes metadata such as revision ID, creation date, and dependencies. The upgrade() function contains the operations to apply the migration, while downgrade() specifies how to revert it.

Key aspects of migration file structure:
- Revision identifiers using UUIDs for uniqueness
- Conditional table creation using get_existing_tables()
- Use of custom JSONField for storing structured data
- Support for database-specific SQL dialects
- Proper constraint and index management

The migration evolution shows a progression from basic schema elements to more complex features:
1. Initial schema with core entities (users, chats, documents)
2. Addition of metadata fields (created_at, updated_at)
3. Introduction of new entity types (functions, tools, models)
4. Schema refinements and performance optimizations
5. Addition of specialized tables (billing, OAuth sessions)

Each migration file represents a discrete change to the database schema, allowing for precise tracking of database evolution and facilitating rollback when necessary.

```mermaid
flowchart TD
A[001_initial_schema.py] --> B[Add core tables]
B --> C[002_add_local_sharing.py]
C --> D[Add sharing functionality]
D --> E[003_add_auth_api_key.py]
E --> F[Add API key authentication]
F --> G[...]
G --> H[018_add_function_is_global.py]
H --> I[Add global function support]
I --> J[7e5b5dc7342b_init.py]
J --> K[Initialize Alembic migrations]
K --> L[Subsequent Alembic revisions]
L --> M[Add indexes, optimize schema]
```

**Diagram sources **
- [001_initial_schema.py](file://backend/open_webui/internal/migrations/001_initial_schema.py#L1-L255)
- [7e5b5dc7342b_init.py](file://backend/open_webui/migrations/versions/7e5b5dc7342b_init.py#L1-L205)

**Section sources**
- [001_initial_schema.py](file://backend/open_webui/internal/migrations/001_initial_schema.py#L1-L255)
- [7e5b5dc7342b_init.py](file://backend/open_webui/migrations/versions/7e5b5dc7342b_init.py#L1-L205)

## Common Issues and Troubleshooting

Several common issues may arise when configuring and migrating the open-webui database. Understanding these issues and their solutions can help maintain a stable database environment.

**Migration Conflicts**: When multiple migrations attempt to modify the same table or column, conflicts can occur. To resolve this:
- Ensure only one migration modifies a specific schema element
- Use alembic branches to manage parallel development
- Manually resolve conflicts by editing migration files
- Test migrations thoroughly in a development environment

**Database Connection Timeouts**: These typically occur when the application cannot establish a connection to the database server. Solutions include:
- Verify database server is running and accessible
- Check network connectivity between application and database
- Adjust DATABASE_POOL_TIMEOUT value if connections are timing out
- Ensure correct credentials and connection parameters

**Schema Version Mismatches**: When the database schema version doesn't match the application expectations:
- Run alembic current to check the current revision
- Use alembic upgrade head to apply pending migrations
- Verify that all migration files are present and correctly ordered
- Check for manual schema changes that bypass migrations

**"Relation Already Exists" Errors**: These occur when attempting to create tables that already exist:
- The system uses get_existing_tables() to check for existing tables
- Ensure migration scripts are idempotent (can be run multiple times safely)
- Use conditional creation statements (IF NOT EXISTS)
- Verify that the alembic_version table is properly maintained

**PostgreSQL-Specific Issues**:
- Ensure the postgresql:// protocol is used instead of postgres://
- Verify that the database user has appropriate permissions
- Check that the database schema (if specified) exists and is accessible
- Ensure proper SSL configuration if connecting to remote servers

For troubleshooting, enable detailed logging by setting the DB_LOG_LEVEL environment variable to DEBUG. This provides insight into the migration process and database operations.

**Section sources**
- [util.py](file://backend/open_webui/migrations/util.py#L1-L16)
- [env.py](file://backend/open_webui/migrations/env.py#L66-L88)
- [db.py](file://backend/open_webui/internal/db.py#L55-L80)

## Migration Rollback Procedures

Safe migration rollback is critical for maintaining data integrity when issues arise. The open-webui migration system provides mechanisms for both automated and manual rollback procedures.

For Alembic-based migrations, use the downgrade command to revert changes:
```bash
# Roll back to the previous migration
alembic downgrade -1

# Roll back to a specific revision
alembic downgrade 7e5b5dc7342b

# Roll back to the beginning
alembic downgrade base
```

Before performing any rollback operation:
1. Backup the database to prevent data loss
2. Verify the current migration state with alembic current
3. Review the downgrade() function in the migration file
4. Test the rollback in a staging environment

The system's migration files include downgrade() functions that specify how to revert each change. For example, the 7e5b5dc7342b_init.py migration includes a downgrade() function that drops all tables created by the upgrade() function.

For Peewee migrations, rollback is handled through the rollback() function in each migration file. The initial schema migration, for example, removes all tables in reverse order of creation.

When rolling back multiple migrations:
- Perform rollbacks one at a time to monitor the process
- Verify database integrity after each step
- Check application functionality after each rollback
- Document the rollback process for future reference

In cases where standard rollback procedures fail:
- Restore from a recent backup
- Manually correct schema inconsistencies
- Reapply migrations in the correct order
- Consult the migration history in the alembic_version table

Always ensure that rollback procedures are tested in a non-production environment before applying them to production databases.

**Section sources**
- [7e5b5dc7342b_init.py](file://backend/open_webui/migrations/versions/7e5b5dc7342b_init.py#L190-L205)
- [001_initial_schema.py](file://backend/open_webui/internal/migrations/001_initial_schema.py#L237-L255)