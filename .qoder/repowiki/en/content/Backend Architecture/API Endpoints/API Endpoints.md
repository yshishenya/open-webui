# API Endpoints

<cite>
**Referenced Files in This Document**   
- [main.py](file://backend/open_webui/main.py)
- [auths.py](file://backend/open_webui/routers/auths.py)
- [chats.py](file://backend/open_webui/routers/chats.py)
- [models.py](file://backend/open_webui/routers/models.py)
- [files.py](file://backend/open_webui/routers/files.py)
- [knowledge.py](file://backend/open_webui/routers/knowledge.py)
- [tools.py](file://backend/open_webui/routers/tools.py)
- [users.py](file://backend/open_webui/routers/users.py)
- [retrieval.py](file://backend/open_webui/routers/retrieval.py)
- [middleware.py](file://backend/open_webui/utils/middleware.py)
- [auth.py](file://backend/open_webui/utils/auth.py)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Authentication Endpoints](#authentication-endpoints)
3. [Chat Endpoints](#chat-endpoints)
4. [Model Endpoints](#model-endpoints)
5. [File Endpoints](#file-endpoints)
6. [Knowledge Base Endpoints](#knowledge-base-endpoints)
7. [Tool Endpoints](#tool-endpoints)
8. [User Endpoints](#user-endpoints)
9. [Retrieval Endpoints](#retrieval-endpoints)
10. [Dependency Injection and Security](#dependency-injection-and-security)
11. [Error Handling and Rate Limiting](#error-handling-and-rate-limiting)
12. [Client Integration Guidelines](#client-integration-guidelines)

## Introduction
The Open WebUI API provides a comprehensive set of RESTful endpoints for interacting with the AI chat interface. Built on FastAPI, the API exposes functionality for authentication, chat management, model configuration, file handling, knowledge base operations, tool integration, user management, and retrieval services. This documentation details all available endpoints, their request/response schemas, authentication requirements, and usage patterns. The API follows REST principles with JSON payloads and standard HTTP status codes for error handling.

**Section sources**
- [main.py](file://backend/open_webui/main.py#L656-L800)

## Authentication Endpoints
The authentication system supports multiple methods including JWT tokens, API keys, and LDAP integration. Endpoints are secured using dependency injection with role-based access control.

### Sign In
Authenticates a user and returns a session token.

**HTTP Method**: `POST`  
**URL**: `/api/v1/auths/signin`  
**Authentication Required**: No

**Request Body**:
```json
{
  "email": "string",
  "password": "string"
}
```

**Response (200 OK)**:
```json
{
  "token": "string",
  "token_type": "Bearer",
  "expires_at": 0,
  "id": "string",
  "email": "string",
  "name": "string",
  "role": "string",
  "profile_image_url": "string",
  "permissions": {}
}
```

**Error Responses**:
- `400 Bad Request`: Invalid credentials
- `429 Too Many Requests`: Rate limit exceeded

### Sign Up
Creates a new user account.

**HTTP Method**: `POST`  
**URL**: `/api/v1/auths/signup`  
**Authentication Required**: No

**Request Body**:
```json
{
  "email": "string",
  "password": "string",
  "name": "string",
  "profile_image_url": "string"
}
```

**Response (200 OK)**: Same as sign in response

### Get Session User
Retrieves the current authenticated user's information.

**HTTP Method**: `GET`  
**URL**: `/api/v1/auths/`  
**Authentication Required**: Yes (JWT or API key)

**Response (200 OK)**:
```json
{
  "token": "string",
  "token_type": "Bearer",
  "expires_at": 0,
  "id": "string",
  "email": "string",
  "name": "string",
  "role": "string",
  "profile_image_url": "string",
  "bio": "string",
  "gender": "string",
  "date_of_birth": "2024-01-01",
  "status_emoji": "string",
  "status_message": "string",
  "status_expires_at": 0,
  "permissions": {}
}
```

### Update Profile
Updates the authenticated user's profile information.

**HTTP Method**: `POST`  
**URL**: `/api/v1/auths/update/profile`  
**Authentication Required**: Yes

**Request Body**:
```json
{
  "name": "string",
  "profile_image_url": "string",
  "bio": "string",
  "gender": "string",
  "date_of_birth": "2024-01-01"
}
```

**Response (200 OK)**: User profile response

### Sign Out
Invalidates the current session token.

**HTTP Method**: `GET`  
**URL**: `/api/v1/auths/signout`  
**Authentication Required**: Yes

**Response (200 OK)**: Redirect response

**Section sources**
- [auths.py](file://backend/open_webui/routers/auths.py#L106-L798)

## Chat Endpoints
The chat endpoints provide comprehensive functionality for managing chat sessions, including creation, retrieval, updating, and deletion of chat records.

### Create New Chat
Creates a new chat session for the authenticated user.

**HTTP Method**: `POST`  
**URL**: `/api/v1/chats/new`  
**Authentication Required**: Yes

**Request Body**:
```json
{
  "chat": {
    "title": "string",
    "model": "string",
    "prompt": "string",
    "temperature": 0.7,
    "max_tokens": 0,
    "history": {
      "currentId": "string",
      "messages": {}
    }
  },
  "meta": {},
  "tags": ["string"]
}
```

**Response (200 OK)**:
```json
{
  "id": "string",
  "user_id": "string",
  "title": "string",
  "chat": {},
  "meta": {},
  "pinned": false,
  "folder_id": "string",
  "created_at": 0,
  "updated_at": 0,
  "share_id": "string",
  "archived": false
}
```

### Get User Chat List
Retrieves a paginated list of the user's chat sessions.

**HTTP Method**: `GET`  
**URL**: `/api/v1/chats/` or `/api/v1/chats/list`  
**Authentication Required**: Yes

**Query Parameters**:
- `page` (integer, optional): Page number for pagination
- `include_pinned` (boolean, optional): Include pinned chats
- `include_folders` (boolean, optional): Include folder information

**Response (200 OK)**:
```json
[
  {
    "id": "string",
    "title": "string",
    "updated_at": 0,
    "folder_id": "string",
    "pinned": false
  }
]
```

### Get Chat by ID
Retrieves a specific chat session by its ID.

**HTTP Method**: `GET`  
**URL**: `/api/v1/chats/{id}`  
**Authentication Required**: Yes

**Path Parameters**:
- `id` (string): The chat ID

**Response (200 OK)**: Full chat response as defined in Create New Chat

### Update Chat by ID
Updates an existing chat session.

**HTTP Method**: `POST`  
**URL**: `/api/v1/chats/{id}`  
**Authentication Required**: Yes

**Path Parameters**:
- `id` (string): The chat ID

**Request Body**: Same as Create New Chat request body

**Response (200 OK)**: Full chat response

### Delete Chat by ID
Deletes a chat session.

**HTTP Method**: `DELETE`  
**URL**: `/api/v1/chats/{id}`  
**Authentication Required**: Yes

**Path Parameters**:
- `id` (string): The chat ID

**Response (200 OK)**: `true` on success

### Search Chats
Searches through the user's chat history.

**HTTP Method**: `GET`  
**URL**: `/api/v1/chats/search`  
**Authentication Required**: Yes

**Query Parameters**:
- `text` (string): Search query
- `page` (integer, optional): Page number

**Response (200 OK)**: Array of chat title and ID responses

### Pin/Unpin Chat
Toggles the pinned status of a chat.

**HTTP Method**: `POST`  
**URL**: `/api/v1/chats/{id}/pin`  
**Authentication Required**: Yes

**Path Parameters**:
- `id` (string): The chat ID

**Response (200 OK)**: Full chat response with updated pinned status

**Section sources**
- [chats.py](file://backend/open_webui/routers/chats.py#L38-L798)

## Model Endpoints
The model endpoints manage AI models available within the system, including base models, custom models, and model configurations.

### Get Models
Retrieves a list of available models with filtering options.

**HTTP Method**: `GET`  
**URL**: `/api/v1/models/list`  
**Authentication Required**: Yes

**Query Parameters**:
- `query` (string, optional): Search query
- `view_option` (string, optional): View filter
- `tag` (string, optional): Tag filter
- `order_by` (string, optional): Sort field
- `direction` (string, optional): Sort direction (asc/desc)
- `page` (integer, optional): Page number

**Response (200 OK)**:
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "base_model_id": "string",
      "user_id": "string",
      "meta": {},
      "params": {},
      "access_control": {},
      "is_active": false,
      "created_at": 0,
      "updated_at": 0
    }
  ],
  "total": 0,
  "page": 0,
  "size": 0
}
```

### Get Base Models
Retrieves the list of base models available for creation.

**HTTP Method**: `GET`  
**URL**: `/api/v1/models/base`  
**Authentication Required**: Admin only

**Response (200 OK)**: Array of model responses

### Create New Model
Creates a new custom model configuration.

**HTTP Method**: `POST`  
**URL**: `/api/v1/models/create`  
**Authentication Required**: Admin or users with workspace.models permission

**Request Body**:
```json
{
  "id": "string",
  "name": "string",
  "base_model_id": "string",
  "meta": {},
  "params": {},
  "access_control": {},
  "is_active": false
}
```

**Response (200 OK)**: Created model response

### Get Model by ID
Retrieves a specific model configuration.

**HTTP Method**: `GET`  
**URL**: `/api/v1/models/model`  
**Authentication Required**: Yes

**Query Parameters**:
- `id` (string): Model ID

**Response (200 OK)**: Model response

### Update Model by ID
Updates an existing model configuration.

**HTTP Method**: `POST`  
**URL**: `/api/v1/models/model/update`  
**Authentication Required**: Yes (owner or admin)

**Request Body**: Same as Create New Model

**Response (200 OK)**: Updated model response

### Delete Model by ID
Deletes a model configuration.

**HTTP Method**: `POST`  
**URL**: `/api/v1/models/model/delete`  
**Authentication Required**: Yes (owner or admin)

**Request Body**:
```json
{
  "id": "string"
}
```

**Response (200 OK)**: `true` on success

**Section sources**
- [models.py](file://backend/open_webui/routers/models.py#L51-L418)

## File Endpoints
The file endpoints handle file uploads, processing, and management for use in retrieval and chat contexts.

### Upload File
Uploads a new file to the system.

**HTTP Method**: `POST`  
**URL**: `/api/v1/files/`  
**Authentication Required**: Yes

**Request Parameters**:
- `file` (file): The file to upload
- `metadata` (object, optional): Additional metadata
- `process` (boolean, default: true): Whether to process the file
- `process_in_background` (boolean, default: true): Process in background

**Response (200 OK)**:
```json
{
  "id": "string",
  "user_id": "string",
  "filename": "string",
  "path": "string",
  "data": {},
  "meta": {},
  "created_at": 0,
  "updated_at": 0
}
```

### List Files
Retrieves a list of files accessible to the user.

**HTTP Method**: `GET`  
**URL**: `/api/v1/files/`  
**Authentication Required**: Yes

**Query Parameters**:
- `content` (boolean, default: true): Include file content

**Response (200 OK)**: Array of file responses

### Get File by ID
Retrieves metadata for a specific file.

**HTTP Method**: `GET`  
**URL**: `/api/v1/files/{id}`  
**Authentication Required**: Yes

**Path Parameters**:
- `id` (string): File ID

**Response (200 OK)**: File response

### Get File Content
Retrieves the actual file content.

**HTTP Method**: `GET`  
**URL**: `/api/v1/files/{id}/content`  
**Authentication Required**: Yes

**Path Parameters**:
- `id` (string): File ID

**Query Parameters**:
- `attachment` (boolean, optional): Force attachment download

**Response**: File content with appropriate Content-Type header

### Delete File by ID
Deletes a file from the system.

**HTTP Method**: `DELETE`  
**URL**: `/api/v1/files/{id}`  
**Authentication Required**: Yes (owner or admin)

**Path Parameters**:
- `id` (string): File ID

**Response (200 OK)**:
```json
{
  "message": "File deleted successfully"
}
```

**Section sources**
- [files.py](file://backend/open_webui/routers/files.py#L152-L761)

## Knowledge Base Endpoints
The knowledge base endpoints manage collections of documents for retrieval-augmented generation (RAG) functionality.

### Get Knowledge Bases
Retrieves a list of knowledge bases with read access.

**HTTP Method**: `GET`  
**URL**: `/api/v1/knowledge/`  
**Authentication Required**: Yes

**Response (200 OK)**:
```json
[
  {
    "id": "string",
    "user_id": "string",
    "name": "string",
    "description": "string",
    "access_control": {},
    "created_at": 0,
    "updated_at": 0,
    "files": []
  }
]
```

### Create New Knowledge Base
Creates a new knowledge base collection.

**HTTP Method**: `POST`  
**URL**: `/api/v1/knowledge/create`  
**Authentication Required**: Admin or users with workspace.knowledge permission

**Request Body**:
```json
{
  "name": "string",
  "description": "string",
  "access_control": {}
}
```

**Response (200 OK)**: Created knowledge base response

### Get Knowledge Base by ID
Retrieves a specific knowledge base with its associated files.

**HTTP Method**: `GET`  
**URL**: `/api/v1/knowledge/{id}`  
**Authentication Required**: Yes

**Path Parameters**:
- `id` (string): Knowledge base ID

**Response (200 OK)**: Knowledge base response with files array

### Add File to Knowledge Base
Associates an existing file with a knowledge base.

**HTTP Method**: `POST`  
**URL**: `/api/v1/knowledge/{id}/file/add`  
**Authentication Required**: Yes (owner or admin)

**Path Parameters**:
- `id` (string): Knowledge base ID

**Request Body**:
```json
{
  "file_id": "string"
}
```

**Response (200 OK)**: Updated knowledge base response

### Remove File from Knowledge Base
Removes a file association from a knowledge base.

**HTTP Method**: `POST`  
**URL**: `/api/v1/knowledge/{id}/file/remove`  
**Authentication Required**: Yes (owner or admin)

**Path Parameters**:
- `id` (string): Knowledge base ID

**Request Body**:
```json
{
  "file_id": "string"
}
```

**Query Parameters**:
- `delete_file` (boolean, default: true): Also delete the file

**Response (200 OK)**: Updated knowledge base response

### Delete Knowledge Base
Deletes a knowledge base and its associations.

**HTTP Method**: `DELETE`  
**URL**: `/api/v1/knowledge/{id}/delete`  
**Authentication Required**: Yes (owner or admin)

**Path Parameters**:
- `id` (string): Knowledge base ID

**Response (200 OK)**: `true` on success

**Section sources**
- [knowledge.py](file://backend/open_webui/routers/knowledge.py#L43-L662)

## Tool Endpoints
The tool endpoints manage external tools and functions that can be called by the AI system.

### Get Tools
Retrieves a list of available tools.

**HTTP Method**: `GET`  
**URL**: `/api/v1/tools/`  
**Authentication Required**: Yes

**Response (200 OK)**:
```json
[
  {
    "id": "string",
    "user_id": "string",
    "name": "string",
    "meta": {},
    "access_control": {},
    "updated_at": 0,
    "created_at": 0
  }
]
```

### Create New Tool
Creates a new tool from code.

**HTTP Method**: `POST`  
**URL**: `/api/v1/tools/create`  
**Authentication Required**: Admin or users with workspace.tools permission

**Request Body**:
```json
{
  "id": "string",
  "name": "string",
  "content": "string",
  "meta": {}
}
```

**Response (200 OK)**: Created tool response

### Get Tool by ID
Retrieves a specific tool configuration.

**HTTP Method**: `GET`  
**URL**: `/api/v1/tools/id/{id}`  
**Authentication Required**: Yes

**Path Parameters**:
- `id` (string): Tool ID

**Response (200 OK)**: Tool response

### Update Tool by ID
Updates an existing tool configuration.

**HTTP Method**: `POST`  
**URL**: `/api/v1/tools/id/{id}/update`  
**Authentication Required**: Yes (owner or admin)

**Path Parameters**:
- `id` (string): Tool ID

**Request Body**: Same as Create New Tool

**Response (200 OK)**: Updated tool response

### Delete Tool by ID
Deletes a tool configuration.

**HTTP Method**: `DELETE`  
**URL**: `/api/v1/tools/id/{id}/delete`  
**Authentication Required**: Yes (owner or admin)

**Path Parameters**:
- `id` (string): Tool ID

**Response (200 OK)**: `true` on success

### Get Tool Valves
Retrieves the configuration valves for a tool.

**HTTP Method**: `GET`  
**URL**: `/api/v1/tools/id/{id}/valves`  
**Authentication Required**: Yes

**Path Parameters**:
- `id` (string): Tool ID

**Response (200 OK)**: Valve configuration object

### Update Tool Valves
Updates the configuration valves for a tool.

**HTTP Method**: `POST`  
**URL**: `/api/v1/tools/id/{id}/valves/update`  
**Authentication Required**: Yes (owner or admin)

**Path Parameters**:
- `id` (string): Tool ID

**Request Body**: Valve configuration object

**Response (200 OK)**: Updated valve configuration

**Section sources**
- [tools.py](file://backend/open_webui/routers/tools.py#L55-L648)

## User Endpoints
The user endpoints manage user accounts, permissions, and settings.

### Get Users
Retrieves a paginated list of users (admin only).

**HTTP Method**: `GET`  
**URL**: `/api/v1/users/`  
**Authentication Required**: Admin only

**Query Parameters**:
- `query` (string, optional): Search query
- `order_by` (string, optional): Sort field
- `direction` (string, optional): Sort direction
- `page` (integer, optional): Page number

**Response (200 OK)**:
```json
{
  "users": [
    {
      "id": "string",
      "name": "string",
      "email": "string",
      "role": "string",
      "profile_image_url": "string",
      "settings": {},
      "info": {},
      "last_active_at": 0,
      "created_at": 0,
      "updated_at": 0,
      "group_ids": ["string"]
    }
  ],
  "total": 0
}
```

### Get User by ID
Retrieves information about a specific user.

**HTTP Method**: `GET`  
**URL**: `/api/v1/users/{user_id}`  
**Authentication Required**: Yes

**Path Parameters**:
- `user_id` (string): User ID

**Response (200 OK)**: User response with is_active field

### Update User by ID
Updates a user's information (admin only).

**HTTP Method**: `POST`  
**URL**: `/api/v1/users/{user_id}/update`  
**Authentication Required**: Admin only

**Path Parameters**:
- `user_id` (string): User ID

**Request Body**:
```json
{
  "email": "string",
  "password": "string",
  "name": "string",
  "role": "string",
  "profile_image_url": "string"
}
```

**Response (200 OK)**: Updated user response

### Delete User by ID
Deletes a user account (admin only).

**HTTP Method**: `DELETE`  
**URL**: `/api/v1/users/{user_id}`  
**Authentication Required**: Admin only

**Path Parameters**:
- `user_id` (string): User ID

**Response (200 OK)**: `true` on success

### Get User Settings
Retrieves the authenticated user's settings.

**HTTP Method**: `GET`  
**URL**: `/api/v1/users/user/settings`  
**Authentication Required**: Yes

**Response (200 OK)**: User settings object

### Update User Settings
Updates the authenticated user's settings.

**HTTP Method**: `POST`  
**URL**: `/api/v1/users/user/settings/update`  
**Authentication Required**: Yes

**Request Body**: User settings object

**Response (200 OK)**: Updated settings

### Get Default Permissions
Retrieves the default user permissions (admin only).

**HTTP Method**: `GET`  
**URL**: `/api/v1/users/default/permissions`  
**Authentication Required**: Admin only

**Response (200 OK)**: Complete permissions structure

### Update Default Permissions
Updates the default user permissions (admin only).

**HTTP Method**: `POST`  
**URL**: `/api/v1/users/default/permissions`  
**Authentication Required**: Admin only

**Request Body**: Complete permissions structure

**Response (200 OK)**: Updated permissions

**Section sources**
- [users.py](file://backend/open_webui/routers/users.py#L57-L621)

## Retrieval Endpoints
The retrieval endpoints manage the RAG (Retrieval-Augmented Generation) system configuration and status.

### Get Status
Retrieves the current retrieval system configuration.

**HTTP Method**: `GET`  
**URL**: `/api/v1/retrieval/`  
**Authentication Required**: Yes

**Response (200 OK)**:
```json
{
  "status": true,
  "CHUNK_SIZE": 0,
  "CHUNK_OVERLAP": 0,
  "RAG_TEMPLATE": "string",
  "RAG_EMBEDDING_ENGINE": "string",
  "RAG_EMBEDDING_MODEL": "string",
  "RAG_RERANKING_MODEL": "string",
  "RAG_EMBEDDING_BATCH_SIZE": 0,
  "ENABLE_ASYNC_EMBEDDING": false
}
```

### Get Embedding Config
Retrieves the embedding configuration (admin only).

**HTTP Method**: `GET`  
**URL**: `/api/v1/retrieval/embedding`  
**Authentication Required**: Admin only

**Response (200 OK)**: Complete embedding configuration

### Update Embedding Config
Updates the embedding configuration (admin only).

**HTTP Method**: `POST`  
**URL**: `/api/v1/retrieval/embedding/update`  
**Authentication Required**: Admin only

**Request Body**:
```json
{
  "RAG_EMBEDDING_ENGINE": "string",
  "RAG_EMBEDDING_MODEL": "string",
  "RAG_EMBEDDING_BATCH_SIZE": 0,
  "ENABLE_ASYNC_EMBEDDING": false,
  "openai_config": {
    "url": "string",
    "key": "string"
  },
  "ollama_config": {
    "url": "string",
    "key": "string"
  },
  "azure_openai_config": {
    "url": "string",
    "key": "string",
    "version": "string"
  }
}
```

**Response (200 OK)**: Updated embedding configuration

### Get RAG Config
Retrieves the complete RAG configuration (admin only).

**HTTP Method**: `GET`  
**URL**: `/api/v1/retrieval/config`  
**Authentication Required**: Admin only

**Response (200 OK)**: Complete RAG configuration including all settings

### Update RAG Config
Updates the RAG configuration (admin only).

**HTTP Method**: `POST`  
**URL**: `/api/v1/retrieval/config/update`  
**Authentication Required**: Admin only

**Request Body**: Complete RAG configuration structure

**Response (200 OK)**: Updated configuration

**Section sources**
- [retrieval.py](file://backend/open_webui/routers/retrieval.py#L240-L686)

## Dependency Injection and Security
The Open WebUI API uses FastAPI's dependency injection system to enforce security and provide contextual information to endpoints.

### Authentication Dependencies
The system provides several dependency functions for authentication:

- `get_current_user`: Authenticates using JWT tokens or API keys
- `get_verified_user`: Ensures the user has a verified role (user or admin)
- `get_admin_user`: Restricts access to admin users only

These dependencies automatically handle token validation, session management, and permission checking.

### Role-Based Access Control
Access to endpoints is controlled through role-based permissions:

- **Admin**: Full access to all endpoints
- **User**: Access to personal resources and permitted features
- **Pending**: Limited access until approved

Permissions are defined in the `USER_PERMISSIONS` configuration and can be customized.

### API Key Authentication
API keys (prefixed with "sk-") can be used for authentication. They are validated against the user database and checked for permission restrictions defined in `API_KEYS_ALLOWED_ENDPOINTS`.

```python
def get_current_user_by_api_key(request, api_key: str):
    user = Users.get_user_by_api_key(api_key)
    if not request.state.enable_api_keys or (
        user.role != "admin"
        and not has_permission(
            user.id,
            "features.api_keys",
            request.app.state.config.USER_PERMISSIONS,
        )
    ):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail=ERROR_MESSAGES.API_KEY_NOT_ALLOWED
        )
    Users.update_last_active_by_id(user.id)
    return user
```

**Section sources**
- [auth.py](file://backend/open_webui/utils/auth.py#L272-L419)
- [main.py](file://backend/open_webui/main.py#L495-L501)

## Error Handling and Rate Limiting
The API implements comprehensive error handling and rate limiting to ensure reliability and security.

### Error Response Format
All error responses follow a standard format:

```json
{
  "detail": "Error message"
}
```

Common HTTP status codes:
- `400 Bad Request`: Invalid input or request
- `401 Unauthorized`: Authentication failed
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server-side error

### Rate Limiting
The authentication endpoints implement rate limiting to prevent brute force attacks:

```python
signin_rate_limiter = RateLimiter(
    redis_client=get_redis_client(), limit=5 * 3, window=60 * 3
)

@router.post("/signin", response_model=SessionUserResponse)
async def signin(request: Request, response: Response, form_data: SigninForm):
    if signin_rate_limiter.is_limited(form_data.email.lower()):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
        )
    # ... authentication logic
```

The rate limiter allows 15 attempts every 3 minutes per email address.

### Validation Errors
Input validation is performed using Pydantic models. Invalid requests return detailed error messages about the specific validation failures.

**Section sources**
- [auths.py](file://backend/open_webui/routers/auths.py#L86-L88)
- [auth.py](file://backend/open_webui/utils/auth.py#L168-L179)

## Client Integration Guidelines
This section provides guidelines for integrating with the Open WebUI API from client applications.

### Authentication Flow
Clients can authenticate using either JWT tokens or API keys:

#### JWT Token Flow
1. Send credentials to `/api/v1/auths/signin`
2. Store the returned token
3. Include the token in subsequent requests via the `Authorization` header:
   ```
   Authorization: Bearer <token>
   ```
4. Handle token expiration (check `expires_at` field)

#### API Key Flow
1. Obtain an API key from the user settings
2. Include the key in requests:
   ```
   Authorization: Bearer sk-<key>
   ```

### WebSocket Support
The system supports WebSocket connections for real-time chat updates. The WebSocket endpoint is available at `/ws` and requires the same authentication as REST endpoints.

### Environment Variables
Key configuration variables that affect API behavior:

- `ENABLE_SIGNUP`: Controls whether new user registration is allowed
- `ENABLE_API_KEYS`: Enables API key authentication
- `JWT_EXPIRES_IN`: Token expiration duration
- `WEBUI_AUTH`: Enables/disables authentication

### Best Practices
1. Always handle authentication errors gracefully
2. Implement token refresh logic
3. Respect rate limits
4. Validate input before sending requests
5. Handle various HTTP status codes appropriately
6. Use pagination for list endpoints to improve performance

**Section sources**
- [main.py](file://backend/open_webui/main.py#L774-L775)
- [auths.py](file://backend/open_webui/routers/auths.py#L106-L162)