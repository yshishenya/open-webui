# API Reference

<cite>
**Referenced Files in This Document**   
- [main.py](file://backend/open_webui/main.py)
- [auths.py](file://backend/open_webui/routers/auths.py)
- [chats.py](file://backend/open_webui/routers/chats.py)
- [models.py](file://backend/open_webui/routers/models.py)
- [files.py](file://backend/open_webui/routers/files.py)
- [users.py](file://backend/open_webui/routers/users.py)
- [utils.py](file://backend/open_webui/routers/utils.py)
- [socket/main.py](file://backend/open_webui/socket/main.py)
- [config.py](file://backend/open_webui/config.py)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
   - [Auths](#auths)
   - [Chats](#chats)
   - [Models](#models)
   - [Files](#files)
   - [Users](#users)
   - [Utilities](#utilities)
4. [WebSocket API](#websocket-api)
5. [API Versioning and Compatibility](#api-versioning-and-compatibility)
6. [Security](#security)
7. [OpenAPI/Swagger Documentation](#openapi-swagger-documentation)
8. [Error Handling](#error-handling)
9. [Rate Limiting](#rate-limiting)

## Introduction
The open-webui application provides a comprehensive RESTful API for interacting with its core functionality, including user authentication, chat management, model configuration, file handling, and user management. This documentation details all available API endpoints, organized by their respective router modules.

The API is built using FastAPI and follows RESTful principles. It supports both cookie-based authentication (for web interface) and token-based authentication (for programmatic access). The API also provides WebSocket endpoints for real-time interactions, particularly for chat streaming and collaborative editing.

All API endpoints are versioned through the application's release cycle, with backward compatibility maintained for stable features. The API is accessible at the `/api` prefix, with specific endpoints organized under various router modules.

**Section sources**
- [main.py](file://backend/open_webui/main.py#L656-L800)

## Authentication
The open-webui API supports multiple authentication methods including JWT tokens, API keys, and OAuth2. The primary authentication mechanism is JWT-based, where users receive a token upon successful login that must be included in subsequent requests.

Authentication can be performed via the `/api/auths/signin` endpoint with user credentials, or through OAuth2 providers configured in the system. The API also supports API key authentication for programmatic access, which can be enabled or restricted based on endpoint permissions.

For requests requiring authentication, the token should be included in the `Authorization` header as a Bearer token:
```
Authorization: Bearer <your_token>
```

Alternatively, the token can be provided as a cookie named `token`.

The API supports various OAuth2 providers including Google, Microsoft, GitHub, and custom OIDC providers. OAuth2 configuration is managed through environment variables and can be dynamically registered.

**Section sources**
- [auths.py](file://backend/open_webui/routers/auths.py#L106-L751)
- [config.py](file://backend/open_webui/config.py#L289-L632)

## API Endpoints

### Auths
The auths module handles user authentication, session management, and user registration.

#### Get Session User
Retrieves information about the currently authenticated user.

- **HTTP Method**: GET
- **URL**: `/api/auths/`
- **Authentication**: Required
- **Response Schema**: `SessionUserInfoResponse`
- **Response Codes**:
  - 200: User information retrieved successfully
  - 401: Unauthorized (invalid or expired token)

#### Update Profile
Updates the profile information of the authenticated user.

- **HTTP Method**: POST
- **URL**: `/api/auths/update/profile`
- **Authentication**: Required
- **Request Body**: `UpdateProfileForm`
- **Response Schema**: `UserProfileImageResponse`
- **Response Codes**:
  - 200: Profile updated successfully
  - 400: Invalid request or credentials

#### Update Password
Updates the password of the authenticated user.

- **HTTP Method**: POST
- **URL**: `/api/auths/update/password`
- **Authentication**: Required
- **Request Body**: `UpdatePasswordForm`
- **Response Schema**: boolean
- **Response Codes**:
  - 200: Password updated successfully
  - 400: Invalid password or credentials

#### LDAP Authentication
Authenticates a user via LDAP.

- **HTTP Method**: POST
- **URL**: `/api/auths/ldap`
- **Authentication**: Not required
- **Request Body**: `LdapForm`
- **Response Schema**: `SessionUserResponse`
- **Response Codes**:
  - 200: Authentication successful
  - 400: Authentication failed

#### Sign In
Authenticates a user with email and password.

- **HTTP Method**: POST
- **URL**: `/api/auths/signin`
- **Authentication**: Not required
- **Request Body**: `SigninForm`
- **Response Schema**: `SessionUserResponse`
- **Response Codes**:
  - 200: Authentication successful
  - 400: Invalid credentials
  - 429: Rate limit exceeded

#### Sign Up
Creates a new user account.

- **HTTP Method**: POST
- **URL**: `/api/auths/signup`
- **Authentication**: Not required
- **Request Body**: `SignupForm`
- **Response Schema**: `SessionUserResponse`
- **Response Codes**:
  - 200: User created successfully
  - 400: Invalid email format or email already taken
  - 403: Signups disabled

#### Sign Out
Ends the current user session.

- **HTTP Method**: GET
- **URL**: `/api/auths/signout`
- **Authentication**: Required (via cookie or header)
- **Response Codes**:
  - 200: Signed out successfully

**Section sources**
- [auths.py](file://backend/open_webui/routers/auths.py#L106-L800)

### Chats
The chats module manages chat conversations, including creation, retrieval, updating, and deletion of chat sessions.

#### Get Chat List
Retrieves a list of chat sessions for the authenticated user.

- **HTTP Method**: GET
- **URL**: `/api/chats/` or `/api/chats/list`
- **Authentication**: Required
- **Query Parameters**:
  - `page`: Page number for pagination
  - `include_pinned`: Include pinned chats
  - `include_folders`: Include folder information
- **Response Schema**: `list[ChatTitleIdResponse]`
- **Response Codes**:
  - 200: Chat list retrieved successfully
  - 400: Bad request

#### Delete All Chats
Deletes all chat sessions for the authenticated user.

- **HTTP Method**: DELETE
- **URL**: `/api/chats/`
- **Authentication**: Required
- **Response Schema**: boolean
- **Response Codes**:
  - 200: All chats deleted successfully
  - 401: Unauthorized

#### Get User Chat List
Retrieves chat sessions for a specific user (admin only).

- **HTTP Method**: GET
- **URL**: `/api/chats/list/user/{user_id}`
- **Authentication**: Required (admin)
- **Path Parameters**:
  - `user_id`: ID of the user whose chats to retrieve
- **Query Parameters**:
  - `page`: Page number
  - `query`: Search query
  - `order_by`: Field to order by
  - `direction`: Sort direction (asc/desc)
- **Response Schema**: `list[ChatTitleIdResponse]`
- **Response Codes**:
  - 200: Chat list retrieved successfully
  - 401: Unauthorized

#### Create New Chat
Creates a new chat session.

- **HTTP Method**: POST
- **URL**: `/api/chats/new`
- **Authentication**: Required
- **Request Body**: `ChatForm`
- **Response Schema**: `Optional[ChatResponse]`
- **Response Codes**:
  - 200: Chat created successfully
  - 400: Bad request

#### Import Chats
Imports chat sessions from a backup.

- **HTTP Method**: POST
- **URL**: `/api/chats/import`
- **Authentication**: Required
- **Request Body**: `ChatsImportForm`
- **Response Schema**: `list[ChatResponse]`
- **Response Codes**:
  - 200: Chats imported successfully
  - 400: Bad request

#### Search User Chats
Searches chat sessions by content.

- **HTTP Method**: GET
- **URL**: `/api/chats/search`
- **Authentication**: Required
- **Query Parameters**:
  - `text`: Search text
  - `page`: Page number
- **Response Schema**: `list[ChatTitleIdResponse]`
- **Response Codes**:
  - 200: Search results retrieved
  - 400: Bad request

#### Get Chats by Folder ID
Retrieves chat sessions within a specific folder.

- **HTTP Method**: GET
- **URL**: `/api/chats/folder/{folder_id}`
- **Authentication**: Required
- **Path Parameters**:
  - `folder_id`: ID of the folder
- **Response Schema**: `list[ChatResponse]`
- **Response Codes**:
  - 200: Chats retrieved successfully
  - 400: Bad request

#### Get Pinned Chats
Retrieves pinned chat sessions.

- **HTTP Method**: GET
- **URL**: `/api/chats/pinned`
- **Authentication**: Required
- **Response Schema**: `list[ChatTitleIdResponse]`
- **Response Codes**:
  - 200: Pinned chats retrieved
  - 400: Bad request

#### Get All Chats
Retrieves all chat sessions for the user.

- **HTTP Method**: GET
- **URL**: `/api/chats/all`
- **Authentication**: Required
- **Response Schema**: `list[ChatResponse]`
- **Response Codes**:
  - 200: All chats retrieved
  - 400: Bad request

#### Get Archived Chats
Retrieves archived chat sessions.

- **HTTP Method**: GET
- **URL**: `/api/chats/all/archived`
- **Authentication**: Required
- **Response Schema**: `list[ChatResponse]`
- **Response Codes**:
  - 200: Archived chats retrieved
  - 400: Bad request

#### Get All Tags
Retrieves all tags associated with the user's chats.

- **HTTP Method**: GET
- **URL**: `/api/chats/all/tags`
- **Authentication**: Required
- **Response Schema**: `list[TagModel]`
- **Response Codes**:
  - 200: Tags retrieved successfully
  - 400: Bad request

#### Get All Chats in Database
Retrieves all chat sessions in the database (admin only).

- **HTTP Method**: GET
- **URL**: `/api/chats/all/db`
- **Authentication**: Required (admin)
- **Response Schema**: `list[ChatResponse]`
- **Response Codes**:
  - 200: All chats retrieved
  - 401: Unauthorized

#### Get Archived Chat List
Retrieves a list of archived chat sessions.

- **HTTP Method**: GET
- **URL**: `/api/chats/archived`
- **Authentication**: Required
- **Query Parameters**:
  - `page`: Page number
  - `query`: Search query
  - `order_by`: Field to order by
  - `direction`: Sort direction
- **Response Schema**: `list[ChatTitleIdResponse]`
- **Response Codes**:
  - 200: Archived chat list retrieved
  - 400: Bad request

#### Archive All Chats
Archives all chat sessions for the user.

- **HTTP Method**: POST
- **URL**: `/api/chats/archive/all`
- **Authentication**: Required
- **Response Schema**: boolean
- **Response Codes**:
  - 200: All chats archived successfully
  - 400: Bad request

#### Unarchive All Chats
Unarchives all archived chat sessions.

- **HTTP Method**: POST
- **URL**: `/api/chats/unarchive/all`
- **Authentication**: Required
- **Response Schema**: boolean
- **Response Codes**:
  - 200: All chats unarchived successfully
  - 400: Bad request

#### Get Shared Chat by ID
Retrieves a shared chat session.

- **HTTP Method**: GET
- **URL**: `/api/chats/share/{share_id}`
- **Authentication**: Required
- **Path Parameters**:
  - `share_id`: ID of the shared chat
- **Response Schema**: `Optional[ChatResponse]`
- **Response Codes**:
  - 200: Shared chat retrieved
  - 401: Unauthorized
  - 404: Not found

#### Get Chats by Tags
Retrieves chat sessions by tag name.

- **HTTP Method**: POST
- **URL**: `/api/chats/tags`
- **Authentication**: Required
- **Request Body**: `TagFilterForm`
- **Response Schema**: `list[ChatTitleIdResponse]`
- **Response Codes**:
  - 200: Chats retrieved by tag
  - 400: Bad request

#### Get Chat by ID
Retrieves a specific chat session.

- **HTTP Method**: GET
- **URL**: `/api/chats/{id}`
- **Authentication**: Required
- **Path Parameters**:
  - `id`: ID of the chat
- **Response Schema**: `Optional[ChatResponse]`
- **Response Codes**:
  - 200: Chat retrieved successfully
  - 401: Unauthorized
  - 404: Not found

#### Update Chat by ID
Updates a specific chat session.

- **HTTP Method**: POST
- **URL**: `/api/chats/{id}`
- **Authentication**: Required
- **Path Parameters**:
  - `id`: ID of the chat
- **Request Body**: `ChatForm`
- **Response Schema**: `Optional[ChatResponse]`
- **Response Codes**:
  - 200: Chat updated successfully
  - 401: Unauthorized
  - 404: Not found

#### Update Chat Message by ID
Updates a specific message within a chat.

- **HTTP Method**: POST
- **URL**: `/api/chats/{id}/messages/{message_id}`
- **Authentication**: Required
- **Path Parameters**:
  - `id`: ID of the chat
  - `message_id`: ID of the message
- **Request Body**: `MessageForm`
- **Response Schema**: `Optional[ChatResponse]`
- **Response Codes**:
  - 200: Message updated successfully
  - 401: Unauthorized
  - 404: Not found

#### Send Chat Message Event by ID
Sends an event for a specific chat message.

- **HTTP Method**: POST
- **URL**: `/api/chats/{id}/messages/{message_id}/event`
- **Authentication**: Required
- **Path Parameters**:
  - `id`: ID of the chat
  - `message_id`: ID of the message
- **Request Body**: `EventForm`
- **Response Schema**: `Optional[bool]`
- **Response Codes**:
  - 200: Event sent successfully
  - 401: Unauthorized
  - 404: Not found

#### Delete Chat by ID
Deletes a specific chat session.

- **HTTP Method**: DELETE
- **URL**: `/api/chats/{id}`
- **Authentication**: Required
- **Path Parameters**:
  - `id`: ID of the chat
- **Response Schema**: boolean
- **Response Codes**:
  - 200: Chat deleted successfully
  - 401: Unauthorized
  - 404: Not found

#### Get Pinned Status by ID
Retrieves the pinned status of a chat.

- **HTTP Method**: GET
- **URL**: `/api/chats/{id}/pinned`
- **Authentication**: Required
- **Path Parameters**:
  - `id`: ID of the chat
- **Response Schema**: `Optional[bool]`
- **Response Codes**:
  - 200: Pinned status retrieved
  - 401: Unauthorized
  - 404: Not found

#### Pin Chat by ID
Toggles the pinned status of a chat.

- **HTTP Method**: POST
- **URL**: `/api/chats/{id}/pin`
- **Authentication**: Required
- **Path Parameters**:
  - `id`: ID of the chat
- **Response Schema**: `Optional[ChatResponse]`
- **Response Codes**:
  - 200: Chat pinned/unpinned successfully
  - 401: Unauthorized
  - 404: Not found

#### Clone Chat
Creates a clone of an existing chat.

- **HTTP Method**: POST
- **URL**: `/api/chats/{id}/clone`
- **Authentication**: Required
- **Path Parameters**:
  - `id`: ID of the chat to clone
- **Request Body**: `CloneForm`
- **Response Schema**: `Optional[ChatResponse]`
- **Response Codes**:
  - 200: Chat cloned successfully
  - 401: Unauthorized
  - 404: Not found

#### Clone Shared Chat by ID
Creates a clone of a shared chat.

- **HTTP Method**: POST
- **URL**: `/api/chats/{id}/clone/shared`
- **Authentication**: Required
- **Path Parameters**:
  - `id`: ID of the shared chat
- **Response Schema**: `Optional[ChatResponse]`
- **Response Codes**:
  - 200: Shared chat cloned successfully
  - 401: Unauthorized
  - 404: Not found

#### Archive Chat
Toggles the archived status of a chat.

- **HTTP Method**: POST
- **URL**: `/api/chats/{id}/archive`
- **Authentication**: Required
- **Path Parameters**:
  - `id`: ID of the chat
- **Response Schema**: `Optional[ChatResponse]`
- **Response Codes**:
  - 200: Chat archived/unarchived successfully
  - 401: Unauthorized
  - 404: Not found

#### Share Chat by ID
Creates a shareable link for a chat.

- **HTTP Method**: POST
- **URL**: `/api/chats/{id}/share`
- **Authentication**: Required
- **Path Parameters**:
  - `id`: ID of the chat
- **Response Schema**: `Optional[ChatResponse]`
- **Response Codes**:
  - 200: Chat shared successfully
  - 401: Unauthorized
  - 404: Not found

**Section sources**
- [chats.py](file://backend/open_webui/routers/chats.py#L38-L797)

### Models
The models module manages AI models available in the system, including creation, retrieval, updating, and deletion.

#### Get Models
Retrieves a list of available models.

- **HTTP Method**: GET
- **URL**: `/api/models/list`
- **Authentication**: Required
- **Query Parameters**:
  - `query`: Search query
  - `view_option`: View option
  - `tag`: Filter by tag
  - `order_by`: Field to order by
  - `direction`: Sort direction
  - `page`: Page number
- **Response Schema**: `ModelListResponse`
- **Response Codes**:
  - 200: Models retrieved successfully
  - 400: Bad request

#### Get Base Models
Retrieves the base models available in the system.

- **HTTP Method**: GET
- **URL**: `/api/models/base`
- **Authentication**: Required (admin)
- **Response Schema**: `list[ModelResponse]`
- **Response Codes**:
  - 200: Base models retrieved
  - 401: Unauthorized

#### Get Model Tags
Retrieves all tags associated with models.

- **HTTP Method**: GET
- **URL**: `/api/models/tags`
- **Authentication**: Required
- **Response Schema**: `list[str]`
- **Response Codes**:
  - 200: Model tags retrieved
  - 400: Bad request

#### Create New Model
Creates a new model configuration.

- **HTTP Method**: POST
- **URL**: `/api/models/create`
- **Authentication**: Required (admin or with permission)
- **Request Body**: `ModelForm`
- **Response Schema**: `Optional[ModelModel]`
- **Response Codes**:
  - 200: Model created successfully
  - 400: Bad request
  - 401: Unauthorized
  - 409: Model ID already taken

#### Export Models
Exports model configurations.

- **HTTP Method**: GET
- **URL**: `/api/models/export`
- **Authentication**: Required (admin or with permission)
- **Response Schema**: `list[ModelModel]`
- **Response Codes**:
  - 200: Models exported successfully
  - 401: Unauthorized

#### Import Models
Imports model configurations.

- **HTTP Method**: POST
- **URL**: `/api/models/import`
- **Authentication**: Required (admin or with permission)
- **Request Body**: `ModelsImportForm`
- **Response Schema**: boolean
- **Response Codes**:
  - 200: Models imported successfully
  - 400: Bad request
  - 401: Unauthorized

#### Sync Models
Synchronizes model configurations.

- **HTTP Method**: POST
- **URL**: `/api/models/sync`
- **Authentication**: Required (admin)
- **Request Body**: `SyncModelsForm`
- **Response Schema**: `list[ModelModel]`
- **Response Codes**:
  - 200: Models synchronized successfully
  - 401: Unauthorized

#### Get Model by ID
Retrieves a specific model by ID.

- **HTTP Method**: GET
- **URL**: `/api/models/model`
- **Authentication**: Required
- **Query Parameters**:
  - `id`: ID of the model
- **Response Schema**: `Optional[ModelResponse]`
- **Response Codes**:
  - 200: Model retrieved successfully
  - 401: Unauthorized
  - 404: Not found

#### Get Model Profile Image
Retrieves the profile image for a model.

- **HTTP Method**: GET
- **URL**: `/api/models/model/profile/image`
- **Authentication**: Required
- **Query Parameters**:
  - `id`: ID of the model
- **Response**: Image file or redirect
- **Response Codes**:
  - 200: Image returned or redirect issued
  - 302: Redirect to external image
  - 404: Not found

#### Toggle Model by ID
Toggles the active status of a model.

- **HTTP Method**: POST
- **URL**: `/api/models/model/toggle`
- **Authentication**: Required
- **Query Parameters**:
  - `id`: ID of the model
- **Response Schema**: `Optional[ModelResponse]`
- **Response Codes**:
  - 200: Model toggled successfully
  - 400: Bad request
  - 401: Unauthorized
  - 404: Not found

#### Update Model by ID
Updates a specific model configuration.

- **HTTP Method**: POST
- **URL**: `/api/models/model/update`
- **Authentication**: Required
- **Request Body**: `ModelForm`
- **Response Schema**: `Optional[ModelModel]`
- **Response Codes**:
  - 200: Model updated successfully
  - 400: Bad request
  - 401: Unauthorized
  - 404: Not found

#### Delete Model by ID
Deletes a specific model configuration.

- **HTTP Method**: POST
- **URL**: `/api/models/model/delete`
- **Authentication**: Required
- **Request Body**: `ModelIdForm`
- **Response Schema**: boolean
- **Response Codes**:
  - 200: Model deleted successfully
  - 400: Bad request
  - 401: Unauthorized
  - 404: Not found

#### Delete All Models
Deletes all model configurations (admin only).

- **HTTP Method**: DELETE
- **URL**: `/api/models/delete/all`
- **Authentication**: Required (admin)
- **Response Schema**: boolean
- **Response Codes**:
  - 200: All models deleted successfully
  - 401: Unauthorized

**Section sources**
- [models.py](file://backend/open_webui/routers/models.py#L51-L418)

### Files
The files module manages file uploads, retrieval, and processing within the system.

#### Upload File
Uploads a new file to the system.

- **HTTP Method**: POST
- **URL**: `/api/files/`
- **Authentication**: Required
- **Request Parameters**:
  - `file`: File to upload (multipart)
  - `metadata`: Optional metadata (JSON string or object)
  - `process`: Whether to process the file (default: true)
  - `process_in_background`: Whether to process in background (default: true)
- **Response Schema**: `FileModelResponse`
- **Response Codes**:
  - 200: File uploaded successfully
  - 400: Bad request
  - 415: Unsupported media type

#### List Files
Retrieves a list of files.

- **HTTP Method**: GET
- **URL**: `/api/files/`
- **Authentication**: Required
- **Query Parameters**:
  - `content`: Include file content (default: true)
- **Response Schema**: `list[FileModelResponse]`
- **Response Codes**:
  - 200: Files retrieved successfully

#### Search Files
Searches for files by filename pattern.

- **HTTP Method**: GET
- **URL**: `/api/files/search`
- **Authentication**: Required
- **Query Parameters**:
  - `filename`: Filename pattern (supports wildcards)
  - `content`: Include file content (default: true)
- **Response Schema**: `list[FileModelResponse]`
- **Response Codes**:
  - 200: Files found successfully
  - 404: No files found

#### Delete All Files
Deletes all files (admin only).

- **HTTP Method**: DELETE
- **URL**: `/api/files/all`
- **Authentication**: Required (admin)
- **Response**: JSON object with message
- **Response Codes**:
  - 200: All files deleted successfully
  - 400: Bad request
  - 401: Unauthorized

#### Get File by ID
Retrieves information about a specific file.

- **HTTP Method**: GET
- **URL**: `/api/files/{id}`
- **Authentication**: Required
- **Path Parameters**:
  - `id`: ID of the file
- **Response Schema**: `Optional[FileModel]`
- **Response Codes**:
  - 200: File retrieved successfully
  - 404: Not found

#### Get File Process Status
Retrieves the processing status of a file.

- **HTTP Method**: GET
- **URL**: `/api/files/{id}/process/status`
- **Authentication**: Required
- **Path Parameters**:
  - `id`: ID of the file
- **Query Parameters**:
  - `stream`: Whether to stream status updates (default: false)
- **Response**: JSON object with status or SSE stream
- **Response Codes**:
  - 200: Status retrieved successfully
  - 404: Not found

#### Get File Data Content by ID
Retrieves the processed content of a file.

- **HTTP Method**: GET
- **URL**: `/api/files/{id}/data/content`
- **Authentication**: Required
- **Path Parameters**:
  - `id`: ID of the file
- **Response**: JSON object with content
- **Response Codes**:
  - 200: Content retrieved successfully
  - 404: Not found

#### Update File Data Content by ID
Updates the processed content of a file.

- **HTTP Method**: POST
- **URL**: `/api/files/{id}/data/content/update`
- **Authentication**: Required
- **Path Parameters**:
  - `id`: ID of the file
- **Request Body**: `ContentForm`
- **Response**: JSON object with updated content
- **Response Codes**:
  - 200: Content updated successfully
  - 404: Not found

#### Get File Content by ID
Retrieves the original file content.

- **HTTP Method**: GET
- **URL**: `/api/files/{id}/content`
- **Authentication**: Required
- **Path Parameters**:
  - `id`: ID of the file
- **Query Parameters**:
  - `attachment`: Whether to force attachment download (default: false)
- **Response**: File content with appropriate headers
- **Response Codes**:
  - 200: File content returned
  - 404: Not found

#### Get HTML File Content by ID
Retrieves HTML file content (admin only).

- **HTTP Method**: GET
- **URL**: `/api/files/{id}/content/html`
- **Authentication**: Required
- **Path Parameters**:
  - `id`: ID of the file
- **Response**: HTML file content
- **Response Codes**:
  - 200: HTML content returned
  - 404: Not found

#### Delete File by ID
Deletes a specific file.

- **HTTP Method**: DELETE
- **URL**: `/api/files/{id}`
- **Authentication**: Required
- **Path Parameters**:
  - `id`: ID of the file
- **Response**: JSON object with message
- **Response Codes**:
  - 200: File deleted successfully
  - 404: Not found

**Section sources**
- [files.py](file://backend/open_webui/routers/files.py#L152-L761)

### Users
The users module manages user accounts, permissions, and settings.

#### Get Users
Retrieves a list of users (admin only).

- **HTTP Method**: GET
- **URL**: `/api/users/`
- **Authentication**: Required (admin)
- **Query Parameters**:
  - `query`: Search query
  - `order_by`: Field to order by
  - `direction`: Sort direction
  - `page`: Page number
- **Response Schema**: `UserGroupIdsListResponse`
- **Response Codes**:
  - 200: Users retrieved successfully

#### Get All Users
Retrieves all users (admin only).

- **HTTP Method**: GET
- **URL**: `/api/users/all`
- **Authentication**: Required (admin)
- **Response Schema**: `UserInfoListResponse`
- **Response Codes**:
  - 200: All users retrieved

#### Search Users
Searches for users.

- **HTTP Method**: GET
- **URL**: `/api/users/search`
- **Authentication**: Required
- **Query Parameters**:
  - `query`: Search query
  - `order_by`: Field to order by
  - `direction`: Sort direction
  - `page`: Page number
- **Response Schema**: `UserInfoListResponse`
- **Response Codes**:
  - 200: Users found successfully

#### Get User Groups
Retrieves groups for the authenticated user.

- **HTTP Method**: GET
- **URL**: `/api/users/groups`
- **Authentication**: Required
- **Response**: List of groups
- **Response Codes**:
  - 200: Groups retrieved successfully

#### Get User Permissions
Retrieves permissions for the authenticated user.

- **HTTP Method**: GET
- **URL**: `/api/users/permissions`
- **Authentication**: Required
- **Response**: User permissions object
- **Response Codes**:
  - 200: Permissions retrieved successfully

#### Get Default User Permissions
Retrieves default user permissions (admin only).

- **HTTP Method**: GET
- **URL**: `/api/users/default/permissions`
- **Authentication**: Required (admin)
- **Response Schema**: `UserPermissions`
- **Response Codes**:
  - 200: Default permissions retrieved

#### Update Default User Permissions
Updates default user permissions (admin only).

- **HTTP Method**: POST
- **URL**: `/api/users/default/permissions`
- **Authentication**: Required (admin)
- **Request Body**: `UserPermissions`
- **Response**: Updated permissions
- **Response Codes**:
  - 200: Permissions updated successfully

#### Get User Settings by Session User
Retrieves settings for the authenticated user.

- **HTTP Method**: GET
- **URL**: `/api/users/user/settings`
- **Authentication**: Required
- **Response Schema**: `Optional[UserSettings]`
- **Response Codes**:
  - 200: Settings retrieved successfully
  - 400: Bad request

#### Update User Settings by Session User
Updates settings for the authenticated user.

- **HTTP Method**: POST
- **URL**: `/api/users/user/settings/update`
- **Authentication**: Required
- **Request Body**: `UserSettings`
- **Response Schema**: `UserSettings`
- **Response Codes**:
  - 200: Settings updated successfully
  - 400: Bad request

#### Get User Status by Session User
Retrieves status for the authenticated user.

- **HTTP Method**: GET
- **URL**: `/api/users/user/status`
- **Authentication**: Required
- **Response**: User status object
- **Response Codes**:
  - 200: Status retrieved successfully
  - 400: Bad request

#### Update User Status by Session User
Updates status for the authenticated user.

- **HTTP Method**: POST
- **URL**: `/api/users/user/status/update`
- **Authentication**: Required
- **Request Body**: `UserStatus`
- **Response**: Updated user object
- **Response Codes**:
  - 200: Status updated successfully
  - 400: Bad request

#### Get User Info by Session User
Retrieves additional info for the authenticated user.

- **HTTP Method**: GET
- **URL**: `/api/users/user/info`
- **Authentication**: Required
- **Response**: User info object
- **Response Codes**:
  - 200: Info retrieved successfully
  - 400: Bad request

#### Update User Info by Session User
Updates additional info for the authenticated user.

- **HTTP Method**: POST
- **URL**: `/api/users/user/info/update`
- **Authentication**: Required
- **Request Body**: Object with info fields
- **Response**: Updated info object
- **Response Codes**:
  - 200: Info updated successfully
  - 400: Bad request

#### Get User by ID
Retrieves information about a specific user.

- **HTTP Method**: GET
- **URL**: `/api/users/{user_id}`
- **Authentication**: Required
- **Path Parameters**:
  - `user_id`: ID of the user
- **Response Schema**: `UserActiveResponse`
- **Response Codes**:
  - 200: User retrieved successfully
  - 400: Bad request

#### Get User OAuth Sessions by ID
Retrieves OAuth sessions for a user (admin only).

- **HTTP Method**: GET
- **URL**: `/api/users/{user_id}/oauth/sessions`
- **Authentication**: Required (admin)
- **Path Parameters**:
  - `user_id`: ID of the user
- **Response**: List of OAuth sessions
- **Response Codes**:
  - 200: Sessions retrieved successfully
  - 400: Bad request

#### Get User Profile Image by ID
Retrieves the profile image for a user.

- **HTTP Method**: GET
- **URL**: `/api/users/{user_id}/profile/image`
- **Authentication**: Required
- **Path Parameters**:
  - `user_id`: ID of the user
- **Response**: Image file or redirect
- **Response Codes**:
  - 200: Image returned or redirect issued
  - 302: Redirect to external image
  - 400: Bad request

#### Get User Active Status by ID
Retrieves the active status of a user.

- **HTTP Method**: GET
- **URL**: `/api/users/{user_id}/active`
- **Authentication**: Required
- **Path Parameters**:
  - `user_id`: ID of the user
- **Response**: Object with active status
- **Response Codes**:
  - 200: Active status retrieved

#### Update User by ID
Updates information for a specific user.

- **HTTP Method**: POST
- **URL**: `/api/users/{user_id}/update`
- **Authentication**: Required (admin)
- **Path Parameters**:
  - `user_id`: ID of the user
- **Request Body**: `UserUpdateForm`
- **Response Schema**: `Optional[UserModel]`
- **Response Codes**:
  - 200: User updated successfully
  - 400: Bad request
  - 403: Action prohibited

#### Delete User by ID
Deletes a specific user.

- **HTTP Method**: DELETE
- **URL**: `/api/users/{user_id}`
- **Authentication**: Required (admin)
- **Path Parameters**:
  - `user_id`: ID of the user
- **Response Schema**: boolean
- **Response Codes**:
  - 200: User deleted successfully
  - 403: Action prohibited
  - 500: Internal server error

#### Get User Groups by ID
Retrieves groups for a specific user (admin only).

- **HTTP Method**: GET
- **URL**: `/api/users/{user_id}/groups`
- **Authentication**: Required (admin)
- **Path Parameters**:
  - `user_id`: ID of the user
- **Response**: List of groups
- **Response Codes**:
  - 200: Groups retrieved successfully

**Section sources**
- [users.py](file://backend/open_webui/routers/users.py#L57-L621)

### Utilities
The utilities module provides various helper endpoints for formatting, execution, and conversion.

#### Get Gravatar
Retrieves a Gravatar URL for an email address.

- **HTTP Method**: GET
- **URL**: `/api/utils/gravatar`
- **Authentication**: Required
- **Query Parameters**:
  - `email`: Email address
- **Response**: JSON object with gravatar URL
- **Response Codes**:
  - 200: Gravatar URL retrieved

#### Format Code
Formats code using the Black formatter.

- **HTTP Method**: POST
- **URL**: `/api/utils/code/format`
- **Authentication**: Required (admin)
- **Request Body**: `CodeForm`
- **Response**: JSON object with formatted code
- **Response Codes**:
  - 200: Code formatted successfully
  - 400: Bad request

#### Execute Code
Executes code in a Jupyter environment.

- **HTTP Method**: POST
- **URL**: `/api/utils/code/execute`
- **Authentication**: Required
- **Request Body**: `CodeForm`
- **Response**: Execution output
- **Response Codes**:
  - 200: Code executed successfully
  - 400: Bad request or engine not supported

#### Convert Markdown to HTML
Converts Markdown text to HTML.

- **HTTP Method**: POST
- **URL**: `/api/utils/markdown`
- **Authentication**: Required
- **Request Body**: `MarkdownForm`
- **Response**: JSON object with HTML
- **Response Codes**:
  - 200: Conversion successful

#### Generate PDF from Chat
Generates a PDF document from chat content.

- **HTTP Method**: POST
- **URL**: `/api/utils/pdf`
- **Authentication**: Required
- **Request Body**: `ChatTitleMessagesForm`
- **Response**: PDF file
- **Response Codes**:
  - 200: PDF generated successfully
  - 400: Bad request

#### Download Database
Downloads the database file (admin only).

- **HTTP Method**: GET
- **URL**: `/api/utils/db/download`
- **Authentication**: Required (admin)
- **Response**: Database file
- **Response Codes**:
  - 200: Database downloaded successfully
  - 401: Unauthorized
  - 400: Database not SQLite

**Section sources**
- [utils.py](file://backend/open_webui/routers/utils.py#L26-L127)

## WebSocket API
The open-webui application provides a WebSocket API for real-time interactions, particularly for chat streaming, collaborative editing, and presence tracking.

### Connection
WebSocket connections are established at the `/ws/socket.io` endpoint using Socket.IO protocol. Clients must authenticate by providing a token in the authentication data when connecting.

```javascript
const socket = io('http://localhost:8080/ws', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Events
The WebSocket API supports several events for real-time communication:

#### Usage
Tracks model usage by clients.

- **Event Name**: `usage`
- **Data Schema**: `{ model: string }`
- **Purpose**: Records when a client is using a specific model

#### User Join
Notifies when a user joins the system.

- **Event Name**: `user-join`
- **Data Schema**: `{ auth: { token: string } }`
- **Purpose**: Establishes user session and joins appropriate rooms

#### Heartbeat
Maintains user activity status.

- **Event Name**: `heartbeat`
- **Data**: None
- **Purpose**: Updates user's last active timestamp

#### Join Channels
Joins user to their channels.

- **Event Name**: `join-channels`
- **Data Schema**: `{ auth: { token: string } }`
- **Purpose**: Subscribes user to channel events

#### Join Note
Joins user to a collaborative note.

- **Event Name**: `join-note`
- **Data Schema**: `{ note_id: string, auth: { token: string } }`
- **Purpose**: Enables real-time collaboration on notes

#### Channel Events
Handles real-time events in channels.

- **Event Name**: `events:channel`
- **Data Schema**: `{ channel_id: string, data: { type: string, ... } }`
- **Types**:
  - `typing`: User is typing
  - `last_read_at`: User has read messages

#### Yjs Document Events
Supports real-time collaborative editing using Yjs.

- **Event Names**:
  - `ydoc:document:join`: User joins a document
  - `ydoc:document:state`: Document state update
  - `ydoc:document:update`: Document content update
  - `ydoc:document:leave`: User leaves a document
  - `ydoc:awareness:update`: Cursor/selection update
- **Purpose**: Enables collaborative editing of notes and other documents

#### Events
General event broadcasting.

- **Event Name**: `events`
- **Data Schema**: `{ chat_id: string, message_id: string, data: any }`
- **Purpose**: Sends various event types (status, message, replace, embeds, files, source, citation)

### Event Emitter
The server uses an event emitter pattern to send real-time updates to clients. This is particularly used during chat completion to stream responses and update message status.

```python
event_emitter = get_event_emitter({
    "user_id": user.id,
    "chat_id": chat_id,
    "message_id": message_id
})

# Stream response
await event_emitter({
    "type": "message",
    "data": {"content": "Hello"}
})
```

**Section sources**
- [socket/main.py](file://backend/open_webui/socket/main.py#L288-L800)

## API Versioning and Compatibility
The open-webui API does not use explicit versioning in the URL path. Instead, versioning is managed through the application's release cycle and backward compatibility is maintained for stable endpoints.

API changes are introduced in new releases with backward compatibility maintained for existing functionality. Breaking changes are minimized and when necessary, are introduced with appropriate deprecation notices.

The API follows semantic versioning principles, where:
- Major version changes may include breaking changes
- Minor version changes include new features while maintaining backward compatibility
- Patch version changes include bug fixes and minor improvements

Clients should monitor the application's release notes for information about API changes and deprecations.

**Section sources**
- [main.py](file://backend/open_webui/main.py#L656-L800)

## Security
The open-webui API implements several security measures to protect user data and system integrity.

### Authentication Methods
The API supports multiple authentication methods:

- **JWT Tokens**: Primary authentication method, with configurable expiration
- **API Keys**: For programmatic access, with optional endpoint restrictions
- **OAuth2**: Support for Google, Microsoft, GitHub, and custom OIDC providers
- **LDAP**: Enterprise directory integration
- **Trusted Headers**: For integration with reverse proxies

### Input Validation
All API endpoints perform thorough input validation to prevent injection attacks and ensure data integrity. Request bodies are validated against Pydantic models, and query parameters are sanitized.

### Rate Limiting
The API implements rate limiting to prevent abuse. The signin endpoint is limited to 5 attempts every 3 minutes. Additional rate limiting can be configured through the system settings.

### CORS
Cross-Origin Resource Sharing (CORS) is configurable through the `CORS_ALLOW_ORIGIN` setting. By default, the API allows requests from the same origin as the web interface.

### Security Headers
The API includes security headers to protect against common web vulnerabilities, including XSS, clickjacking, and MIME type sniffing.

### Data Encryption
Sensitive data such as passwords are hashed using bcrypt. API keys and OAuth tokens are stored securely. The system supports HTTPS for encrypted communication.

**Section sources**
- [auths.py](file://backend/open_webui/routers/auths.py#L86-L88)
- [main.py](file://backend/open_webui/main.py#L42-L51)
- [config.py](file://backend/open_webui/config.py#L289-L632)

## OpenAPI/Swagger Documentation
The open-webui application provides OpenAPI/Swagger documentation at the `/docs` endpoint when running in development mode (ENV=dev). This interactive documentation allows users to explore the API, view request/response schemas, and test endpoints directly from the browser.

The OpenAPI specification is automatically generated by FastAPI and includes detailed information about all endpoints, parameters, request/response models, and authentication requirements.

To access the documentation, navigate to `http://your-instance/docs` in your browser. The documentation is interactive and allows you to authenticate and test API calls directly.

The OpenAPI schema is also available in JSON format at `/openapi.json`.

**Section sources**
- [main.py](file://backend/open_webui/main.py#L656-L662)

## Error Handling
The API uses standard HTTP status codes to indicate the result of requests. All error responses follow a consistent format.

### Error Response Format
```json
{
  "detail": "Error message describing the issue"
}
```

### Common Status Codes
- **200 OK**: Request successful
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request parameters or body
- **401 Unauthorized**: Authentication required or failed
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

### Specific Error Messages
The API defines specific error messages for common scenarios:
- `INVALID_TOKEN`: Authentication token is invalid or expired
- `INVALID_CRED`: Invalid credentials
- `EMAIL_TAKEN`: Email address is already in use
- `MODEL_ID_TAKEN`: Model ID is already in use
- `ACCESS_PROHIBITED`: Action is not allowed
- `RATE_LIMIT_EXCEEDED`: Too many requests in given time period

Error messages are defined in the `constants.py` file and are consistent across the application.

**Section sources**
- [constants.py](file://backend/open_webui/constants.py)
- [auths.py](file://backend/open_webui/routers/auths.py#L30-L31)

## Rate Limiting
The open-webui API implements rate limiting to prevent abuse and ensure system stability.

### Signin Rate Limiting
The signin endpoint is protected by rate limiting to prevent brute force attacks. Users are limited to 5 login attempts every 3 minutes. Exceeding this limit results in a 429 Too Many Requests response.

```python
signin_rate_limiter = RateLimiter(
    redis_client=get_redis_client(), limit=5 * 3, window=60 * 3
)
```

### Configuration
Rate limiting is implemented using Redis for distributed rate tracking. The rate limiter configuration can be customized through environment variables and system settings.

### Custom Rate Limits
Additional rate limiting can be implemented for specific endpoints by adding rate limiter instances and decorating the appropriate route handlers.

The rate limiting system helps protect the application from denial-of-service attacks and ensures fair usage of system resources.

**Section sources**
- [auths.py](file://backend/open_webui/routers/auths.py#L86-L88)
- [utils/rate_limit.py](file://backend/open_webui/utils/rate_limit.py)