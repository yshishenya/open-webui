# API Key Authentication

<cite>
**Referenced Files in This Document**   
- [auth.py](file://backend/open_webui/utils/auth.py)
- [users.py](file://backend/open_webui/models/users.py)
- [config.py](file://backend/open_webui/config.py)
- [access_control.py](file://backend/open_webui/utils/access_control.py)
- [auths.py](file://backend/open_webui/routers/auths.py)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [API Key Validation Process](#api-key-validation-process)
3. [Configuration and Permissions](#configuration-and-permissions)
4. [API Key Management Endpoints](#api-key-management-endpoints)
5. [Security and Telemetry Integration](#security-and-telemetry-integration)
6. [Usage Examples](#usage-examples)
7. [Security Considerations](#security-considerations)

## Introduction
The Open WebUI API key authentication system provides a secure mechanism for users to authenticate API requests using API keys that follow the "sk-" prefix convention. This system integrates with the application's role-based access control, telemetry tracking, and user permission framework to ensure secure and auditable access to API endpoints. The authentication flow validates API keys against the database, checks user permissions, and updates user activity timestamps while providing comprehensive telemetry data through OpenTelemetry.

**Section sources**
- [auth.py](file://backend/open_webui/utils/auth.py#L289-L400)
- [config.py](file://backend/open_webui/config.py#L290-L312)

## API Key Validation Process

The API key validation process is implemented in the `get_current_user_by_api_key` function within the authentication utility. When an API request contains a token prefixed with "sk-", the system automatically routes the authentication through the API key validation flow rather than the standard JWT token validation.

The validation process follows these steps:
1. The system checks if the provided API key exists in the database by querying the ApiKey table and joining with the User table
2. If the API key is not found, the system returns a 401 Unauthorized response with the message "Invalid token"
3. If the API key is found, the system performs additional authorization checks based on the global `enable_api_keys` configuration and the user's specific permissions
4. For non-admin users, the system verifies that the user has the "features.api_keys" permission through the `has_permission` function
5. Upon successful validation, the system updates the user's last active timestamp and returns the user object for further processing

The implementation ensures that API key authentication is only processed when the token explicitly starts with the "sk-" prefix, maintaining separation between API key and JWT token authentication flows.

```mermaid
flowchart TD
Start([API Request]) --> CheckPrefix["Check if token starts with 'sk-'"]
CheckPrefix --> |Yes| ValidateKey["Validate API Key in Database"]
CheckPrefix --> |No| JWTAuth["Process as JWT Token"]
ValidateKey --> KeyExists{"API Key Exists?"}
KeyExists --> |No| Return401["Return 401 Unauthorized"]
KeyExists --> |Yes| CheckGlobalConfig["Check enable_api_keys Configuration"]
CheckGlobalConfig --> GlobalEnabled{"Global API Keys Enabled?"}
GlobalEnabled --> |No| Return403["Return 403 Forbidden"]
GlobalEnabled --> |Yes| CheckUserRole["Check User Role"]
CheckUserRole --> |Admin| ReturnUser["Return User Object"]
CheckUserRole --> |Not Admin| CheckUserPermission["Check features.api_keys Permission"]
CheckUserPermission --> PermissionGranted{"Permission Granted?"}
PermissionGranted --> |No| Return403
PermissionGranted --> |Yes| UpdateTimestamp["Update User Last Active Timestamp"]
UpdateTimestamp --> ReturnUser
Return401 --> End([Response])
Return403 --> End
ReturnUser --> End
```

**Diagram sources**
- [auth.py](file://backend/open_webui/utils/auth.py#L370-L400)
- [users.py](file://backend/open_webui/models/users.py#L278-L288)

**Section sources**
- [auth.py](file://backend/open_webui/utils/auth.py#L370-L400)
- [users.py](file://backend/open_webui/models/users.py#L278-L288)

## Configuration and Permissions

The API key system is controlled by several configuration settings and permission checks that work together to provide granular control over API key usage. The primary configuration flag `ENABLE_API_KEYS` serves as a global switch that enables or disables API key functionality across the entire application.

### Configuration Settings
The following configuration settings control API key behavior:

| Configuration Setting | Path | Default Value | Description |
|----------------------|------|-------------|-------------|
| ENABLE_API_KEYS | auth.enable_api_keys | False | Global flag to enable/disable API key authentication |
| ENABLE_API_KEYS_ENDPOINT_RESTRICTIONS | auth.api_key.endpoint_restrictions | False | Enables endpoint restrictions for API keys |
| API_KEYS_ALLOWED_ENDPOINTS | auth.api_key.allowed_endpoints | Empty | Comma-separated list of endpoints accessible via API keys |

These settings are implemented as `PersistentConfig` objects, allowing them to be stored in the database and updated dynamically without requiring application restarts.

### Permission System
The permission system uses a hierarchical structure to determine whether a user can use API keys. The `has_permission` function checks for the "features.api_keys" permission in the user's permission set. This function first checks the user's group permissions and falls back to default permissions if no group permission is found.

The permission check is performed in two scenarios:
1. When validating an API key during authentication
2. When creating a new API key through the API

Administrators (users with the "admin" role) are exempt from the "features.api_keys" permission check, allowing them to use API keys regardless of the specific permission setting.

```mermaid
classDiagram
class Users {
+get_user_by_api_key(api_key : str) UserModel
+get_user_api_key_by_id(id : str) str
+update_user_api_key_by_id(id : str, api_key : str) bool
+delete_user_api_key_by_id(id : str) bool
}
class ApiKey {
+id : str
+user_id : str
+key : str
+created_at : int
+updated_at : int
}
class User {
+id : str
+email : str
+role : str
+last_active_at : int
}
class Config {
+ENABLE_API_KEYS : PersistentConfig
+ENABLE_API_KEYS_ENDPOINT_RESTRICTIONS : PersistentConfig
+API_KEYS_ALLOWED_ENDPOINTS : PersistentConfig
}
class AccessControl {
+has_permission(user_id : str, permission_key : str, default_permissions : dict) bool
+get_permissions(user_id : str, default_permissions : dict) dict
}
Users --> ApiKey : "1..1"
Users --> User : "1..1"
AccessControl --> Users : "uses"
Config --> AccessControl : "uses"
Users ..> Config : "references"
```

**Diagram sources**
- [config.py](file://backend/open_webui/config.py#L290-L312)
- [access_control.py](file://backend/open_webui/utils/access_control.py#L71-L105)
- [users.py](file://backend/open_webui/models/users.py#L118-L141)

**Section sources**
- [config.py](file://backend/open_webui/config.py#L290-L312)
- [access_control.py](file://backend/open_webui/utils/access_control.py#L71-L105)

## API Key Management Endpoints

The system provides REST endpoints for managing API keys, allowing users to create, retrieve, and delete their API keys. These endpoints are defined in the auths router and follow standard REST conventions.

### API Key Endpoints
| Endpoint | Method | Description | Permission Requirements |
|---------|--------|-------------|------------------------|
| /api_key | POST | Create a new API key | ENABLE_API_KEYS enabled and features.api_keys permission |
| /api_key | GET | Retrieve current API key | Authenticated user |
| /api_key | DELETE | Delete current API key | Authenticated user |

When creating a new API key, the system generates a cryptographically secure key using UUID4 and stores it in the database, replacing any existing API key for that user. The key generation process prefixes the UUID with "sk-" to maintain consistency with the expected format.

The endpoint for creating API keys performs the same permission checks as the authentication process, ensuring that only authorized users can generate API keys. This prevents privilege escalation and maintains the security boundary established by the configuration and permission system.

```mermaid
sequenceDiagram
participant Client
participant AuthRouter
participant Users
participant Database
Client->>AuthRouter : POST /api_key
AuthRouter->>AuthRouter : Check ENABLE_API_KEYS
AuthRouter->>AuthRouter : Check features.api_keys permission
AuthRouter->>AuthRouter : Verify user is admin or has permission
AuthRouter->>AuthRouter : Generate API key with create_api_key()
AuthRouter->>Users : update_user_api_key_by_id()
Users->>Database : Delete existing API key
Database-->>Users : Confirmation
Users->>Database : Insert new API key
Database-->>Users : Confirmation
Users-->>AuthRouter : Success status
AuthRouter-->>Client : 200 OK with API key
```

**Diagram sources**
- [auths.py](file://backend/open_webui/routers/auths.py#L1148-L1184)
- [auth.py](file://backend/open_webui/utils/auth.py#L257-L259)
- [users.py](file://backend/open_webui/models/users.py#L655-L673)

**Section sources**
- [auths.py](file://backend/open_webui/routers/auths.py#L1148-L1184)

## Security and Telemetry Integration

The API key authentication system integrates with OpenTelemetry to provide comprehensive telemetry data for monitoring and debugging. When a user authenticates with an API key, the system captures user information and attaches it to the current tracing span.

### Telemetry Data Collection
The system captures the following attributes in OpenTelemetry spans:
- client.user.id: The authenticated user's ID
- client.user.email: The authenticated user's email address
- client.user.role: The authenticated user's role
- client.auth.type: Set to "api_key" to distinguish from JWT authentication

This telemetry data enables monitoring of API key usage patterns, troubleshooting authentication issues, and analyzing user behavior across different authentication methods.

### User Activity Tracking
The system automatically updates the user's last active timestamp when they successfully authenticate with an API key. This update is performed synchronously within the `get_current_user_by_api_key` function, ensuring that the user's activity is recorded even for API requests that don't involve interactive sessions.

The user activity tracking serves multiple purposes:
- Maintaining accurate user presence information
- Supporting analytics and reporting features
- Enabling last active timestamp-based business logic
- Facilitating user session management

The integration with OpenTelemetry and user activity tracking ensures that API key usage is fully observable and contributes to the overall user engagement metrics of the application.

```mermaid
flowchart TD
A[API Request with API Key] --> B{Token starts with "sk-"}
B --> |Yes| C[Call get_current_user_by_api_key]
C --> D[Query Database for API Key]
D --> E{Key Found?}
E --> |No| F[Return 401 Unauthorized]
E --> |Yes| G[Check ENABLE_API_KEYS]
G --> H{Enabled?}
H --> |No| I[Return 403 Forbidden]
H --> |Yes| J[Check User Role and Permissions]
J --> K{Admin or Has Permission?}
K --> |No| I
K --> |Yes| L[Create/Open Telemetry Span]
L --> M[Set User Attributes in Span]
M --> N[Update User Last Active Timestamp]
N --> O[Return User Object]
O --> P[Process Request]
P --> Q[Record Span with Attributes]
Q --> R[Response to Client]
F --> R
I --> R
```

**Diagram sources**
- [auth.py](file://backend/open_webui/utils/auth.py#L289-L400)
- [utils/telemetry/setup.py](file://backend/open_webui/utils/telemetry/setup.py#L1-L58)

**Section sources**
- [auth.py](file://backend/open_webui/utils/auth.py#L289-L400)
- [utils/telemetry/setup.py](file://backend/open_webui/utils/telemetry/setup.py#L1-L58)

## Usage Examples

### API Key Creation
To create a new API key, send a POST request to the /api_key endpoint:

```bash
curl -X POST "http://localhost:8080/api/v1/api_key" \
  -H "Authorization: Bearer <your_jwt_token>" \
  -H "Content-Type: application/json"
```

Successful response:
```json
{
  "api_key": "sk-abc123def456ghi789"
}
```

### API Key Usage
To use an API key for authentication, include it in the Authorization header:

```bash
curl -X GET "http://localhost:8080/api/v1/some_endpoint" \
  -H "Authorization: Bearer sk-abc123def456ghi789"
```

### Error Responses
Invalid API key:
```json
{
  "detail": "Invalid token"
}
```

API keys disabled:
```json
{
  "detail": "Use of API key is not enabled in the environment."
}
```

Insufficient permissions:
```json
{
  "detail": "Use of API key is not enabled in the environment."
}
```

These examples demonstrate the standard usage patterns for the API key authentication system, including proper header formatting and expected error responses for various failure scenarios.

**Section sources**
- [auths.py](file://backend/open_webui/routers/auths.py#L1148-L1184)
- [auth.py](file://backend/open_webui/utils/auth.py#L370-L400)
- [constants.py](file://backend/open_webui/constants.py#L66-L68)

## Security Considerations

The API key authentication system incorporates several security measures to protect against common vulnerabilities and ensure secure operation.

### API Key Generation and Storage
API keys are generated using cryptographically secure UUID4 values, providing sufficient entropy to prevent guessing attacks. The keys are stored in the database with no additional hashing or encryption, as the security model relies on the confidentiality of the key value rather than reversible storage.

The system follows a key rotation model where creating a new API key automatically invalidates any existing key for that user, preventing multiple active keys and simplifying key management.

### Rate Limiting and Abuse Prevention
While the provided code does not explicitly show rate limiting implementation, the system includes error messages for rate limit exceeded conditions, suggesting that rate limiting is implemented at another layer of the application. This helps prevent brute force attacks against the API key authentication endpoint.

### Audit Logging
The system includes comprehensive audit logging capabilities through the integration with OpenTelemetry. All API key authentication attempts are captured in telemetry data, allowing administrators to monitor usage patterns and detect potential security incidents.

### Security Headers and Best Practices
The application implements security best practices through middleware that adds security headers to responses. While not directly related to API key authentication, these measures contribute to the overall security posture of the application.

The combination of secure key generation, permission checks, telemetry integration, and error handling creates a robust security framework for API key authentication that balances usability with protection against common attack vectors.

**Section sources**
- [auth.py](file://backend/open_webui/utils/auth.py#L257-L259)
- [users.py](file://backend/open_webui/models/users.py#L655-L673)
- [constants.py](file://backend/open_webui/constants.py#L75)
- [utils/security_headers.py](file://backend/open_webui/utils/security_headers.py)