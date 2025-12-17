# Schema Migration System

<cite>
**Referenced Files in This Document**   
- [001_initial_schema.py](file://backend/open_webui/internal/migrations/001_initial_schema.py)
- [002_add_local_sharing.py](file://backend/open_webui/internal/migrations/002_add_local_sharing.py)
- [003_add_auth_api_key.py](file://backend/open_webui/internal/migrations/003_add_auth_api_key.py)
- [004_add_archived.py](file://backend/open_webui/internal/migrations/004_add_archived.py)
- [005_add_updated_at.py](file://backend/open_webui/internal/migrations/005_add_updated_at.py)
- [006_migrate_timestamps_and_charfields.py](file://backend/open_webui/internal/migrations/006_migrate_timestamps_and_charfields.py)
- [007_add_user_last_active_at.py](file://backend/open_webui/internal/migrations/007_add_user_last_active_at.py)
- [008_add_memory.py](file://backend/open_webui/internal/migrations/008_add_memory.py)
- [009_add_models.py](file://backend/open_webui/internal/migrations/009_add_models.py)
- [010_migrate_modelfiles_to_models.py](file://backend/open_webui/internal/migrations/010_migrate_modelfiles_to_models.py)
- [011_add_user_settings.py](file://backend/open_webui/internal/migrations/011_add_user_settings.py)
- [012_add_tools.py](file://backend/open_webui/internal/migrations/012_add_tools.py)
- [013_add_user_info.py](file://backend/open_webui/internal/migrations/013_add_user_info.py)
- [014_add_files.py](file://backend/open_webui/internal/migrations/014_add_files.py)
- [015_add_functions.py](file://backend/open_webui/internal/migrations/015_add_functions.py)
- [016_add_valves_and_is_active.py](file://backend/open_webui/internal/migrations/016_add_valves_and_is_active.py)
- [017_add_user_oauth_sub.py](file://backend/open_webui/internal/migrations/017_add_user_oauth_sub.py)
- [018_add_function_is_global.py](file://backend/open_webui/internal/migrations/018_add_function_is_global.py)
- [db.py](file://backend/open_webui/internal/db.py)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Migration System Overview](#migration-system-overview)
3. [Migration Sequence Analysis](#migration-sequence-analysis)
4. [Migration Application Process](#migration-application-process)
5. [Creating New Migration Scripts](#creating-new-migration-scripts)
6. [Handling Migration Conflicts and Rollbacks](#handling-migration-conflicts-and-rollbacks)
7. [Best Practices for Migration Scripts](#best-practices-for-migration-scripts)
8. [Conclusion](#conclusion)

## Introduction

The open-webui project employs a comprehensive schema migration system based on Alembic and Peewee to manage database schema changes over time. This system ensures that database schema modifications are applied in a controlled, consistent, and reversible manner across different deployment environments. The migration system is designed to handle various database backends, with special considerations for SQLite and external databases like PostgreSQL. The migrations are stored in the internal/migrations directory and are executed sequentially during application startup to ensure the database schema is always up-to-date with the application code.

## Migration System Overview

The schema migration system in open-webui is implemented using the peewee-migrate library, which provides a lightweight migration framework for Peewee ORM. The migrations are stored in the backend/open_webui/internal/migrations directory and are executed in numerical order based on their filenames (001_initial_schema.py, 002_add_local_sharing.py, etc.). Each migration script contains a migrate function that defines the forward migration operations and a rollback function that defines how to reverse those operations.

The system supports both SQLite and external databases (PostgreSQL, MySQL, etc.), with different migration paths for each database type. This is particularly evident in the initial schema migration (001_initial_schema.py), which provides separate migration functions (migrate_sqlite and migrate_external) to handle database-specific differences. The migration system uses Peewee's migration operations such as create_model, add_fields, change_fields, remove_fields, and raw SQL execution through the migrator.sql() method.

**Section sources**
- [001_initial_schema.py](file://backend/open_webui/internal/migrations/001_initial_schema.py#L37-L255)

## Migration Sequence Analysis

### 001_initial_schema.py: Initial Database Structure

The first migration script establishes the foundational database schema for the application. It creates seven core tables: Auth, Chat, ChatIdTag, Document, Modelfile, Prompt, and User. For SQLite databases, the migration uses specific field types appropriate for SQLite, while for external databases, it uses more robust field types. Notably, the password field in the Auth table uses TextField for external databases to accommodate longer password hashes, while using CharField for SQLite. Similarly, text fields like title and profile_image_url use TextField for external databases but CharField for SQLite. This migration also includes a comprehensive rollback function that removes all created models in reverse order to prevent foreign key constraint issues.

**Section sources**
- [001_initial_schema.py](file://backend/open_webui/internal/migrations/001_initial_schema.py#L51-L255)

### 002_add_local_sharing.py: Enabling Chat Sharing

This migration adds a share_id field to the Chat table to support local chat sharing functionality. The field is defined as a CharField with max_length=255, allowing null values initially (null=True) and enforcing uniqueness (unique=True) to ensure each shared chat has a unique identifier. This enables users to share specific chats with others by generating a unique shareable link. The rollback function simply removes this field, restoring the Chat table to its previous state.

**Section sources**
- [002_add_local_sharing.py](file://backend/open_webui/internal/migrations/002_add_local_sharing.py#L40-L42)

### 003_add_auth_api_key.py: API Key Authentication

This migration extends the User model by adding an api_key field to support API-based authentication. The field is a CharField with max_length=255, allows null values (null=True), and enforces uniqueness (unique=True) to ensure each API key is globally unique. This enables users to generate API keys for programmatic access to the application's functionality without using traditional username/password authentication. The migration is straightforward, adding a single field to an existing table.

**Section sources**
- [003_add_auth_api_key.py](file://backend/open_webui/internal/migrations/003_add_auth_api_key.py#L40-L42)

### 004_add_archived.py: Chat Archiving

This migration introduces an archived field to the Chat table to support chat archiving functionality. The field is a BooleanField with a default value of False, indicating that chats are not archived by default. This allows users to archive chats they no longer actively use while keeping them accessible for future reference. The implementation is simple but effective, adding a boolean flag to control the visibility and organization of chats in the user interface.

**Section sources**
- [004_add_archived.py](file://backend/open_webui/internal/migrations/004_add_archived.py#L40-L41)

### 005_add_updated_at.py: Enhanced Timestamp Management

This migration significantly enhances the timestamp management for the Chat table by replacing the single timestamp field with two dedicated fields: created_at and updated_at. For SQLite databases, these fields use DateTimeField to store date and time information, while for external databases, they use BigIntegerField to store Unix timestamps. The migration follows a careful three-step process: first adding the new fields with null=True to prevent data loss, then populating them with data from the original timestamp field using raw SQL, and finally removing the original timestamp field. This approach ensures data integrity during the transition. The migration also updates the fields to be non-nullable after population.

**Section sources**
- [005_add_updated_at.py](file://backend/open_webui/internal/migrations/005_add_updated_at.py#L46-L91)

### 006_migrate_timestamps_and_charfields.py: Data Type Standardization

This migration standardizes data types across multiple tables to ensure consistency and compatibility. It converts timestamp fields in ChatIdTag, Document, Modelfile, Prompt, and User tables from DateField to BigIntegerField to maintain uniform timestamp storage as Unix timestamps. Additionally, it upgrades several CharField columns to TextField for better flexibility: password in Auth, title in Chat, title and filename in Document, title in Prompt, and profile_image_url in User. This change accommodates longer content without truncation issues. The rollback function includes conditional logic for SQLite databases, reverting timestamp fields to DateField only for SQLite while maintaining BigIntegerField for external databases.

**Section sources**
- [006_migrate_timestamps_and_charfields.py](file://backend/open_webui/internal/migrations/006_migrate_timestamps_and_charfields.py#L41-L131)

### 007_add_user_last_active_at.py: User Activity Tracking

This migration enhances user tracking by adding three fields to the User table: created_at, updated_at, and last_active_at. All fields use BigIntegerField to store Unix timestamps. The migration follows the same pattern as 005_add_updated_at.py: adding the fields with null=True, populating them from the existing timestamp field using raw SQL, removing the original timestamp field, and finally making the new fields non-nullable. The last_active_at field specifically tracks when a user was last active in the system, enabling features like online status indicators and activity-based user sorting.

**Section sources**
- [007_add_user_last_active_at.py](file://backend/open_webui/internal/migrations/007_add_user_last_active_at.py#L41-L62)

### 008_add_memory.py: Memory Storage

This migration introduces a new Memory table to store user memory data. The table includes fields for id, user_id, content, updated_at, and created_at. The content field is a non-nullable TextField, ensuring that memory entries always have content. This table likely supports AI memory features, allowing the system to remember user preferences, conversation context, or other persistent information across sessions. The migration is straightforward, creating a new model without modifying existing tables.

**Section sources**
- [008_add_memory.py](file://backend/open_webui/internal/migrations/008_add_memory.py#L38-L47)

### 009_add_models.py: Model Management

This migration adds a Model table to support the management of AI models within the application. The table includes fields for id, user_id, base_model_id, name, meta, params, created_at, and updated_at. The meta and params fields are TextFields that likely store JSON data about the model configuration and parameters. This enables users to create, store, and manage custom AI models within the system. The id field uses TextField with a unique constraint, suggesting that model identifiers are longer strings rather than simple integers.

**Section sources**
- [009_add_models.py](file://backend/open_webui/internal/migrations/009_add_models.py#L40-L55)

### 010_migrate_modelfiles_to_models.py: Data Migration and Schema Evolution

This complex migration performs a significant schema evolution by replacing the Modelfile table with the Model table introduced in the previous migration. It accomplishes this through a multi-step process: first migrating data from the old Modelfile table to the new Model table by transforming the data structure, then dropping the Modelfile table. The data transformation is handled in Python code within the migrate_modelfile_to_model function, which extracts data from the JSON modelfile field, processes it using the parse_ollama_modelfile utility function, and maps it to the new Model table structure. The rollback function is equally sophisticated, recreating the Modelfile table and moving data back from the Model table. This migration demonstrates advanced data migration techniques, including custom data transformation and bidirectional migration logic.

**Section sources**
- [010_migrate_modelfiles_to_models.py](file://backend/open_webui/internal/migrations/010_migrate_modelfiles_to_models.py#L39-L131)

### 011_add_user_settings.py: User Preferences

This migration adds a settings field to the User table to store user-specific preferences and configurations. The field is a TextField with null=True, allowing users to have no settings initially. This flexible approach enables the storage of structured data (likely JSON) containing various user preferences, interface settings, or application configurations. The migration is simple but provides a foundation for extensive user customization features.

**Section sources**
- [011_add_user_settings.py](file://backend/open_webui/internal/migrations/011_add_user_settings.py#L40-L41)

### 012_add_tools.py: Tool Management

This migration introduces a Tool table to support the management of tools within the application. Similar in structure to the Model table, it includes fields for id, user_id, name, content, specs, meta, created_at, and updated_at. The content and specs fields suggest that tools can have executable code and specification data, while the meta field likely stores additional metadata. This table enables users to create, store, and manage custom tools that can be integrated into the AI workflow.

**Section sources**
- [012_add_tools.py](file://backend/open_webui/internal/migrations/012_add_tools.py#L40-L55)

### 013_add_user_info.py: User Profile Information

This migration adds an info field to the User table to store additional user profile information. Like the settings field, it's a TextField with null=True, providing flexible storage for user data such as bio, preferences, or other profile details. This separation of settings and info allows for organized storage of different types of user data—one for application settings and another for personal information.

**Section sources**
- [013_add_user_info.py](file://backend/open_webui/internal/migrations/013_add_user_info.py#L40-L41)

### 014_add_files.py: File Management

This migration adds a File table to support file management within the application. The table includes fields for id, user_id, filename, meta, and created_at. The meta field likely stores file metadata such as size, type, and other attributes. This enables users to upload, store, and manage files within the system, potentially for use in AI processing or as attachments in conversations.

**Section sources**
- [014_add_files.py](file://backend/open_webui/internal/migrations/014_add_files.py#L40-L49)

### 015_add_functions.py: Function Management

This migration introduces a Function table to support the management of functions within the application. Similar in structure to Model and Tool tables, it includes fields for id, user_id, name, type, content, meta, created_at, and updated_at. The type field suggests that functions can have different categories or classifications. This table enables users to create, store, and manage custom functions that can be executed within the AI system.

**Section sources**
- [015_add_functions.py](file://backend/open_webui/internal/migrations/015_add_functions.py#L40-L55)

### 016_add_valves_and_is_active.py: Enhanced Functionality

This migration enhances the Tool and Function tables by adding new fields. It adds a valves field to both tables, which is a TextField with null=True, likely for storing configuration data or parameters for tools and functions. Additionally, it adds an is_active field to the Function table, a BooleanField with a default value of False, to control whether functions are enabled or disabled. This allows for granular control over which functions are available for use in the system.

**Section sources**
- [016_add_valves_and_is_active.py](file://backend/open_webui/internal/migrations/016_add_valves_and_is_active.py#L40-L42)

### 017_add_user_oauth_sub.py: OAuth Integration

This migration adds an oauth_sub field to the User table to support OAuth authentication. The field is a TextField with null=True and unique=True, designed to store the subject identifier from OAuth providers. This enables the system to link user accounts to external OAuth identities (such as Google, GitHub, etc.) and support single sign-on functionality. The unique constraint ensures that each OAuth subject is associated with only one user account.

**Section sources**
- [017_add_user_oauth_sub.py](file://backend/open_webui/internal/migrations/017_add_user_oauth_sub.py#L36-L38)

### 018_add_function_is_global.py: Function Visibility

This migration adds an is_global field to the Function table, a BooleanField with a default value of False. This field controls whether a function is available globally to all users or only to the user who created it. When set to True, the function can be used by any user in the system, enabling shared functionality and community contributions. This feature supports both personal customization and collaborative tool sharing within the platform.

**Section sources**
- [018_add_function_is_global.py](file://backend/open_webui/internal/migrations/018_add_function_is_global.py#L40-L42)

## Migration Application Process

The migration system is applied during application startup through the database initialization process. When the application starts, it checks the current state of the database against the available migration scripts and applies any pending migrations in sequential order. The system uses the migrator to execute the migrate function in each migration script, transforming the database schema incrementally from its current state to the latest version.

For SQLite databases, the migration process takes into account SQLite's limitations and uses appropriate field types and migration strategies. For external databases, the system leverages more advanced database features while maintaining compatibility. The migration system is designed to be idempotent, meaning that running the same migration multiple times will not cause errors or duplicate changes.

The application likely uses a migration history table or similar mechanism to track which migrations have been applied, preventing the re-application of completed migrations. This ensures that the database schema evolves correctly over time, regardless of when or how often the application is restarted.

**Section sources**
- [db.py](file://backend/open_webui/internal/db.py#L1-L100)

## Creating New Migration Scripts

To create new migration scripts for the open-webui project, follow these steps:

1. **Identify the schema change needed**: Determine whether you need to create a new table, add/remove fields, modify existing fields, or perform other schema modifications.

2. **Generate a new migration file**: Use the peewee-migrate command-line tool or manually create a new Python file in the internal/migrations directory with the next sequential number (e.g., 019_*.py).

3. **Implement the migrate function**: In the migrate function, use the appropriate migrator methods to implement your schema changes:
   - Use `migrator.create_model()` to create new tables
   - Use `migrator.add_fields()` to add new fields to existing tables
   - Use `migrator.change_fields()` to modify existing fields
   - Use `migrator.remove_fields()` to remove fields
   - Use `migrator.sql()` for complex operations requiring raw SQL

4. **Implement the rollback function**: Create a corresponding rollback function that reverses the changes made in the migrate function. This is crucial for development and debugging.

5. **Handle database-specific differences**: If your migration needs to behave differently on SQLite vs. external databases, use `isinstance(database, pw.SqliteDatabase)` to detect the database type and apply appropriate changes.

6. **Test thoroughly**: Test your migration on both SQLite and external databases to ensure it works correctly and maintains data integrity.

When adding new fields, consider using null=True initially if the field will be populated with data from existing fields, following the pattern seen in migrations like 005_add_updated_at.py and 007_add_user_last_active_at.py. For data migrations that require transformation (like 010_migrate_modelfiles_to_models.py), implement the transformation logic in Python within the migration function.

**Section sources**
- [001_initial_schema.py](file://backend/open_webui/internal/migrations/001_initial_schema.py#L37-L255)
- [005_add_updated_at.py](file://backend/open_webui/internal/migrations/005_add_updated_at.py#L46-L91)
- [010_migrate_modelfiles_to_models.py](file://backend/open_webui/internal/migrations/010_migrate_modelfiles_to_models.py#L39-L131)

## Handling Migration Conflicts and Rollbacks

The open-webui migration system provides robust mechanisms for handling conflicts and rollbacks. Each migration script includes a rollback function that defines how to reverse the changes made by the migrate function. This allows developers to safely experiment with schema changes and revert them if needed.

For handling migration conflicts, particularly in team environments where multiple developers might create migrations simultaneously, follow these best practices:

1. **Coordinate migration numbering**: Ensure that migration numbers are sequential and don't conflict. If two migrations are created with the same number, manually adjust the numbering to maintain sequence.

2. **Communicate schema changes**: Discuss significant schema changes with team members before implementing them to avoid conflicts.

3. **Test rollbacks**: Always test the rollback function to ensure it correctly reverses the migration.

4. **Handle data migration carefully**: For migrations that involve data transformation or movement (like 010_migrate_modelfiles_to_models.py), ensure that the rollback function can restore the original data structure and content.

5. **Use transactions when possible**: Although not explicitly shown in the migration scripts, consider wrapping migration operations in transactions to ensure atomicity.

When conflicts do occur, resolve them by:
- Merging conflicting migrations into a single migration script
- Adjusting migration numbers to maintain proper sequence
- Ensuring that the combined migration maintains data integrity
- Testing thoroughly on different database backends

The system's support for both forward and backward migrations provides a safety net for development and deployment, allowing teams to iterate on schema design with confidence.

**Section sources**
- [001_initial_schema.py](file://backend/open_webui/internal/migrations/001_initial_schema.py#L237-L255)
- [010_migrate_modelfiles_to_models.py](file://backend/open_webui/internal/migrations/010_migrate_modelfiles_to_models.py#L84-L131)

## Best Practices for Migration Scripts

Based on the open-webui migration system, here are key best practices for writing effective migration scripts:

1. **Maintain data integrity**: Always consider the impact on existing data. When modifying fields or tables, use intermediate steps (like adding fields with null=True) to prevent data loss, as demonstrated in 005_add_updated_at.py and 007_add_user_last_active_at.py.

2. **Support multiple database backends**: Account for differences between SQLite and external databases, as shown in the initial schema migration. Use conditional logic to apply database-specific optimizations.

3. **Write reversible migrations**: Always implement a comprehensive rollback function that can completely undo the changes made by the migrate function. This is essential for development and debugging.

4. **Use descriptive migration names**: Name migration files clearly to indicate their purpose (e.g., "add_local_sharing.py", "migrate_modelfiles_to_models.py").

5. **Handle data transformations in code**: For complex data migrations requiring transformation, implement the logic in Python within the migration function rather than relying solely on SQL, as seen in 010_migrate_modelfiles_to_models.py.

6. **Consider performance**: For migrations that affect large datasets, consider the performance implications and optimize accordingly. The use of raw SQL for bulk updates (as in 005_add_updated_at.py) can be more efficient than row-by-row processing.

7. **Document migration purpose**: Include clear comments and documentation in migration files to explain the rationale behind the changes.

8. **Test thoroughly**: Test migrations on all supported database backends and with various data scenarios to ensure reliability.

9. **Follow sequential numbering**: Maintain proper numerical sequence in migration filenames to ensure they are applied in the correct order.

10. **Plan for backward compatibility**: When modifying existing fields or tables, consider how the changes will affect existing application code and data.

These best practices ensure that migration scripts are reliable, maintainable, and safe to deploy in production environments.

**Section sources**
- [001_initial_schema.py](file://backend/open_webui/internal/migrations/001_initial_schema.py#L37-L255)
- [005_add_updated_at.py](file://backend/open_webui/internal/migrations/005_add_updated_at.py#L46-L91)
- [010_migrate_modelfiles_to_models.py](file://backend/open_webui/internal/migrations/010_migrate_modelfiles_to_models.py#L39-L131)