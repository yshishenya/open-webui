# User Data Model

<cite>
**Referenced Files in This Document**   
- [users.py](file://backend/open_webui/models/users.py)
- [auths.py](file://backend/open_webui/models/auths.py)
- [oauth_sessions.py](file://backend/open_webui/models/oauth_sessions.py)
- [chats.py](file://backend/open_webui/models/chats.py)
- [groups.py](file://backend/open_webui/models/groups.py)
- [007_add_user_last_active_at.py](file://backend/open_webui/internal/migrations/007_add_user_last_active_at.py)
- [011_add_user_settings.py](file://backend/open_webui/internal/migrations/011_add_user_settings.py)
- [017_add_user_oauth_sub.py](file://backend/open_webui/internal/migrations/017_add_user_oauth_sub.py)
- [3af16a1c9fb6_update_user_table.py](file://backend/open_webui/migrations/versions/3af16a1c9fb6_update_user_table.py)
- [b10670c03dd5_update_user_table.py](file://backend/open_webui/migrations/versions/b10670c03dd5_update_user_table.py)
- [018012973d35_add_indexes.py](file://backend/open_webui/migrations/versions/018012973d35_add_indexes.py)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [User Entity Fields](#user-entity-fields)
3. [Relationships with Other Entities](#relationships-with-other-entities)
4. [Database Constraints and Indexes](#database-constraints-and-indexes)
5. [Schema Evolution and Migration History](#schema-evolution-and-migration-history)
6. [Data Access Patterns](#data-access-patterns)
7. [Data Lifecycle and Privacy](#data-lifecycle-and-privacy)
8. [User Settings Storage and Versioning](#user-settings-storage-and-versioning)
9. [Sample User Record](#sample-user-record)
10. [Database Schema Diagram](#database-schema-diagram)

## Introduction
The User entity in the open-webui application serves as the central identity model for system participants. This documentation provides a comprehensive overview of the User data model, including its fields, relationships, constraints, and evolution through migration history. The model supports authentication, authorization, user preferences, and activity tracking, forming the foundation for user interactions within the platform.

**Section sources**
- [users.py](file://backend/open_webui/models/users.py#L45-L107)

## User Entity Fields
The User entity contains comprehensive profile and metadata information. Key fields include:

- **id**: Primary key, unique string identifier
- **name**: Full name of the user
- **email**: Email address, used for authentication and communication
- **role**: User role (e.g., "admin", "pending", "user") determining system permissions
- **settings**: JSON field storing user preferences and interface configurations
- **last_active_at**: Timestamp (epoch) tracking the user's last activity
- **created_at**: Timestamp (epoch) of user creation
- **updated_at**: Timestamp (epoch) of last user record update
- **oauth_sub**: OAuth subject identifier for external authentication
- **profile_image_url**: URL to the user's profile image
- **bio**: User biography or description
- **date_of_birth**: User's date of birth
- **timezone**: User's preferred timezone

The User model also includes presence-related fields such as status_emoji, status_message, and presence_state for real-time status indication.

**Section sources**
- [users.py](file://backend/open_webui/models/users.py#L45-L75)

## Relationships with Other Entities
The User entity maintains relationships with several key entities in the system:

### Auth Relationship
The User entity is closely tied to the Auth entity, which handles authentication credentials. The Auth table contains the user's password hash and active status, with a one-to-one relationship established through the user ID. Authentication is performed by verifying credentials against the Auth record while retrieving user information from the User entity.

### OAuthSession Relationship
Users can authenticate via OAuth providers through the OAuthSession entity. Each OAuthSession record contains encrypted tokens and provider information linked to a user ID. This relationship enables single sign-on capabilities and third-party authentication integration.

### Chat Relationship
Users create and own Chat entities, establishing a one-to-many relationship. The Chat table contains a user_id field that references the User entity, allowing retrieval of all chats belonging to a specific user. Users can also be granted access to shared chats through group memberships.

### Group Relationship
Users participate in Groups through the GroupMember junction table, creating a many-to-many relationship. This allows users to belong to multiple groups and enables group-based permissions and chat sharing. The GroupMember table contains user_id and group_id fields, facilitating efficient membership queries.

**Section sources**
- [users.py](file://backend/open_webui/models/users.py#L8-L11)
- [auths.py](file://backend/open_webui/models/auths.py#L19-L25)
- [oauth_sessions.py](file://backend/open_webui/models/oauth_sessions.py#L25-L37)
- [chats.py](file://backend/open_webui/models/chats.py#L26-L43)
- [groups.py](file://backend/open_webui/models/groups.py#L72-L84)

## Database Constraints and Indexes
The User entity implements several database constraints and indexes to ensure data integrity and query performance.

### Primary Key and Unique Constraints
The User table has a primary key constraint on the id field, ensuring each user has a unique identifier. While the email field is not explicitly defined as unique in the model, application logic enforces uniqueness during user creation to prevent duplicate accounts.

### Indexes
The database includes indexes on key fields to optimize query performance:
- Index on email field for fast authentication lookups
- Index on role field for role-based access queries
- Composite indexes on user_id in related tables (Chat, GroupMember, OAuthSession) for efficient relationship traversal

Additional indexes exist on timestamp fields like created_at and last_active_at to support time-based queries and sorting operations.

**Section sources**
- [018012973d35_add_indexes.py](file://backend/open_webui/migrations/versions/018012973d35_add_indexes.py)
- [users.py](file://backend/open_webui/models/users.py#L48-L51)

## Schema Evolution and Migration History
The User schema has evolved through several migration stages, reflecting the application's growing feature set.

### Initial Schema and Core Fields
The initial schema established core user identification fields including id, email, name, and role. The first significant enhancement came with migration 007_add_user_last_active_at.py, which introduced activity tracking by adding last_active_at, created_at, and updated_at fields while removing the deprecated timestamp field.

### User Settings Addition
Migration 011_add_user_settings.py introduced the settings field to store user preferences as JSON data. This allowed for flexible storage of interface configurations and user-specific options without requiring schema changes for new settings.

### OAuth Support Expansion
Migration 017_add_user_oauth_sub.py added the oauth_sub field to support external authentication providers. This was later enhanced in migration b10670c03dd5_update_user_table.py, which replaced the oauth_sub field with a more flexible oauth JSON field capable of storing multiple provider configurations.

### Profile and Presence Enhancements
Migration 3af16a1c9fb6_update_user_table.py significantly expanded the User model with profile fields (username, bio, gender, date_of_birth) and presence-related fields (presence_state, status_emoji, status_message, status_expires_at). This migration also converted info and settings fields from text to proper JSON type for better data handling.

**Section sources**
- [007_add_user_last_active_at.py](file://backend/open_webui/internal/migrations/007_add_user_last_active_at.py)
- [011_add_user_settings.py](file://backend/open_webui/internal/migrations/011_add_user_settings.py)
- [017_add_user_oauth_sub.py](file://backend/open_webui/internal/migrations/017_add_user_oauth_sub.py)
- [3af16a1c9fb6_update_user_table.py](file://backend/open_webui/migrations/versions/3af16a1c9fb6_update_user_table.py)
- [b10670c03dd5_update_user_table.py](file://backend/open_webui/migrations/versions/b10670c03dd5_update_user_table.py)

## Data Access Patterns
The User entity supports several key data access patterns through dedicated query methods.

### User Retrieval
Users can be retrieved by various identifiers:
- By ID: Direct lookup using the primary key
- By email: Authentication and user lookup
- By API key: Service-to-service authentication
- By OAuth subject: External provider authentication

### User Search and Filtering
The system supports complex user queries with filtering capabilities:
- Text search across name and email fields
- Role-based filtering (including exclusion)
- Group membership filtering
- Channel membership filtering
- Ordering by various attributes (name, email, creation date, activity)

### Activity Tracking
The User model includes methods for tracking user activity:
- update_last_active_by_id: Updates the last_active_at timestamp with rate limiting
- get_num_users_active_today: Counts users active within the current day
- is_user_active: Determines if a user is currently active based on recent activity

These patterns enable efficient user management, authentication, and activity monitoring throughout the application.

**Section sources**
- [users.py](file://backend/open_webui/models/users.py#L270-L453)

## Data Lifecycle and Privacy
The User entity implements specific lifecycle and privacy considerations.

### Soft-Delete Behavior
The User model does not implement a traditional archived flag. Instead, user deletion is handled through a cascading delete process that removes associated records (chats, group memberships, API keys) before deleting the user record itself. This ensures data consistency while allowing for complete user removal when required.

### GDPR Compliance
The system addresses privacy requirements through several mechanisms:
- Data minimization in user profiles
- Secure storage of authentication credentials (password hashes in Auth table)
- Encrypted storage of OAuth tokens in the OAuthSession table
- API endpoints for user data export and deletion

User data is stored with timestamps (created_at, updated_at) to support audit requirements, and activity tracking (last_active_at) helps identify inactive accounts for potential cleanup.

**Section sources**
- [users.py](file://backend/open_webui/models/users.py#L628-L645)
- [oauth_sessions.py](file://backend/open_webui/models/oauth_sessions.py#L9-L15)

## User Settings Storage and Versioning
User settings are stored in a flexible JSON structure that supports extensibility without schema changes.

### Settings Structure
The settings field contains a hierarchical JSON object with the following structure:
- ui: Interface preferences and display settings
- notifications: Notification preferences including webhook URLs
- Other category-specific settings

The UserSettings Pydantic model defines the structure with optional fields and allows additional properties through the extra="allow" configuration.

### Settings Management
Settings are managed through dedicated methods:
- update_user_settings_by_id: Merges new settings with existing ones
- Direct access to specific settings paths (e.g., webhook URL retrieval)

The system does not implement explicit versioning of user settings. Instead, the flexible JSON structure allows for backward-compatible additions, with clients expected to handle missing or unknown settings gracefully.

**Section sources**
- [users.py](file://backend/open_webui/models/users.py#L39-L42)
- [users.py](file://backend/open_webui/models/users.py#L610-L626)
- [users.py](file://backend/open_webui/models/users.py#L486-L499)

## Sample User Record
```json
{
  "id": "user_12345",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "role": "user",
  "profile_image_url": "/user.png",
  "bio": "AI enthusiast and developer",
  "timezone": "America/New_York",
  "presence_state": "online",
  "status_emoji": "💻",
  "status_message": "Working on AI projects",
  "settings": {
    "ui": {
      "theme": "dark",
      "compact_mode": true
    },
    "notifications": {
      "webhook_url": "https://example.com/webhook/123"
    }
  },
  "oauth": {
    "google": {
      "sub": "google_98765"
    }
  },
  "last_active_at": 1735689245,
  "created_at": 1735689245,
  "updated_at": 1735689245
}
```

**Section sources**
- [users.py](file://backend/open_webui/models/users.py#L79-L107)

## Database Schema Diagram
```mermaid
erDiagram
USER {
string id PK
string email
string name
string role
string profile_image_url
string bio
string timezone
string presence_state
string status_emoji
string status_message
int64 status_expires_at
json info
json settings
json oauth
int64 last_active_at
int64 updated_at
int64 created_at
}
AUTH {
string id PK FK
string email
string password
boolean active
}
OAUTH_SESSION {
string id PK
string user_id FK
string provider
string token
int64 expires_at
int64 created_at
int64 updated_at
}
CHAT {
string id PK
string user_id FK
string title
json chat
int64 created_at
int64 updated_at
string share_id UK
boolean archived
boolean pinned
json meta
string folder_id
}
GROUP {
string id PK
string user_id FK
string name
string description
json data
json meta
json permissions
int64 created_at
int64 updated_at
}
GROUP_MEMBER {
string id PK
string group_id FK
string user_id FK
int64 created_at
int64 updated_at
}
USER ||--o{ CHAT : "creates"
USER ||--o{ OAUTH_SESSION : "has"
USER ||--o{ GROUP_MEMBER : "belongs to"
GROUP ||--o{ GROUP_MEMBER : "contains"
USER ||--|| AUTH : "credentials"
```

**Diagram sources**
- [users.py](file://backend/open_webui/models/users.py#L45-L75)
- [auths.py](file://backend/open_webui/models/auths.py#L19-L25)
- [oauth_sessions.py](file://backend/open_webui/models/oauth_sessions.py#L25-L37)
- [chats.py](file://backend/open_webui/models/chats.py#L26-L43)
- [groups.py](file://backend/open_webui/models/groups.py#L36-L52)
- [groups.py](file://backend/open_webui/models/groups.py#L72-L84)