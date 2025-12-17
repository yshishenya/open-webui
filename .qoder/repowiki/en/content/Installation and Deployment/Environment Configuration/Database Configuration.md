# Database Configuration

<cite>
**Referenced Files in This Document**   
- [env.py](file://backend/open_webui/env.py)
- [db.py](file://backend/open_webui/internal/db.py)
- [config.py](file://backend/open_webui/config.py)
- [alembic.ini](file://backend/open_webui/alembic.ini)
- [env.py](file://backend/open_webui/migrations/env.py)
- [.env.example](file://.env.example)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Environment Variables](#environment-variables)
3. [Database Backend Configuration](#database-backend-configuration)
4. [Connection Pooling Settings](#connection-pooling-settings)
5. [SSL Configuration](#ssl-configuration)
6. [Database Examples](#database-examples)
7. [Performance and Reliability](#performance-and-reliability)
8. [Troubleshooting](#troubleshooting)
9. [Alembic Migrations](#alembic-migrations)

## Introduction
The open-webui application supports multiple database backends through configurable environment variables. The database configuration system is designed to be flexible, supporting SQLite, PostgreSQL, and other SQL databases through SQLAlchemy. The application uses Alembic for database migrations and provides comprehensive configuration options for connection pooling, SSL, and performance tuning. This document details all aspects of database configuration for the open-webui application.

## Environment Variables
The open-webui application uses several environment variables to configure database connectivity. These variables allow for flexible configuration of different database backends and connection parameters.

The primary environment variables for database configuration are:

- **DATABASE_URL**: The complete database connection URL. If not specified, defaults to a SQLite database at `sqlite:///{DATA_DIR}/webui.db`
- **DATABASE_TYPE**: The type of database (e.g., postgresql, mysql, sqlite)
- **DATABASE_USER**: The database user name
- **DATABASE_PASSWORD**: The database password
- **DATABASE_HOST**: The database host address
- **DATABASE_PORT**: The database port number
- **DATABASE_NAME**: The name of the database

When all database variables (DATABASE_TYPE, DATABASE_USER, DATABASE_PASSWORD, DATABASE_HOST, DATABASE_PORT, DATABASE_NAME) are provided, the application constructs the DATABASE_URL automatically. The application also handles the conversion from "postgres://" to "postgresql://" in connection URLs for compatibility.

Additional environment variables provide further configuration options:
- **DATABASE_SCHEMA**: Specifies a custom database schema
- **DATABASE_POOL_SIZE**: Sets the connection pool size
- **DATABASE_POOL_MAX_OVERFLOW**: Sets the maximum overflow connections
- **DATABASE_POOL_TIMEOUT**: Connection acquisition timeout in seconds
- **DATABASE_POOL_RECYCLE**: Connection recycle time in seconds
- **DATABASE_ENABLE_SQLITE_WAL**: Enables SQLite Write-Ahead Logging mode

**Section sources**
- [env.py](file://backend/open_webui/env.py#L272-L352)

## Database Backend Configuration
The open-webui application supports multiple database backends, with configuration options tailored to each database type. The application automatically handles the configuration based on the specified database type.

### SQLite Configuration
SQLite is the default database backend, with a file-based database stored in the data directory. When no DATABASE_URL is specified, the application defaults to SQLite with the database file located at `{DATA_DIR}/webui.db`.

For encrypted SQLite databases using SQLCipher, use the `sqlite+sqlcipher://` protocol in the DATABASE_URL. When using SQLCipher, the DATABASE_PASSWORD environment variable is required for database encryption.

The application automatically migrates from older Ollama-WebUI database files by renaming `ollama.db` to `webui.db` if the former exists.

### PostgreSQL Configuration
PostgreSQL is supported through the `postgresql://` protocol. The application handles both standard PostgreSQL connections and connections through SQLAlchemy. When configuring PostgreSQL, ensure the DATABASE_TYPE is set to "postgresql" and provide the appropriate host, port, username, password, and database name.

The application includes a reconnecting PostgreSQL database wrapper that handles connection failures and automatically reconnects when connections are terminated.

### MySQL Configuration
MySQL is supported through SQLAlchemy's MySQL dialect. Configure MySQL by setting DATABASE_TYPE to "mysql" and providing the appropriate connection parameters. The application uses the same connection pooling and configuration options for MySQL as it does for other database types.

**Section sources**
- [env.py](file://backend/open_webui/env.py#L272-L308)
- [db.py](file://backend/open_webui/internal/db.py#L80-L118)
- [wrappers.py](file://backend/open_webui/internal/wrappers.py#L46-L90)

## Connection Pooling Settings
The open-webui application provides comprehensive connection pooling configuration to optimize database performance and resource utilization. Connection pooling settings are configured through environment variables that control the size, behavior, and lifecycle of the connection pool.

### Pool Size Configuration
- **DATABASE_POOL_SIZE**: Sets the number of connections to maintain in the pool. If not specified, SQLAlchemy uses a default pool size. Setting this to 0 disables pooling and creates a new connection for each request.
- **DATABASE_POOL_MAX_OVERFLOW**: Sets the maximum number of connections that can be created beyond the pool size. The default is 0, meaning no overflow connections are allowed.

### Pool Behavior Settings
- **DATABASE_POOL_TIMEOUT**: The number of seconds to wait before giving up on getting a connection from the pool. The default is 30 seconds.
- **DATABASE_POOL_RECYCLE**: The number of seconds after which connections are recycled. The default is 3600 seconds (1 hour), which helps prevent issues with stale connections in long-running applications.
- **pool_pre_ping**: Enabled by default, this setting verifies the connection is still alive before using it from the pool, automatically reconnecting if necessary.

For SQLite databases, the application configures a NullPool by default, as SQLite doesn't benefit from connection pooling in the same way as client-server databases. For PostgreSQL and other client-server databases, a QueuePool is used with the specified pool settings.

```mermaid
graph TD
A[Application Request] --> B{Connection Available?}
B --> |Yes| C[Use Connection from Pool]
B --> |No| D{Below Max Overflow?}
D --> |Yes| E[Create New Connection]
D --> |No| F[Wait for Connection]
F --> G{Timeout Reached?}
G --> |Yes| H[Throw Timeout Error]
G --> |No| I[Continue Waiting]
C --> J[Execute Database Operation]
E --> J
J --> K[Return Connection to Pool]
K --> L{Recycle Time Reached?}
L --> |Yes| M[Close and Recreate Connection]
L --> |No| N[Keep Connection in Pool]
```

**Diagram sources**
- [db.py](file://backend/open_webui/internal/db.py#L129-L145)

**Section sources**
- [env.py](file://backend/open_webui/env.py#L312-L348)
- [db.py](file://backend/open_webui/internal/db.py#L129-L145)

## SSL Configuration
The open-webui application provides SSL/TLS configuration options for secure database connections. SSL settings are controlled through environment variables that enable or disable SSL verification and configure certificate validation.

### Database SSL Settings
While the primary database configuration files don't explicitly show SSL parameters for the main database connection, the application's architecture supports SSL through the underlying SQLAlchemy and database driver configurations. For PostgreSQL, SSL can be enabled by including SSL parameters in the connection URL or through environment variables specific to the psycopg2 driver.

### Application-Level SSL Verification
The application includes SSL configuration for external connections used in various features:

- **AIOHTTP_CLIENT_SESSION_SSL**: Controls SSL verification for aiohttp client sessions (default: true)
- **AIOHTTP_CLIENT_SESSION_TOOL_SERVER_SSL**: Controls SSL verification for tool server connections (default: true)
- **ENABLE_WEB_LOADER_SSL_VERIFICATION**: Controls SSL verification for web loader operations (default: true)

These settings ensure that connections to external services maintain appropriate security levels while allowing configuration for environments with custom certificate authorities or self-signed certificates.

For Oracle Autonomous Database connections, the application supports wallet-based authentication and secure connections through Oracle's native SSL/TLS implementation.

**Section sources**
- [env.py](file://backend/open_webui/env.py#L674-L708)
- [config.py](file://backend/open_webui/config.py#L2961-L2964)
- [main.py](file://backend/open_webui/main.py#L338-L339)

## Database Examples
This section provides example configurations for deploying open-webui with different database backends.

### SQLite Deployment
For a simple SQLite deployment, no additional configuration is needed as SQLite is the default database backend. The database file will be created automatically in the data directory.

```bash
# Default SQLite configuration (no environment variables needed)
# Database file: data/webui.db
```

For an encrypted SQLite database using SQLCipher:

```bash
DATABASE_URL="sqlite+sqlcipher:///data/webui.db"
DATABASE_PASSWORD="your-encryption-password"
```

### PostgreSQL Deployment
For PostgreSQL deployment, configure the connection parameters either through individual environment variables or a complete DATABASE_URL:

Using individual variables:
```bash
DATABASE_TYPE="postgresql"
DATABASE_USER="openwebui"
DATABASE_PASSWORD="secure-password"
DATABASE_HOST="localhost"
DATABASE_PORT="5432"
DATABASE_NAME="openwebui_db"
```

Using DATABASE_URL:
```bash
DATABASE_URL="postgresql://openwebui:secure-password@localhost:5432/openwebui_db"
```

### MySQL Deployment
For MySQL deployment, configure similar to PostgreSQL but with the MySQL dialect:

```bash
DATABASE_TYPE="mysql"
DATABASE_USER="openwebui"
DATABASE_PASSWORD="secure-password"
DATABASE_HOST="localhost"
DATABASE_PORT="3306"
DATABASE_NAME="openwebui_db"
```

Or using DATABASE_URL:
```bash
DATABASE_URL="mysql://openwebui:secure-password@localhost:3306/openwebui_db"
```

**Section sources**
- [env.py](file://backend/open_webui/env.py#L279-L307)
- [db.py](file://backend/open_webui/internal/db.py#L80-L118)

## Performance and Reliability
Database configuration significantly impacts the performance and reliability of the open-webui application. Proper configuration ensures optimal response times, efficient resource utilization, and high availability.

### Connection Pooling Impact
Appropriate connection pooling settings prevent connection overhead and ensure that database connections are readily available for application requests. For production deployments with high concurrency, configure:

- **DATABASE_POOL_SIZE**: Set based on expected concurrent users (e.g., 10-50 for moderate traffic)
- **DATABASE_POOL_MAX_OVERFLOW**: Allow some overflow connections for traffic spikes
- **DATABASE_POOL_RECYCLE**: Set to a value less than the database server's connection timeout to prevent stale connections

### SQLite Write-Ahead Logging
For SQLite deployments, enabling Write-Ahead Logging (WAL) mode improves concurrency by allowing multiple readers to coexist with a single writer:

```bash
DATABASE_ENABLE_SQLITE_WAL="true"
```

WAL mode reduces lock contention and improves performance in multi-user scenarios.

### Schema Configuration
Using a custom database schema (via DATABASE_SCHEMA) can help organize database objects and provide namespace isolation, particularly in shared database environments.

The application's use of connection pre-pinging (pool_pre_ping) enhances reliability by verifying connections before use, automatically reconnecting when connections have been closed by the database server.

**Section sources**
- [env.py](file://backend/open_webui/env.py#L312-L352)
- [db.py](file://backend/open_webui/internal/db.py#L119-L127)

## Troubleshooting
This section addresses common database connection issues and their solutions.

### Authentication Failures
Authentication failures typically occur due to incorrect credentials or database user configuration.

**Symptoms:**
- "Access denied" or "authentication failed" errors
- Connection refused messages

**Solutions:**
1. Verify DATABASE_USER and DATABASE_PASSWORD are correct
2. For SQLCipher databases, ensure DATABASE_PASSWORD is set when using sqlite+sqlcipher://
3. Check that the database user has appropriate permissions on the database
4. URL-encode special characters in passwords

```python
# Error raised when DATABASE_PASSWORD is missing for SQLCipher
if not database_password or database_password.strip() == "":
    raise ValueError("DATABASE_PASSWORD is required when using sqlite+sqlcipher:// URLs")
```

### Network Connectivity Problems
Network issues prevent the application from reaching the database server.

**Symptoms:**
- "Connection refused" or "timeout" errors
- Unable to reach database host

**Solutions:**
1. Verify DATABASE_HOST and DATABASE_PORT are correct
2. Check that the database server is running and accessible
3. Verify network connectivity between application and database
4. Check firewall rules allowing the database port
5. For containerized deployments, ensure proper network configuration

### Migration Errors
Migration errors occur when database schema changes cannot be applied.

**Symptoms:**
- Migration script failures
- "Table already exists" or "column not found" errors
- Version mismatch between code and database

**Solutions:**
1. Ensure the migrations directory is properly mounted/available
2. Check that the database user has DDL permissions
3. Verify the database connection is stable during migration
4. For SQLite, ensure the application has write permissions to the database file and directory

The application runs migrations automatically on startup through the run_migrations() function in config.py, which uses Alembic to upgrade the database to the latest version.

**Section sources**
- [env.py](file://backend/open_webui/env.py#L283-L291)
- [wrappers.py](file://backend/open_webui/internal/wrappers.py#L48-L53)
- [db.py](file://backend/open_webui/internal/db.py#L55-L78)
- [config.py](file://backend/open_webui/config.py#L52-L67)

## Alembic Migrations
The open-webui application uses Alembic for database schema migrations, providing a robust system for managing database schema changes across versions.

### Migration Configuration
The migration system is configured through alembic.ini and the migrations/env.py file. The alembic.ini file specifies:

- **script_location**: Set to "migrations" directory
- **prepend_sys_path**: Set to ".." to include the parent directory
- Logging configuration for migration operations

The migrations/env.py file configures the migration environment, setting the SQLAlchemy URL from the application's DATABASE_URL environment variable.

### Migration Process
The migration process is automatically executed on application startup:

1. The run_migrations() function in config.py is called
2. Alembic configuration is loaded from alembic.ini
3. The script location is set to the migrations directory
4. Alembic upgrades the database to the "head" revision

```python
def run_migrations():
    log.info("Running migrations")
    try:
        from alembic import command
        from alembic.config import Config
        
        alembic_cfg = Config(OPEN_WEBUI_DIR / "alembic.ini")
        migrations_path = OPEN_WEBUI_DIR / "migrations"
        alembic_cfg.set_main_option("script_location", str(migrations_path))
        
        command.upgrade(alembic_cfg, "head")
    except Exception as e:
        log.exception(f"Error running migrations: {e}")
```

### Migration History
The application maintains a comprehensive migration history in the backend/open_webui/migrations/versions/ directory, with numbered migration scripts that represent incremental schema changes:

- 018012973d35_add_indexes.py: Adds database indexes for performance
- 1af9b942657b_migrate_tags.py: Migrates tag data structure
- 242a2047eae0_update_chat_table.py: Updates chat table schema
- And many others representing incremental changes

Each migration script includes upgrade() and downgrade() functions to apply and reverse the schema changes, enabling safe deployment and rollback.

The application also maintains a separate set of Peewee migrations in backend/open_webui/internal/migrations/ for backward compatibility with earlier versions.

**Section sources**
- [config.py](file://backend/open_webui/config.py#L52-L67)
- [alembic.ini](file://backend/open_webui/alembic.ini)
- [env.py](file://backend/open_webui/migrations/env.py)
- [versions/](file://backend/open_webui/migrations/versions/)
- [internal/migrations/](file://backend/open_webui/internal/migrations/)