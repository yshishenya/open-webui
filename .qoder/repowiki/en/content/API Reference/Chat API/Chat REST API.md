# Chat REST API

<cite>
**Referenced Files in This Document**   
- [chats.py](file://backend/open_webui/routers/chats.py)
- [chats.py](file://backend/open_webui/models/chats.py)
- [chat.py](file://backend/open_webui/utils/chat.py)
- [models.py](file://backend/open_webui/models/models.py)
- [messages.py](file://backend/open_webui/models/messages.py)
- [constants.py](file://backend/open_webui/constants.py)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Authentication](#authentication)
3. [Request and Response Formats](#request-and-response-formats)
4. [Chat Management Endpoints](#chat-management-endpoints)
   - [Create New Chat](#create-new-chat)
   - [Get Chat List](#get-chat-list)
   - [Get Chat by ID](#get-chat-by-id)
   - [Update Chat](#update-chat)
   - [Delete Chat](#delete-chat)
5. [Chat Metadata Operations](#chat-metadata-operations)
   - [Pin/Unpin Chat](#pinunpin-chat)
   - [Archive/Unarchive Chat](#archiveunarchive-chat)
   - [Share Chat](#share-chat)
6. [Chat Organization](#chat-organization)
   - [Folder Operations](#folder-operations)
   - [Tag Operations](#tag-operations)
7. [Search and Filtering](#search-and-filtering)
8. [Error Responses](#error-responses)
9. [Integration with Models and Messages](#integration-with-models-and-messages)
10. [Examples](#examples)

## Introduction

The Chat REST API provides comprehensive endpoints for managing chat sessions within the Open WebUI application. This API enables users to create, retrieve, update, and delete chat conversations, along with managing metadata such as titles, tags, and sharing settings. The API supports pagination, filtering, and sorting for efficient retrieval of chat history.

The chat system is tightly integrated with the models subsystem, allowing users to specify which AI model to use for each conversation. Chat state is persisted in the database with support for rich metadata, including model configuration, user preferences, and conversation history. Each chat contains a complete history of messages with support for various content types and metadata.

**Section sources**
- [chats.py](file://backend/open_webui/routers/chats.py#L1-L942)

## Authentication

All endpoints in the Chat REST API require authentication via Bearer tokens. Users must include a valid JWT token in the Authorization header for all requests. The token is obtained through the authentication system and contains user identity and role information.

```http
Authorization: Bearer <your-jwt-token>
```

The API enforces role-based access control, where different operations require specific permissions. Regular users can manage their own chats, while administrators have additional privileges to access other users' chats when enabled by system configuration.

Some endpoints have specific permission requirements that can be configured in the system settings. For example, sharing chats or deleting chats may require explicit permissions beyond basic authentication.

**Section sources**
- [chats.py](file://backend/open_webui/routers/chats.py#L25)
- [constants.py](file://backend/open_webui/constants.py#L19-L75)

## Request and Response Formats

### Pydantic Models

The API uses Pydantic models for request validation and response serialization. Key models include:

#### ChatModel
The `ChatModel` represents the core chat data structure stored in the database.

```python
class ChatModel(BaseModel):
    id: str
    user_id: str
    title: str
    chat: dict
    created_at: int  # timestamp in epoch
    updated_at: int  # timestamp in epoch
    share_id: Optional[str] = None
    archived: bool = False
    pinned: Optional[bool] = False
    meta: dict = {}
    folder_id: Optional[str] = None
```

#### ChatForm
The `ChatForm` is used for creating and updating chats.

```python
class ChatForm(BaseModel):
    chat: dict
    folder_id: Optional[str] = None
```

#### ChatResponse
The `ChatResponse` is the standard response format for chat endpoints.

```python
class ChatResponse(BaseModel):
    id: str
    user_id: str
    title: str
    chat: dict
    updated_at: int  # timestamp in epoch
    created_at: int  # timestamp in epoch
    share_id: Optional[str] = None
    archived: bool
    pinned: Optional[bool] = False
    meta: dict = {}
    folder_id: Optional[str] = None
```

#### ChatTitleIdResponse
The `ChatTitleIdResponse` is used for list endpoints that return minimal chat information.

```python
class ChatTitleIdResponse(BaseModel):
    id: str
    title: str
    updated_at: int
    created_at: int
```

The `chat` field in these models contains the complete conversation history and configuration in a structured JSON format, including message history, model settings, and UI preferences.

**Section sources**
- [chats.py](file://backend/open_webui/models/chats.py#L59-L127)

## Chat Management Endpoints

### Create New Chat

Creates a new chat session with the specified configuration.

**Endpoint**: `POST /api/chats/new`

**Request Body**:
```json
{
  "chat": {
    "title": "My New Chat",
    "model": "gpt-4",
    "params": {
      "temperature": 0.7,
      "max_tokens": 1000
    },
    "history": {
      "messages": []
    }
  },
  "folder_id": "optional-folder-id"
}
```

**Response**:
```json
{
  "id": "chat-123",
  "user_id": "user-456",
  "title": "My New Chat",
  "chat": { /* complete chat object */ },
  "created_at": 1703123456,
  "updated_at": 1703123456,
  "pinned": false,
  "archived": false,
  "meta": {},
  "folder_id": null
}
```

**Status Codes**:
- `200 OK`: Chat created successfully
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication failed

**Section sources**
- [chats.py](file://backend/open_webui/routers/chats.py#L133-L143)

### Get Chat List

Retrieves a list of chats for the authenticated user with optional pagination.

**Endpoint**: `GET /api/chats/` or `GET /api/chats/list`

**Query Parameters**:
- `page` (optional): Page number for pagination (default: no pagination)
- `include_pinned` (optional): Include pinned chats in results (default: false)
- `include_folders` (optional): Include chats in folders (default: false)

**Response**:
```json
[
  {
    "id": "chat-123",
    "title": "My New Chat",
    "updated_at": 1703123456,
    "created_at": 1703123456
  },
  {
    "id": "chat-456",
    "title": "Another Chat",
    "updated_at": 1703123000,
    "created_at": 1703123000
  }
]
```

When no page parameter is provided, all chats are returned. When page is specified, results are paginated with 60 items per page.

**Section sources**
- [chats.py](file://backend/open_webui/routers/chats.py#L38-L66)

### Get Chat by ID

Retrieves a specific chat by its ID.

**Endpoint**: `GET /api/chats/{id}`

**Path Parameters**:
- `id`: The unique identifier of the chat

**Response**:
Returns a `ChatResponse` object with the complete chat data.

**Status Codes**:
- `200 OK`: Chat found and returned
- `401 Unauthorized`: Chat not found or access denied
- `404 Not Found`: Chat does not exist

**Section sources**
- [chats.py](file://backend/open_webui/routers/chats.py#L427-L438)

### Update Chat

Updates an existing chat's configuration and metadata.

**Endpoint**: `POST /api/chats/{id}`

**Path Parameters**:
- `id`: The unique identifier of the chat to update

**Request Body**:
```json
{
  "chat": {
    "title": "Updated Chat Title",
    "model": "gpt-3.5-turbo",
    "params": {
      "temperature": 0.5
    }
  },
  "folder_id": "new-folder-id"
}
```

The update operation performs a shallow merge of the provided chat object with the existing chat data.

**Response**:
Returns the updated `ChatResponse` object.

**Section sources**
- [chats.py](file://backend/open_webui/routers/chats.py#L445-L459)

### Delete Chat

Deletes a chat by its ID.

**Endpoint**: `DELETE /api/chats/{id}`

**Path Parameters**:
- `id`: The unique identifier of the chat to delete

**Response**:
```json
true
```

Returns a boolean indicating success or failure of the deletion operation.

**Permissions**:
- Regular users can delete their own chats
- Administrators can delete any chat
- Users require explicit "chat.delete" permission if not an admin

**Section sources**
- [chats.py](file://backend/open_webui/routers/chats.py#L567-L594)

## Chat Metadata Operations

### Pin/Unpin Chat

Toggles the pinned status of a chat, which affects its visibility in the chat list.

**Endpoint**: `POST /api/chats/{id}/pin`

**Path Parameters**:
- `id`: The unique identifier of the chat

**Response**:
Returns the updated `ChatResponse` object with the new pinned status.

Pinned chats are typically displayed at the top of the chat list for quick access.

**Section sources**
- [chats.py](file://backend/open_webui/routers/chats.py#L617-L627)

### Archive/Unarchive Chat

Moves a chat to the archive or restores it from the archive.

**Endpoints**:
- Archive: `POST /api/chats/{id}/archive`
- Unarchive: `POST /api/chats/{id}/unarchive` (via archive toggle)

**Path Parameters**:
- `id`: The unique identifier of the chat

**Response**:
Returns the updated `ChatResponse` object with the new archived status.

Archived chats are removed from the main chat list but can be accessed through the archived chats view. Archiving a chat also removes its folder association.

**Section sources**
- [chats.py](file://backend/open_webui/routers/chats.py#L733-L757)

### Share Chat

Creates a shared version of a chat that can be accessed by others via a share link.

**Endpoint**: `POST /api/chats/{id}/share`

**Path Parameters**:
- `id`: The unique identifier of the chat to share

**Response**:
Returns the `ChatResponse` object with the `share_id` field populated.

**Permissions**:
- Users require "chat.share" permission
- Administrators can share any chat
- Shared chats are accessible via the `/api/chats/share/{share_id}` endpoint

**Section sources**
- [chats.py](file://backend/open_webui/routers/chats.py#L764-L795)

## Chat Organization

### Folder Operations

Organizes chats into folders for better management.

**Endpoint**: `POST /api/chats/{id}/folder`

**Request Body**:
```json
{
  "folder_id": "folder-123"
}
```

Setting `folder_id` to null removes the chat from any folder.

**Response**:
Returns the updated `ChatResponse` object with the new folder association.

**Section sources**
- [chats.py](file://backend/open_webui/routers/chats.py#L830-L844)

### Tag Operations

Manages tags associated with a chat for categorization and filtering.

**Endpoints**:
- Get tags: `GET /api/chats/{id}/tags`
- Add tag: `POST /api/chats/{id}/tags`
- Delete tag: `DELETE /api/chats/{id}/tags`
- Delete all tags: `DELETE /api/chats/{id}/tags/all`

**Request Body (for add/delete)**:
```json
{
  "name": "project-x"
}
```

Tags are stored in the chat's `meta` field and automatically cleaned up when no chats reference them.

**Section sources**
- [chats.py](file://backend/open_webui/routers/chats.py#L851-L942)

## Search and Filtering

The API provides several endpoints for searching and filtering chats:

### Search Chats

**Endpoint**: `GET /api/chats/search`

**Query Parameters**:
- `text`: Search text which can include filters like `tag:python` or `pinned:true`

**Response**:
Returns a list of `ChatTitleIdResponse` objects matching the search criteria.

### Filter by Tags

**Endpoint**: `POST /api/chats/tags`

**Request Body**:
```json
{
  "name": "python",
  "skip": 0,
  "limit": 50
}
```

Returns chats that have the specified tag.

### Filter by Folder

**Endpoint**: `GET /api/chats/folder/{folder_id}`

Returns all chats within the specified folder, including subfolders.

The search functionality supports various filters:
- `tag:tag_name` - filter by tag
- `folder:folder_name` - filter by folder
- `pinned:true/false` - filter by pinned status
- `archived:true/false` - filter by archived status
- `shared:true/false` - filter by sharing status

**Section sources**
- [chats.py](file://backend/open_webui/routers/chats.py#L167-L193)
- [chats.py](file://backend/open_webui/routers/chats.py#L409-L420)

## Error Responses

The API returns standardized error responses for various failure scenarios:

### Unauthorized Access
```json
{
  "detail": "You do not have permission to access this resource. Please contact your administrator for assistance."
}
```
**Status Code**: `401 Unauthorized`

Occurs when a user tries to access a chat they don't own or lacks required permissions.

### Invalid Chat ID
```json
{
  "detail": "We could not find what you're looking for :/"
}
```
**Status Code**: `401 Unauthorized`

Returned when the specified chat ID does not exist or is not accessible to the user.

### Rate Limiting
```json
{
  "detail": "API rate limit exceeded"
}
```
**Status Code**: `429 Too Many Requests`

Triggered when a user exceeds the allowed number of requests in a given time period.

### Validation Errors
```json
{
  "detail": "[ERROR: validation error message]"
}
```
**Status Code**: `400 Bad Request`

Returned for malformed requests or invalid data.

### Server Errors
```json
{
  "detail": "Something went wrong :/"
}
```
**Status Code**: `500 Internal Server Error`

Indicates an unexpected server-side error.

**Section sources**
- [constants.py](file://backend/open_webui/constants.py#L19-L75)

## Integration with Models and Messages

The Chat API is deeply integrated with the models and messages subsystems to provide a cohesive user experience.

### Models Integration

Each chat references a specific AI model by ID in its configuration. The system validates model access when creating or updating chats:

```python
def check_model_access(user, model):
    # Validates that the user has permission to use the specified model
    pass
```

The model configuration is stored in the chat's `chat` field and includes parameters like temperature, max tokens, and other model-specific settings.

### Messages Subsystem

While the Chat API manages the chat container, the messages are stored within the chat object itself in the `history.messages` structure. Each message follows a standard format:

```python
class MessageModel(BaseModel):
    id: str
    user_id: str
    content: str
    data: Optional[dict] = None
    meta: Optional[dict] = None
    created_at: int
    updated_at: int
```

The chat history is maintained as a nested structure with message IDs as keys, allowing for efficient updates and retrieval of specific messages.

### Database Persistence

Chat data is persisted in the database using SQLAlchemy models. The `Chat` table includes indexes for optimal query performance:

```python
__table_args__ = (
    Index("folder_id_idx", "folder_id"),
    Index("user_id_pinned_idx", "user_id", "pinned"),
    Index("user_id_archived_idx", "user_id", "archived"),
    Index("updated_at_user_id_idx", "updated_at", "user_id"),
    Index("folder_id_user_id_idx", "folder_id", "user_id"),
)
```

These indexes ensure fast retrieval of chats by user, folder, pinned status, and update time.

**Section sources**
- [chats.py](file://backend/open_webui/models/chats.py#L26-L56)
- [models.py](file://backend/open_webui/models/models.py#L55-L105)
- [messages.py](file://backend/open_webui/models/messages.py#L41-L63)

## Examples

### Creating a Chat with a Specific Model

Using curl:
```bash
curl -X POST "http://localhost:8080/api/chats/new" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "chat": {
      "title": "Python Help",
      "model": "gpt-4",
      "params": {
        "temperature": 0.5,
        "max_tokens": 2000
      },
      "history": {
        "messages": []
      }
    }
  }'
```

Using JavaScript fetch:
```javascript
fetch('/api/chats/new', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-jwt-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    chat: {
      title: 'Python Help',
      model: 'gpt-4',
      params: {
        temperature: 0.5,
        max_tokens: 2000
      },
      history: { messages: [] }
    }
  })
})
.then(response => response.json())
.then(data => console.log(data));
```

### Retrieving the Last 10 Chats

```bash
curl "http://localhost:8080/api/chats/?page=1" \
  -H "Authorization: Bearer your-jwt-token"
```

### Sharing a Chat

```bash
curl -X POST "http://localhost:8080/api/chats/chat-123/share" \
  -H "Authorization: Bearer your-jwt-token"
```

### Searching for Chats by Tag

```bash
curl "http://localhost:8080/api/chats/search?text=tag:work" \
  -H "Authorization: Bearer your-jwt-token"
```

### Updating Chat Title and Model

```bash
curl -X POST "http://localhost:8080/api/chats/chat-123" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "chat": {
      "title": "Updated Project Chat",
      "model": "gpt-3.5-turbo"
    }
  }'
```