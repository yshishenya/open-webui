# Database Operations

<cite>
**Referenced Files in This Document**   
- [db.py](file://backend/open_webui/internal/db.py)
- [env.py](file://backend/open_webui/env.py)
- [alembic.ini](file://backend/open_webui/alembic.ini)
- [env.py](file://backend/open_webui/migrations/env.py)
- [util.py](file://backend/open_webui/migrations/util.py)
- [auths.py](file://backend/open_webui/models/auths.py)
- [users.py](file://backend/open_webui/models/users.py)
- [018012973d35_add_indexes.py](file://backend/open_webui/migrations/versions/018012973d35_add_indexes.py)
- [7e5b5dc7342b_init.py](file://backend/open_webui/migrations/versions/7e5b5dc7342b_init.py)
- [3af16a1c9fb6_update_user_table.py](file://backend/open_webui/migrations/versions/3af16a1c9fb6_update_user_table.py)
- [242a2047eae0_update_chat_table.py](file://backend/open_webui/migrations/versions/242a2047eae0_update_chat_table.py)
- [3781e22d8b01_update_message_table.py](file://backend/open_webui/migrations/versions/3781e22d8b01_update_message_table.py)
- [wrappers.py](file://backend/open_webui/internal/wrappers.py)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Database Configuration and Connection](#database-configuration-and-connection)
3. [Migration System Overview](#migration-system-overview)
4. [Common Database Connectivity Issues](#common-database-connectivity-issues)
5. [Migration Conflicts and Schema Synchronization](#migration-conflicts-and-schema-synchronization)
6. [Database Backup and Restoration](#database-backup-and-restoration)
7. [Connection Pooling and Performance](#connection-pooling-and-performance)
8. [Index Optimization and Query Performance](#index-optimization-and-query-performance)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Conclusion](#conclusion)

## Introduction

This document provides comprehensive guidance on database operations for the open-webui application. It covers common issues related to database connectivity, migration failures, schema synchronization problems, and performance optimization. The documentation includes detailed procedures for troubleshooting Alembic migration conflicts, handling database version mismatches, recovering from failed schema updates, and managing connection pooling issues. Additionally, it provides guidance on database backup, restoration, integrity checking, and index optimization to ensure optimal performance and data integrity.

**Section sources**
- [db.py](file://backend/open_webui/internal/db.py#L1-L165)
- [env.py](file://backend/open_webui/env.py#L269-L352)

## Database Configuration and Connection

The open-webui application supports multiple database backends through configurable environment variables. The primary configuration is managed in the `env.py` file, which handles database URL construction and connection parameters. The system supports SQLite (including encrypted SQLite with SQLCipher), PostgreSQL, and other SQLAlchemy-compatible databases.

Database connectivity is configured through several environment variables:
- `DATABASE_URL`: The primary connection string (e.g., `sqlite:///data/webui.db` or `postgresql://user:password@host:port/dbname`)
- `DATABASE_TYPE`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`: Individual components that can be used to construct the DATABASE_URL
- `DATABASE_SCHEMA`: Optional schema specification for PostgreSQL
- `DATABASE_POOL_SIZE`, `DATABASE_POOL_MAX_OVERFLOW`, `DATABASE_POOL_TIMEOUT`, `DATABASE_POOL_RECYCLE`: Connection pool configuration parameters
- `DATABASE_ENABLE_SQLITE_WAL`: Enables SQLite Write-Ahead Logging for improved concurrency

For encrypted SQLite databases using SQLCipher, the `DATABASE_PASSWORD` environment variable is required when using the `sqlite+sqlcipher://` protocol. The application automatically handles the conversion from `postgres://` to `postgresql://` in connection URLs to ensure compatibility with SQLAlchemy.

The database connection is initialized in `internal/db.py`, which sets up the SQLAlchemy engine with appropriate pooling and connection settings based on the database type and configuration parameters.

```mermaid
graph TD
A[Application Start] --> B[Read Environment Variables]
B --> C{Database Type?}
C --> |SQLite| D[Configure SQLite Engine]
C --> |SQLCipher| E[Configure Encrypted SQLite]
C --> |PostgreSQL| F[Configure PostgreSQL Engine]
D --> G[Set Connection Parameters]
E --> G
F --> G
G --> H[Initialize SQLAlchemy Engine]
H --> I[Create Session Factory]
I --> J[Database Ready]
```

**Diagram sources **
- [env.py](file://backend/open_webui/env.py#L269-L352)
- [db.py](file://backend/open_webui/internal/db.py#L80-L164)

**Section sources**
- [env.py](file://backend/open_webui/env.py#L269-L352)
- [db.py](file://backend/open_webui/internal/db.py#L80-L164)

## Migration System Overview

The open-webui application uses Alembic for database schema migrations, with a comprehensive migration history stored in the `migrations/versions/` directory. The migration system is configured through `alembic.ini` and `migrations/env.py`, which integrate with the application's database configuration.

Key components of the migration system include:
- `alembic.ini`: Configuration file specifying migration script location, version path separator, and logging settings
- `migrations/env.py`: Environment script that configures Alembic with the application's database URL and metadata
- `migrations/util.py`: Utility functions for migration operations, including `get_existing_tables()` and `get_revision_id()`
- Sequential migration files in `migrations/versions/` with incremental revision IDs

The migration process follows a structured approach:
1. Initial schema creation (`7e5b5dc7342b_init.py`)
2. Incremental schema updates with descriptive revision IDs
3. Data migration operations when column types change
4. Index creation for performance optimization
5. Downgrade paths for rollback capability

The system includes safeguards to prevent duplicate table creation by checking for existing tables before creating new ones. Migration scripts are designed to be idempotent and include both upgrade and downgrade functions to support version rollback.

```mermaid
graph TD
A[Alembic Configuration] --> B[Migration Environment]
B --> C[Migration Scripts]
C --> D[Version 1: Init Schema]
C --> E[Version 2: Add Fields]
C --> F[Version 3: Modify Tables]
C --> G[Version 4: Add Indexes]
D --> H[Database Schema]
E --> H
F --> H
G --> H
H --> I[Application]
```

**Diagram sources **
- [alembic.ini](file://backend/open_webui/alembic.ini#L1-L115)
- [env.py](file://backend/open_webui/migrations/env.py#L1-L109)
- [util.py](file://backend/open_webui/migrations/util.py#L1-L16)

**Section sources**
- [alembic.ini](file://backend/open_webui/alembic.ini#L1-L115)
- [env.py](file://backend/open_webui/migrations/env.py#L1-L109)
- [util.py](file://backend/open_webui/migrations/util.py#L1-L16)

## Common Database Connectivity Issues

Database connectivity issues in open-webui typically stem from configuration errors, authentication problems, or network connectivity issues. The most common problems and their solutions include:

### Incorrect Database URL Format
When using PostgreSQL, ensure the URL uses `postgresql://` rather than `postgres://`. The application automatically converts `postgres://` to `postgresql://`, but explicit configuration is recommended.

### Missing Database Password for Encrypted SQLite
When using SQLCipher with `sqlite+sqlcipher://`, the `DATABASE_PASSWORD` environment variable must be set. Failure to provide this password results in a `ValueError` with the message "DATABASE_PASSWORD is required when using sqlite+sqlcipher:// URLs".

### Special Characters in Database Credentials
Database passwords containing special characters should be URL-encoded to prevent parsing errors. The error message "Hint: If your database password contains special characters, you may need to URL-encode it." provides guidance for this issue.

### SQLite WAL Mode Configuration
For SQLite databases, the `DATABASE_ENABLE_SQLITE_WAL` environment variable controls Write-Ahead Logging mode. Enabling WAL mode (`DATABASE_ENABLE_SQLITE_WAL=true`) improves concurrency but may require additional configuration for network-mounted storage.

### Connection Pool Configuration
For production deployments with PostgreSQL, proper connection pool configuration is essential:
- `DATABASE_POOL_SIZE`: Number of connections to maintain in the pool
- `DATABASE_POOL_MAX_OVERFLOW`: Maximum number of connections that can be created beyond the pool size
- `DATABASE_POOL_TIMEOUT`: Timeout for acquiring a connection from the pool
- `DATABASE_POOL_RECYCLE`: Time after which connections are recycled

```mermaid
flowchart TD
A[Connection Attempt] --> B{URL Valid?}
B --> |No| C[Fix URL Format]
B --> |Yes| D{Password Provided?}
D --> |No for SQLCipher| E[Set DATABASE_PASSWORD]
D --> |Yes| F{Special Characters?}
F --> |Yes| G[URL-encode Password]
F --> |No| H[Test Connection]
H --> I{Success?}
I --> |No| J[Check Network/Firewall]
I --> |Yes| K[Connection Established]
```

**Diagram sources **
- [env.py](file://backend/open_webui/env.py#L306-L352)
- [db.py](file://backend/open_webui/internal/db.py#L86-L113)
- [wrappers.py](file://backend/open_webui/internal/wrappers.py#L48-L65)

**Section sources**
- [env.py](file://backend/open_webui/env.py#L306-L352)
- [db.py](file://backend/open_webui/internal/db.py#L86-L113)
- [wrappers.py](file://backend/open_webui/internal/wrappers.py#L48-L65)

## Migration Conflicts and Schema Synchronization

Migration conflicts and schema synchronization issues can occur during version upgrades or when multiple instances attempt to apply migrations simultaneously. The open-webui migration system includes several mechanisms to prevent and resolve these issues.

### Alembic Migration Conflicts
Alembic uses revision IDs to track migration history in the `alembic_version` table. Conflicts can occur when:
- Multiple migration scripts have the same revision ID
- Migration scripts are applied out of order
- Manual schema changes bypass Alembic

To prevent conflicts:
1. Always generate new migrations using `alembic revision --autogenerate -m "description"`
2. Never modify existing migration scripts after they have been applied
3. Use descriptive revision IDs that reflect the migration purpose

### Schema Synchronization Problems
Schema synchronization issues often arise when the database schema diverges from the application's expected schema. Common scenarios include:
- Column type mismatches (e.g., TEXT vs JSON)
- Missing columns or tables
- Index inconsistencies

The migration system handles data type changes through careful migration scripts. For example, the `242a2047eae0_update_chat_table.py` migration converts the `chat` column from TEXT to JSON by:
1. Renaming the existing column to `old_chat`
2. Creating a new `chat` column with JSON type
3. Migrating data from `old_chat` to `chat`
4. Dropping the `old_chat` column

### Handling Failed Migrations
When a migration fails, follow these steps:
1. Check the error message and logs to identify the failure point
2. If the migration partially completed, determine which operations succeeded
3. Use `alembic downgrade` to revert to the previous version if possible
4. Fix the migration script and reapply
5. As a last resort, manually correct the schema and update the `alembic_version` table

```mermaid
sequenceDiagram
participant Alembic as Alembic CLI
participant Env as migrations/env.py
participant DB as Database
participant Migration as Migration Script
Alembic->>Env : alembic upgrade head
Env->>DB : Connect with DATABASE_URL
Env->>Migration : Execute upgrade()
Migration->>DB : Check current schema
alt Migration Successful
Migration->>DB : Apply schema changes
DB-->>Migration : Success
Migration->>DB : Update alembic_version
DB-->>Env : Migration complete
Env-->>Alembic : Success
else Migration Failed
DB-->>Migration : Error
Migration-->>Env : Exception
Env-->>Alembic : Failure
Alembic->>Admin : Review error and fix
end
```

**Diagram sources **
- [env.py](file://backend/open_webui/migrations/env.py#L58-L108)
- [242a2047eae0_update_chat_table.py](file://backend/open_webui/migrations/versions/242a2047eae0_update_chat_table.py#L1-L108)
- [7e5b5dc7342b_init.py](file://backend/open_webui/migrations/versions/7e5b5dc7342b_init.py#L1-L205)

**Section sources**
- [env.py](file://backend/open_webui/migrations/env.py#L58-L108)
- [242a2047eae0_update_chat_table.py](file://backend/open_webui/migrations/versions/242a2047eae0_update_chat_table.py#L1-L108)
- [7e5b5dc7342b_init.py](file://backend/open_webui/migrations/versions/7e5b5dc7342b_init.py#L1-L205)

## Database Backup and Restoration

Proper backup and restoration procedures are critical for data protection and disaster recovery. The open-webui application provides several mechanisms for database backup and restoration.

### Backup Procedures
For SQLite databases (the default configuration):
1. Simply copy the database file (typically `data/webui.db`)
2. Ensure the application is not actively writing to the database during backup
3. For encrypted databases, ensure the `DATABASE_PASSWORD` is securely stored

For PostgreSQL databases:
1. Use `pg_dump` to create a backup: `pg_dump -h host -U user -d dbname -f backup.sql`
2. Compress the backup file: `gzip backup.sql`
3. Store the backup in a secure location

### Restoration Procedures
To restore from a backup:
1. Stop the open-webui application
2. Replace the database file with the backup (for SQLite)
3. Or import the SQL dump: `psql -h host -U user -d dbname -f backup.sql` (for PostgreSQL)
4. Restart the application

### Integrity Checking
The application includes mechanisms to verify database integrity:
- The `handle_peewee_migration` function in `internal/db.py` performs initial database validation
- SQLite databases can be checked with `PRAGMA integrity_check`
- Regular backups should be tested by restoring to a test environment

### Migration-Aware Backup Strategy
When planning backups, consider the migration state:
1. Back up before applying major migrations
2. Verify the backup by attempting a test restoration
3. Keep multiple backup generations to allow rollback to different migration states
4. Document the Alembic revision ID with each backup

```mermaid
flowchart TD
A[Backup Strategy] --> B[Regular Backups]
A --> C[Pre-Migration Backups]
A --> D[Post-Migration Verification]
B --> E[Daily/Weekly Schedule]
C --> F[Before Major Updates]
D --> G[Test Restoration]
E --> H[Store Offsite]
F --> H
G --> H
H --> I[Encryption]
I --> J[Secure Storage]
K[Restoration] --> L[Stop Application]
L --> M{Database Type}
M --> |SQLite| N[Replace webui.db]
M --> |PostgreSQL| O[Import SQL Dump]
N --> P[Restart Application]
O --> P
P --> Q[Verify Functionality]
```

**Diagram sources **
- [db.py](file://backend/open_webui/internal/db.py#L55-L78)
- [env.py](file://backend/open_webui/env.py#L273-L278)

**Section sources**
- [db.py](file://backend/open_webui/internal/db.py#L55-L78)
- [env.py](file://backend/open_webui/env.py#L273-L278)

## Connection Pooling and Performance

Connection pooling is essential for maintaining application performance under load, particularly for PostgreSQL deployments. The open-webui application configures connection pooling through environment variables and SQLAlchemy settings.

### Connection Pool Configuration
The following environment variables control connection pooling behavior:
- `DATABASE_POOL_SIZE`: Number of connections to maintain in the pool (default: unlimited)
- `DATABASE_POOL_MAX_OVERFLOW`: Maximum number of connections that can be created beyond the pool size (default: 0)
- `DATABASE_POOL_TIMEOUT`: Timeout for acquiring a connection from the pool (default: 30 seconds)
- `DATABASE_POOL_RECYCLE`: Time after which connections are recycled (default: 3600 seconds)

When `DATABASE_POOL_SIZE` is set to a positive integer, the application uses SQLAlchemy's `QueuePool` with the specified parameters. When set to 0 or not specified, `NullPool` is used, which creates and destroys connections on each request.

### Connection Pool Issues
Common connection pooling problems include:
- **Connection timeouts**: Occur when all pool connections are in use and the timeout is reached
- **Connection leaks**: Occur when connections are not properly closed after use
- **Pool exhaustion**: Occur when the maximum number of connections is reached

The application mitigates these issues by:
- Using `scoped_session` to ensure proper session management
- Setting `pool_pre_ping=True` to validate connections before use
- Implementing proper context managers for database sessions

### Performance Monitoring
Monitor connection pool performance by:
1. Checking application logs for connection timeout errors
2. Monitoring database server connection counts
3. Using database-specific tools to analyze connection patterns
4. Adjusting pool parameters based on observed usage patterns

```mermaid
graph TD
A[Application Request] --> B{Pool Available?}
B --> |Yes| C[Get Connection from Pool]
B --> |No| D{Below Max Overflow?}
D --> |Yes| E[Create New Connection]
D --> |No| F{Within Timeout?}
F --> |Yes| G[Wait for Connection]
F --> |No| H[Connection Timeout Error]
C --> I[Execute Query]
E --> I
G --> C
I --> J[Return Connection to Pool]
J --> K[Request Complete]
```

**Diagram sources **
- [env.py](file://backend/open_webui/env.py#L312-L348)
- [db.py](file://backend/open_webui/internal/db.py#L129-L145)

**Section sources**
- [env.py](file://backend/open_webui/env.py#L312-L348)
- [db.py](file://backend/open_webui/internal/db.py#L129-L145)

## Index Optimization and Query Performance

Index optimization is crucial for maintaining query performance as data volumes grow. The open-webui application includes several indexes to optimize common query patterns, with additional indexes added through migration scripts.

### Existing Indexes
The `018012973d35_add_indexes.py` migration adds indexes on frequently queried columns:
- `chat` table: `folder_id_idx`, `user_id_pinned_idx`, `user_id_archived_idx`, `updated_at_user_id_idx`, `folder_id_user_id_idx`
- `tag` table: `user_id_idx`
- `function` table: `is_global_idx`

These indexes optimize queries that filter by user, folder, pin status, archive status, and update time.

### Query Performance Issues
Common query performance problems include:
- **Missing indexes**: Queries on unindexed columns become slow as data grows
- **Inefficient queries**: Complex queries without proper optimization
- **N+1 query problems**: Multiple database queries when one would suffice

### Optimization Strategies
To optimize query performance:
1. Analyze slow queries using database profiling tools
2. Add indexes on frequently filtered or joined columns
3. Use database-specific optimization techniques (e.g., PostgreSQL EXPLAIN ANALYZE)
4. Implement query batching where appropriate
5. Cache frequently accessed data

### Monitoring and Maintenance
Regularly monitor query performance by:
1. Enabling database query logging
2. Analyzing slow query logs
3. Using application monitoring tools to identify slow endpoints
4. Running periodic database maintenance (e.g., VACUUM for SQLite, VACUUM ANALYZE for PostgreSQL)

```mermaid
flowchart TD
A[Query Performance Issue] --> B[Identify Slow Queries]
B --> C{Source}
C --> |Application Logs| D[Enable Query Logging]
C --> |Database Logs| E[Analyze Slow Query Log]
C --> |Monitoring Tools| F[Review Performance Metrics]
D --> G[Profile Specific Queries]
E --> G
F --> G
G --> H{Optimization Needed?}
H --> |Yes| I[Add Indexes]
H --> |Yes| J[Rewrite Query]
H --> |Yes| K[Implement Caching]
H --> |No| L[Monitor Baseline]
I --> M[Test Performance]
J --> M
K --> M
M --> N{Improved?}
N --> |Yes| O[Deploy Optimization]
N --> |No| P[Try Alternative]
P --> I
O --> Q[Document Changes]
```

**Diagram sources **
- [018012973d35_add_indexes.py](file://backend/open_webui/migrations/versions/018012973d35_add_indexes.py#L1-L47)
- [users.py](file://backend/open_webui/models/users.py#L319-L453)
- [auths.py](file://backend/open_webui/models/auths.py#L116-L137)

**Section sources**
- [018012973d35_add_indexes.py](file://backend/open_webui/migrations/versions/018012973d35_add_indexes.py#L1-L47)
- [users.py](file://backend/open_webui/models/users.py#L319-L453)
- [auths.py](file://backend/open_webui/models/auths.py#L116-L137)

## Troubleshooting Guide

This section provides solutions to common database issues encountered in open-webui deployments.

### Database Connectivity Errors
**Symptom**: Application fails to start with database connection error
**Solution**:
1. Verify `DATABASE_URL` environment variable is correctly formatted
2. For SQLCipher, ensure `DATABASE_PASSWORD` is set
3. Check that the database file path is writable (for SQLite)
4. Verify network connectivity (for remote databases)
5. Check firewall settings if using remote database

### Migration Conflicts
**Symptom**: Alembic migration fails with revision conflict
**Solution**:
1. Check current revision: `alembic current`
2. If needed, set revision manually: `alembic stamp <revision_id>`
3. Never modify applied migration scripts
4. For complex conflicts, create a new migration to reconcile differences

### Schema Synchronization Issues
**Symptom**: Application errors related to missing columns or tables
**Solution**:
1. Run pending migrations: `alembic upgrade head`
2. Verify migration status: `alembic history --verbose`
3. Check database schema against migration scripts
4. If schema is corrupted, restore from backup and reapply migrations

### Performance Problems
**Symptom**: Slow queries or application responsiveness
**Solution**:
1. Enable query logging to identify slow queries
2. Add indexes on frequently queried columns
3. Optimize connection pool settings for your workload
4. Consider database-specific optimizations (e.g., PostgreSQL configuration)

### Data Integrity Issues
**Symptom**: Data corruption or inconsistency
**Solution**:
1. Stop the application immediately
2. Restore from the most recent backup
3. Verify database integrity (e.g., `PRAGMA integrity_check` for SQLite)
4. Investigate root cause before resuming operations

### Connection Pool Exhaustion
**Symptom**: "Too many connections" errors
**Solution**:
1. Increase `DATABASE_POOL_SIZE` and `DATABASE_POOL_MAX_OVERFLOW`
2. Reduce `DATABASE_POOL_TIMEOUT` to fail faster
3. Implement connection pooling at the infrastructure level
4. Optimize application code to release connections promptly

**Section sources**
- [db.py](file://backend/open_webui/internal/db.py#L55-L78)
- [env.py](file://backend/open_webui/env.py#L306-L352)
- [env.py](file://backend/open_webui/migrations/env.py#L66-L70)
- [wrappers.py](file://backend/open_webui/internal/wrappers.py#L50-L53)

## Conclusion

Effective database operations are critical for the reliability and performance of the open-webui application. This document has covered the key aspects of database management, including configuration, migration handling, connectivity troubleshooting, and performance optimization. By following the guidelines provided, administrators can ensure smooth database operations, prevent common issues, and quickly resolve problems when they occur. Regular monitoring, proper backup procedures, and careful migration management are essential for maintaining data integrity and application stability. As the application evolves, continued attention to database performance and schema design will ensure optimal user experience and system reliability.