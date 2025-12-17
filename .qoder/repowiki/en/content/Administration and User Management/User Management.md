# User Management

<cite>
**Referenced Files in This Document**   
- [users.py](file://backend/open_webui/models/users.py)
- [auths.py](file://backend/open_webui/models/auths.py)
- [groups.py](file://backend/open_webui/models/groups.py)
- [oauth_sessions.py](file://backend/open_webui/models/oauth_sessions.py)
- [users.py](file://backend/open_webui/routers/users.py)
- [groups.py](file://backend/open_webui/routers/groups.py)
- [auths.py](file://backend/open_webui/routers/auths.py)
- [oauth.py](file://backend/open_webui/utils/oauth.py)
- [auth.py](file://backend/open_webui/utils/auth.py)
- [misc.py](file://backend/open_webui/utils/misc.py)
- [user-import.csv](file://backend/open_webui/static/user-import.csv)
- [AddUserModal.svelte](file://src/lib/components/admin/Users/UserList/AddUserModal.svelte)
- [Database.svelte](file://src/lib/components/admin/Settings/Database.svelte)
</cite>

## Table of Contents
1. [User Management](#user-management)
2. [Core User Operations](#core-user-operations)
3. [API Endpoints for User Operations](#api-endpoints-for-user-operations)
4. [User-Group Relationships](#user-group-relationships)
5. [User Registration and Authentication](#user-registration-and-authentication)
6. [Bulk Operations and CSV Import/Export](#bulk-operations-and-csv-import-export)
7. [Security Considerations](#security-considerations)

## Core User Operations

The user management system in Open WebUI provides comprehensive functionality for creating, editing, deactivating, and managing user roles. The core user operations are implemented through the `UsersTable` class in the `users.py` model file, which handles all database interactions for user records.

User creation is performed through the `insert_new_user` method, which initializes a new user with required fields including ID, name, email, and profile image URL. The system automatically assigns a default role of "pending" to new users, which can be upgraded to "user" or "admin" through administrative actions. When a user is created, the system records timestamps for creation, last activity, and updates.

User editing operations are handled through the `update_user_by_id` method, which allows administrators to modify key user attributes including role, name, email, and profile image URL. The system includes validation to prevent email conflicts - if an administrator attempts to change a user's email to one that already exists, the system will reject the update with an "Email taken" error.

User deactivation is implemented through the `delete_user_by_id` method. This operation performs a comprehensive cleanup, removing the user from all groups, deleting their chat history, and removing their authentication records. The system prevents deletion of the primary admin user to maintain system integrity.

Role assignment is managed through the `update_user_role_by_id` method, which allows administrators to change a user's role. The system enforces role hierarchy by preventing non-admin users from performing privileged operations. Special restrictions apply to the primary admin user - only that user can modify their own role, and they cannot demote themselves from the admin role.

**Section sources**
- [users.py](file://backend/open_webui/models/users.py#L237-L646)

## API Endpoints for User Operations

The user management API provides a comprehensive set of endpoints for user operations, accessible through the `/users` route. These endpoints require appropriate authentication and authorization, with most operations restricted to administrative users.

### User Creation Endpoint
```
POST /users/create
```
This endpoint creates a new user with the provided details. The request body should include the user's name, email, password, and role. The system validates the email format and checks for existing users with the same email before creating the new account.

### User Retrieval Endpoints
```
GET /users/
GET /users/{user_id}
```
The first endpoint returns a paginated list of all users, while the second retrieves details for a specific user by ID. Both endpoints return user information including ID, name, email, role, profile image URL, and status information. The system includes a special handling for shared chat identifiers, extracting the actual user ID when a shared chat ID is provided.

### User Update Endpoint
```
POST /users/{user_id}/update
```
This endpoint allows administrators to update a user's information. The request body should include the updated user details. The endpoint performs validation to ensure email uniqueness and prevents unauthorized modification of the primary admin user.

### User Deletion Endpoint
```
DELETE /users/{user_id}
```
This endpoint removes a user from the system. The operation is restricted to administrators and includes safeguards to prevent deletion of the primary admin user. Users cannot delete their own accounts through this endpoint.

### Authentication Requirements
All user management endpoints require authentication via JWT tokens or API keys. The system uses dependency injection to verify user credentials and permissions. Administrative endpoints specifically require the `get_admin_user` dependency, which ensures the requesting user has admin privileges. Regular users can access limited endpoints like their own profile information using the `get_verified_user` dependency.

**Section sources**
- [users.py](file://backend/open_webui/routers/users.py#L57-L578)

## User-Group Relationships

The user management system implements a flexible group membership model that enables access control inheritance and bulk permission management. The relationship between users and groups is defined through several interconnected components.

### Group Membership Model
The system uses a many-to-many relationship between users and groups, implemented through the `GroupMember` table. This allows users to belong to multiple groups and groups to contain multiple users. The `Groups` model provides methods to manage group membership, including `add_users_to_group`, `remove_users_from_group`, and `get_groups_by_member_id`.

When a user is added to a group, the system creates a `GroupMember` record linking the user ID to the group ID. This relationship enables access control inheritance, where users inherit the permissions and settings of their groups. The system also supports bulk operations, allowing administrators to add or remove multiple users from a group in a single operation.

### Access Control Inheritance
Group membership enables access control inheritance through the permission system. The `get_permissions` function in the access control module evaluates both direct user permissions and permissions inherited from group membership. When checking if a user has access to a resource, the system combines the user's individual permissions with the permissions of all groups they belong to.

The system implements a sophisticated filtering mechanism that allows queries based on group membership. For example, administrators can retrieve all users belonging to a specific group or filter users by their group membership status. The `get_users` method in the `UsersTable` class includes logic to filter users based on group IDs and can order results by group membership status.

### Group Management Endpoints
The API provides several endpoints for managing group memberships:
```
GET /groups/users/{user_id}
POST /groups/id/{id}/users/add
POST /groups/id/{id}/users/remove
```
These endpoints allow administrators to view a user's group memberships and modify them. The system validates that only administrators can modify group memberships and includes error handling for invalid group or user IDs.

**Section sources**
- [groups.py](file://backend/open_webui/models/groups.py#L72-L534)
- [groups.py](file://backend/open_webui/routers/groups.py#L126-L222)

## User Registration and Authentication

The user management system supports multiple authentication methods, including traditional email/password registration, OAuth integration, and LDAP authentication. The registration and authentication flows are designed to be secure and flexible.

### User Registration Flow
The user registration process begins with the `signup` endpoint in the `auths.py` router. When a new user registers, the system performs several validation steps:
1. Checks if signup is enabled in the system configuration
2. Validates the email format using the `validate_email_format` function
3. Verifies that the email is not already in use
4. Validates the password strength according to system requirements

Once validation passes, the system creates a new user record with a hashed password and assigns a default role based on whether this is the first user (who becomes an admin) or a subsequent user (who receives the default user role). After successful registration, the system generates an authentication token and sets it in a secure cookie.

### Password Reset Mechanism
While the codebase doesn't explicitly show a password reset endpoint, the system supports password updates through the `update_password` endpoint. This endpoint requires the user to provide their current password for verification before allowing a password change. The system uses bcrypt for password hashing and includes validation to ensure new passwords meet security requirements.

### OAuth Integration
The system supports OAuth authentication through the `oauth.py` module, which implements a comprehensive OAuth client manager. The integration supports:
- Dynamic client registration with OAuth providers
- Token refresh functionality to maintain active sessions
- User information extraction from OAuth tokens
- Role and group assignment based on OAuth claims

The OAuth flow begins with the `handle_authorize` method, which redirects users to the OAuth provider's authorization endpoint. After successful authentication, the `handle_callback` method processes the authorization response, exchanges the authorization code for an access token, and creates a local user session. The system securely stores OAuth tokens in the database using encryption.

The OAuth implementation includes several security features:
- Token encryption using Fernet encryption
- Automatic token refresh when tokens are near expiration
- Session management to track active OAuth sessions
- Support for multiple OAuth providers simultaneously

**Section sources**
- [auths.py](file://backend/open_webui/routers/auths.py#L639-L751)
- [oauth.py](file://backend/open_webui/utils/oauth.py#L718-L799)
- [auth.py](file://backend/open_webui/utils/auth.py#L160-L205)

## Bulk Operations and CSV Import/Export

The user management system provides robust support for bulk operations through CSV import and export functionality, enabling administrators to efficiently manage large numbers of users.

### CSV Import Process
The CSV import feature allows administrators to create multiple users from a CSV file. The import process is implemented in the frontend component `AddUserModal.svelte`, which handles file selection and processing. The expected CSV format includes four columns:
1. Name
2. Email
3. Password
4. Role

The import process reads the CSV file line by line, skipping the header row, and creates users through the `addUser` API call. Each row is validated to ensure it contains exactly four columns and that the role value is one of the allowed values ("admin", "user", or "pending"). The system provides feedback on the import process, showing success messages with the number of users imported and error messages for any rows that fail validation.

### CSV Export Process
The system supports user data export through the `exportUsers` function in the `Database.svelte` component. This function retrieves all users through the `getAllUsers` API call and converts the user data to CSV format. The export includes the following fields for each user:
- ID
- Name
- Email
- Role

The exported CSV file uses proper CSV formatting with quoted fields and escaped quotes, ensuring compatibility with spreadsheet applications. The system generates a timestamped filename for the exported file to prevent naming conflicts.

### Handling Duplicate Emails
The system includes safeguards to prevent email conflicts during both individual and bulk user creation. When creating a user, the system checks for existing users with the same email address and rejects the creation with an "Email taken" error if a conflict is found. During CSV import, each row is processed individually, and any row with a duplicate email will fail while allowing other valid rows to be processed successfully.

### User Session Management
The system manages user sessions through JWT tokens stored in secure cookies. The `get_current_user` function in the `auth.py` module handles session validation, checking both JWT tokens and API keys for authentication. The system automatically updates a user's last active timestamp when they make authenticated requests, enabling real-time presence detection.

The session management system includes token invalidation functionality through the `invalidate_token` function, which adds revoked tokens to a Redis store with an expiration time matching the token's remaining lifetime. This allows for immediate logout functionality while maintaining scalability.

**Section sources**
- [AddUserModal.svelte](file://src/lib/components/admin/Users/UserList/AddUserModal.svelte#L68-L128)
- [Database.svelte](file://src/lib/components/admin/Settings/Database.svelte#L24-L44)
- [users.py](file://backend/open_webui/models/users.py#L551-L563)
- [auth.py](file://backend/open_webui/utils/auth.py#L272-L367)

## Security Considerations

The user management system implements several security measures to protect user data and prevent unauthorized access to privileged operations.

### Privileged User Actions
The system includes special protections for the primary admin user, who is the first user created in the system. These protections prevent accidental or malicious disruption of system administration:
- Only the primary admin user can modify their own role
- The primary admin user cannot be deleted by other administrators
- Attempts to modify the primary admin user are subject to additional validation

These safeguards ensure that there is always at least one administrative user in the system, maintaining system manageability.

### Authentication Security
The system employs several security measures for authentication:
- Passwords are hashed using bcrypt with automatic salt generation
- JWT tokens include expiration times and are validated on each request
- API keys are stored securely and can be revoked
- OAuth tokens are encrypted before storage in the database

The system also implements rate limiting for authentication attempts through the `RateLimiter` class, preventing brute force attacks on user accounts.

### Data Protection
User data is protected through multiple mechanisms:
- Sensitive data like passwords and OAuth tokens are never stored in plaintext
- Database queries use parameterized statements to prevent SQL injection
- Input validation is performed on all user-provided data
- Secure cookie attributes (HttpOnly, Secure, SameSite) are used for session cookies

The system also includes webhook integration for user signup events, allowing external systems to be notified of new user registrations while maintaining the security of user credentials.

**Section sources**
- [users.py](file://backend/open_webui/models/users.py#L502-L519)
- [auths.py](file://backend/open_webui/routers/auths.py#L86-L88)
- [auth.py](file://backend/open_webui/utils/auth.py#L163-L191)