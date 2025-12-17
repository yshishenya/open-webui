# API Key Authentication

<cite>
**Referenced Files in This Document**   
- [users.py](file://backend/open_webui/models/users.py)
- [auth.py](file://backend/open_webui/utils/auth.py)
- [auths.py](file://backend/open_webui/routers/auths.py)
- [b10670c03dd5_update_user_table.py](file://backend/open_webui/migrations/versions/b10670c03dd5_update_user_table.py)
- [main.py](file://backend/open_webui/main.py)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [API Key Model](#api-key-model)
3. [API Key Generation and Management](#api-key-generation-and-management)
4. [Authentication Process](#authentication-process)
5. [HTTP Request Usage](#http-request-usage)
6. [Security Considerations](#security-considerations)
7. [Usage Examples](#usage-examples)
8. [Troubleshooting](#troubleshooting)
9. [Configuration and Restrictions](#configuration-and-restrictions)

## Introduction
The API Key Authentication system in Open WebUI provides a secure mechanism for programmatic access to the platform's REST API. This authentication method allows users to generate unique API keys that can be used instead of traditional username/password credentials for accessing protected endpoints. The system is designed to support both individual user access and potential integration scenarios while maintaining strict security controls.

The implementation follows industry best practices for API key management, including secure storage, proper validation, and configurable access restrictions. API keys are tightly bound to user accounts and inherit the permissions of the associated user, ensuring that access control policies are consistently enforced across both interactive and programmatic access methods.

**Section sources**
- [users.py](file://backend/open_webui/models/users.py#L118-L140)
- [auths.py](file://backend/open_webui/routers/auths.py#L1142-L1184)

## API Key Model
The API key system is built around a dedicated database model that stores key information and maintains the relationship between API keys and user accounts. The ApiKey model contains essential fields for key management, including creation and update timestamps, expiration information, and usage tracking.

The model structure includes:
- **id**: A unique identifier for the API key, following the pattern "key_{user_id}"
- **user_id**: Reference to the associated user account
- **key**: The actual API key value, stored securely in the database
- **data**: Optional JSON field for storing additional metadata
- **expires_at**: Timestamp indicating when the key expires (nullable)
- **last_used_at**: Timestamp of the last successful authentication
- **created_at** and **updated_at**: Creation and modification timestamps

The migration script shows that the API key functionality was added as a separate table rather than storing keys directly in the user table, which provides better data organization and security. This separation allows for more flexible key management and potential future enhancements like multiple keys per user or key-specific permissions.

```mermaid
erDiagram
USER {
string id PK
string email
string name
string role
timestamp created_at
timestamp updated_at
}
API_KEY {
string id PK
string user_id FK
string key UK
json data
timestamp expires_at
timestamp last_used_at
timestamp created_at
timestamp updated_at
}
USER ||--o{ API_KEY : "has"
```

**Diagram sources **
- [users.py](file://backend/open_webui/models/users.py#L118-L128)
- [b10670c03dd5_update_user_table.py](file://backend/open_webui/migrations/versions/b10670c03dd5_update_user_table.py#L135-L145)

## API Key Generation and Management
API key generation and management is handled through dedicated endpoints in the authentication router. The system provides a complete lifecycle management interface, allowing users to create, retrieve, and delete their API keys.

The key generation process begins with a POST request to the `/api_key` endpoint. Before generating a new key, the system validates that API keys are enabled in the configuration and that the requesting user has the necessary permissions. The `create_api_key` utility function generates a cryptographically secure key by creating a UUID and formatting it with a "sk-" prefix, which helps identify API keys in logs and headers.

When a new API key is generated, the system automatically invalidates any existing key for that user by deleting the previous entry from the database. This ensures that only one active API key exists per user at any given time, simplifying key management and reducing the risk of key proliferation. The new key is then stored in the database with the current timestamp for both creation and update times.

Users can retrieve their current API key by making a GET request to the `/api_key` endpoint or delete it with a DELETE request. These operations are protected by the same permission checks as key creation, ensuring that only authorized users can manage their keys.

**Section sources**
- [auths.py](file://backend/open_webui/routers/auths.py#L1148-L1184)
- [auth.py](file://backend/open_webui/utils/auth.py#L257-L259)
- [users.py](file://backend/open_webui/models/users.py#L655-L673)

## Authentication Process
The API key authentication process is integrated into the main authentication flow and is automatically triggered when a request contains an authorization header with a token that starts with "sk-". The system uses the `get_current_user_by_api_key` function to validate the provided key and retrieve the associated user.

The authentication workflow follows these steps:
1. Extract the API key from the Authorization header
2. Query the database to find the user associated with the key
3. Validate that the API key feature is enabled in the system configuration
4. Check that the user has permission to use API keys
5. Update the user's last active timestamp
6. Return the authenticated user object

The process includes several security checks to prevent unauthorized access. If the API key feature is disabled in the configuration, or if the user doesn't have the required permissions, the authentication will fail with an appropriate error message. The system also logs authentication attempts for auditing purposes and updates the user's last active timestamp to maintain accurate user activity records.

```mermaid
sequenceDiagram
participant Client
participant API
participant Auth
participant Database
Client->>API : Request with Bearer sk-xxx
API->>Auth : extract_token_from_auth_header()
Auth->>Auth : token starts with "sk-"?
Auth->>Auth : get_current_user_by_api_key()
Auth->>Database : Users.get_user_by_api_key()
Database-->>Auth : User object or None
Auth->>Auth : Validate permissions and config
Auth->>Auth : Update last_active_at
Auth-->>API : Authenticated User
API-->>Client : Processed Request
```

**Diagram sources **
- [auth.py](file://backend/open_webui/utils/auth.py#L290-L400)
- [users.py](file://backend/open_webui/models/users.py#L278-L288)

## HTTP Request Usage
API keys are used in HTTP requests through the standard Authorization header with the Bearer scheme. Clients should include their API key in the header of each request to authenticate with the system.

The proper format for the Authorization header is:
```
Authorization: Bearer sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

When making requests to the Open WebUI API, the client includes this header to authenticate. The backend automatically detects API keys by checking if the token starts with "sk-" and processes the request accordingly. This approach maintains compatibility with standard HTTP authentication practices and makes it easy for developers to integrate with the API using common HTTP libraries and tools.

The system supports API key usage across all enabled endpoints, but administrators can configure restrictions to limit which endpoints can be accessed with API keys. This allows for fine-grained control over programmatic access while maintaining security.

**Section sources**
- [auth.py](file://backend/open_webui/utils/auth.py#L290-L291)
- [main.py](file://backend/open_webui/main.py#L1302-L1337)

## Security Considerations
The API key system implements several security measures to protect against common threats and ensure the confidentiality of authentication credentials.

Key security features include:
- **Secure generation**: API keys are generated using UUIDs, providing high entropy and making them resistant to guessing attacks
- **Proper storage**: Keys are stored in a dedicated database table with unique constraints to prevent duplication
- **Single active key**: Only one API key is active per user at any time, reducing the attack surface
- **Permission checks**: Users must have explicit permissions to create and use API keys
- **Configuration control**: Administrators can enable or disable API key functionality globally

The system also includes protection against unauthorized endpoint access through the APIKeyRestrictionMiddleware, which can limit which endpoints are accessible via API keys. This prevents potential abuse of sensitive administrative endpoints through programmatic access.

For transmission security, API keys should always be sent over HTTPS connections to prevent interception. The system does not implement additional encryption for API keys in transit, relying on TLS for transport security, which is the standard approach for API authentication.

**Section sources**
- [auth.py](file://backend/open_webui/utils/auth.py#L257-L259)
- [main.py](file://backend/open_webui/main.py#L1302-L1337)
- [users.py](file://backend/open_webui/models/users.py#L658-L659)

## Usage Examples
The following examples demonstrate how to use API keys with the Open WebUI REST API:

**Generating an API key:**
```bash
curl -X POST "http://localhost:8080/api/v1/auths/api_key" \
  -H "Authorization: Bearer <your_jwt_token>" \
  -H "Content-Type: application/json"
```

**Using an API key to access protected endpoints:**
```bash
curl -X GET "http://localhost:8080/api/v1/models" \
  -H "Authorization: Bearer sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json"
```

**Retrieving the current API key:**
```bash
curl -X GET "http://localhost:8080/api/v1/auths/api_key" \
  -H "Authorization: Bearer <your_jwt_token>" \
  -H "Content-Type: application/json"
```

**Deleting the current API key:**
```bash
curl -X DELETE "http://localhost:8080/api/v1/auths/api_key" \
  -H "Authorization: Bearer <your_jwt_token>" \
  -H "Content-Type: application/json"
```

These examples show the complete lifecycle of API key usage, from generation to deletion. Note that generating, retrieving, and deleting API keys requires a valid JWT token, while using the API key for authentication requires the API key itself in the Authorization header.

**Section sources**
- [auths.py](file://backend/open_webui/routers/auths.py#L1148-L1184)
- [src/lib/apis/auths/index.ts](file://src/lib/apis/auths/index.ts#L625-L698)

## Troubleshooting
Common issues with API key authentication and their solutions:

**Invalid API key errors:**
- Ensure the key is copied correctly without extra spaces
- Verify that the Authorization header uses the correct format: "Bearer sk-xxx"
- Check that the key hasn't been accidentally deleted
- Confirm that API keys are enabled in the system configuration

**Permission errors:**
- Verify that your user account has permission to use API keys
- Check that your role allows API key creation (typically requires admin or specific permissions)
- Ensure the ENABLE_API_KEYS setting is enabled in the configuration

**Key revocation issues:**
- After deleting an API key, generate a new one as the old key cannot be recovered
- If you lose your API key, use your regular credentials to generate a new one
- Remember that deleting an API key immediately invalidates it for all services using it

**Endpoint access restrictions:**
- If you receive "API key not allowed to access this endpoint" errors, check the API_KEYS_ALLOWED_ENDPOINTS configuration
- Some endpoints may be restricted to JWT token authentication only for security reasons
- Contact your administrator to adjust endpoint access restrictions if needed

**Section sources**
- [auths.py](file://backend/open_webui/routers/auths.py#L1150-L1156)
- [main.py](file://backend/open_webui/main.py#L1326-L1331)
- [auth.py](file://backend/open_webui/utils/auth.py#L373-L388)

## Configuration and Restrictions
The API key system includes configurable options that allow administrators to control how API keys can be used within the system. These settings provide flexibility in balancing security and functionality based on organizational needs.

Key configuration options include:
- **ENABLE_API_KEYS**: Global toggle to enable or disable API key functionality
- **ENABLE_API_KEYS_ENDPOINT_RESTRICTIONS**: Controls whether endpoint access restrictions for API keys are enforced
- **API_KEYS_ALLOWED_ENDPOINTS**: Comma-separated list of endpoints that API keys are allowed to access

The APIKeyRestrictionMiddleware implements endpoint-level restrictions, allowing administrators to specify exactly which API endpoints can be accessed using API keys. This prevents potential abuse of sensitive administrative endpoints through programmatic access while still allowing API keys for appropriate use cases.

These configuration options are typically set in the system's environment variables or configuration files, allowing for easy adjustment without code changes. The middleware checks these settings on each request and enforces the restrictions accordingly, returning a 403 Forbidden response if an API key is used to access a restricted endpoint.

**Section sources**
- [main.py](file://backend/open_webui/main.py#L1308-L1324)
- [auths.py](file://backend/open_webui/routers/auths.py#L1150-L1151)