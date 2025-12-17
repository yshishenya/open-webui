# Chat Folders

<cite>
**Referenced Files in This Document**   
- [folders.py](file://backend/open_webui/models/folders.py)
- [chats.py](file://backend/open_webui/models/chats.py)
- [folders.py](file://backend/open_webui/routers/folders.py)
- [chats.py](file://backend/open_webui/routers/chats.py)
- [Folder.svelte](file://src/lib/components/common/Folder.svelte)
- [index.ts](file://src/lib/apis/folders/index.ts)
- [Sidebar.svelte](file://src/lib/components/layout/Sidebar.svelte)
- [c69f45358db4_add_folder_table.py](file://backend/open_webui/migrations/versions/c69f45358db4_add_folder_table.py)
- [018012973d35_add_indexes.py](file://backend/open_webui/migrations/versions/018012973d35_add_indexes.py)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Folder Model Implementation](#folder-model-implementation)
3. [Chat Model Integration](#chat-model-integration)
4. [Folder CRUD Operations](#folder-crud-operations)
5. [Frontend Components](#frontend-components)
6. [Database Schema and Indexes](#database-schema-and-indexes)
7. [Practical Examples](#practical-examples)
8. [Common Issues and Edge Cases](#common-issues-and-edge-cases)

## Introduction
The chat folders sub-feature provides a hierarchical organization system for chats, enabling users to create nested folder structures to better manage their conversations. This documentation details the implementation of this feature, focusing on the folder_id field in the Chat model, the Folder model relationship, CRUD operations through the folders router, frontend components for drag-and-drop organization, and database optimizations. The system supports nested folder structures with proper access control and referential integrity.

## Folder Model Implementation

The Folder model implements a hierarchical structure with parent-child relationships, allowing for nested folder organization. Each folder is associated with a specific user and can contain chats and other folders.

```mermaid
classDiagram
class Folder {
+string id
+string parent_id
+string user_id
+string name
+dict items
+dict meta
+dict data
+bool is_expanded
+int created_at
+int updated_at
}
class FolderModel {
+string id
+string parent_id
+string user_id
+string name
+dict items
+dict meta
+dict data
+bool is_expanded
+int created_at
+int updated_at
}
class FolderForm {
+string name
+dict data
+dict meta
}
class FolderUpdateForm {
+string name
+dict data
+dict meta
}
FolderTable --> Folder : "implements"
FolderTable --> FolderModel : "returns"
FolderTable --> FolderForm : "accepts"
FolderTable --> FolderUpdateForm : "accepts"
```

**Diagram sources**
- [folders.py](file://backend/open_webui/models/folders.py#L24-L48)

**Section sources**
- [folders.py](file://backend/open_webui/models/folders.py#L1-L367)

## Chat Model Integration

The Chat model integrates with the folder system through the folder_id field, establishing a relationship between chats and their containing folders. This field enables efficient querying and organization of chats within the hierarchical folder structure.

```mermaid
classDiagram
class Chat {
+string id
+string user_id
+string title
+dict chat
+int created_at
+int updated_at
+string share_id
+bool archived
+bool pinned
+dict meta
+string folder_id
}
class ChatModel {
+string id
+string user_id
+string title
+dict chat
+int created_at
+int updated_at
+string share_id
+bool archived
+bool pinned
+dict meta
+string folder_id
}
class ChatForm {
+dict chat
+string folder_id
}
ChatTable --> Chat : "implements"
ChatTable --> ChatModel : "returns"
ChatTable --> ChatForm : "accepts"
Folder "1" --> "0..*" Chat : "contains"
```

**Diagram sources**
- [chats.py](file://backend/open_webui/models/chats.py#L26-L42)

**Section sources**
- [chats.py](file://backend/open_webui/models/chats.py#L1-L1175)

## Folder CRUD Operations

The folders router provides comprehensive CRUD operations for managing folders, including creation, retrieval, updating, and deletion. These operations include validation rules and access control to ensure data integrity and security.

```mermaid
sequenceDiagram
participant Frontend
participant FoldersRouter
participant FolderTable
participant Database
Frontend->>FoldersRouter : POST /folders/
FoldersRouter->>FolderTable : insert_new_folder()
FolderTable->>Database : INSERT INTO folder
Database-->>FolderTable : Success
FolderTable-->>FoldersRouter : FolderModel
FoldersRouter-->>Frontend : 200 OK
Frontend->>FoldersRouter : GET /folders/
FoldersRouter->>FolderTable : get_folders_by_user_id()
FolderTable->>Database : SELECT * FROM folder
Database-->>FolderTable : Folder records
FolderTable-->>FoldersRouter : FolderModel[]
FoldersRouter-->>Frontend : 200 OK
Frontend->>FoldersRouter : POST /folders/{id}/update
FoldersRouter->>FolderTable : update_folder_by_id_and_user_id()
FolderTable->>Database : UPDATE folder
Database-->>FolderTable : Success
FolderTable-->>FoldersRouter : FolderModel
FoldersRouter-->>Frontend : 200 OK
Frontend->>FoldersRouter : DELETE /folders/{id}
FoldersRouter->>FolderTable : delete_folder_by_id_and_user_id()
FolderTable->>Database : DELETE FROM folder
Database-->>FolderTable : Success
FolderTable-->>FoldersRouter : Success
FoldersRouter-->>Frontend : 200 OK
```

**Diagram sources**
- [folders.py](file://backend/open_webui/routers/folders.py#L48-L328)
- [folders.py](file://backend/open_webui/models/folders.py#L86-L367)

**Section sources**
- [folders.py](file://backend/open_webui/routers/folders.py#L1-L328)

## Frontend Components

The frontend implementation provides a rich user interface for managing chat folders, including drag-and-drop functionality, folder creation, and chat movement between folders. The components are designed to work seamlessly with the backend API.

```mermaid
flowchart TD
A[Folder Component] --> B[Drag and Drop]
A --> C[Expand/Collapse]
A --> D[Add Folder]
A --> E[Update Folder]
B --> F[onDragOver]
B --> G[onDrop]
B --> H[onDragLeave]
C --> I[localStorage State]
C --> J[Collapsible]
D --> K[createNewFolder API]
E --> L[updateFolderById API]
M[Folder API] --> N[createNewFolder]
M --> O[getFolders]
M --> P[updateFolderById]
M --> Q[updateFolderParentIdById]
M --> R[deleteFolderById]
N --> S[POST /folders/]
P --> T[POST /folders/{id}/update]
Q --> U[POST /folders/{id}/update/parent]
R --> V[DELETE /folders/{id}]
```

**Diagram sources**
- [Folder.svelte](file://src/lib/components/common/Folder.svelte#L1-L203)
- [index.ts](file://src/lib/apis/folders/index.ts#L1-L275)

**Section sources**
- [Folder.svelte](file://src/lib/components/common/Folder.svelte#L1-L203)
- [index.ts](file://src/lib/apis/folders/index.ts#L1-L275)
- [Sidebar.svelte](file://src/lib/components/layout/Sidebar.svelte#L1-L1319)

## Database Schema and Indexes

The database schema for chat folders includes optimized indexes to ensure efficient queries for folder-based operations. The schema evolution is tracked through migration files that document the changes to the database structure.

```mermaid
erDiagram
FOLDER {
string id PK
string parent_id FK
string user_id
string name
json items
json meta
json data
bool is_expanded
bigint created_at
bigint updated_at
}
CHAT {
string id PK
string user_id
string title
json chat
bigint created_at
bigint updated_at
string share_id
bool archived
bool pinned
json meta
string folder_id FK
}
FOLDER ||--o{ FOLDER : "parent-child"
FOLDER ||--o{ CHAT : "contains"
```

**Diagram sources**
- [c69f45358db4_add_folder_table.py](file://backend/open_webui/migrations/versions/c69f45358db4_add_folder_table.py#L1-L50)
- [chats.py](file://backend/open_webui/models/chats.py#L26-L56)

The database includes several indexes to optimize folder-based queries:

| Index Name | Table | Columns | Purpose |
|------------|-------|---------|---------|
| folder_id_idx | chat | folder_id | Optimizes queries filtering by folder_id |
| user_id_pinned_idx | chat | user_id, pinned | Optimizes queries for pinned chats by user |
| user_id_archived_idx | chat | user_id, archived | Optimizes queries for archived chats by user |
| updated_at_user_id_idx | chat | updated_at, user_id | Optimizes queries ordering by updated_at |
| folder_id_user_id_idx | chat | folder_id, user_id | Optimizes queries filtering by folder_id and user_id |

**Section sources**
- [c69f45358db4_add_folder_table.py](file://backend/open_webui/migrations/versions/c69f45358db4_add_folder_table.py#L1-L50)
- [018012973d35_add_indexes.py](file://backend/open_webui/migrations/versions/018012973d35_add_indexes.py#L1-L47)

## Practical Examples

### Creating Nested Folder Structures
To create a nested folder structure, users can create parent folders and then create child folders within them. The system automatically handles the parent-child relationship through the parent_id field.

```mermaid
flowchart TD
A[Create "Projects" Folder] --> B[Create "Work" Folder]
B --> C[Set parent_id to "Projects"]
C --> D[Create "Personal" Folder]
D --> E[Set parent_id to "Projects"]
E --> F[Create "Client A" Folder]
F --> G[Set parent_id to "Work"]
```

### Moving Chats Between Folders
Chats can be moved between folders through the updateChatFolderIdById function, which updates the folder_id field in the Chat model.

```mermaid
sequenceDiagram
participant User
participant Frontend
participant Backend
participant Database
User->>Frontend : Drag chat to new folder
Frontend->>Backend : updateChatFolderIdById(chatId, newFolderId)
Backend->>Database : UPDATE chat SET folder_id = newFolderId
Database-->>Backend : Success
Backend-->>Frontend : Updated chat
Frontend-->>User : Chat moved successfully
```

### Displaying Folder Hierarchies in Sidebar
The sidebar component recursively renders folder hierarchies, maintaining expand/collapse state in localStorage for user preference persistence.

```mermaid
flowchart TD
A[Load Folders] --> B[Sort by updated_at]
B --> C[Build folder tree]
C --> D[Render root folders]
D --> E{Has children?}
E --> |Yes| F[Render child folders]
F --> G[Apply sorting]
G --> H[Check expand state]
H --> I[Render expanded children]
E --> |No| J[End]
```

**Section sources**
- [Sidebar.svelte](file://src/lib/components/layout/Sidebar.svelte#L1-L1319)
- [chats.py](file://backend/open_webui/routers/chats.py#L201-L213)

## Common Issues and Edge Cases

### Maintaining Referential Integrity When Deleting Folders
When deleting folders, the system must handle referential integrity by either deleting or reassigning chats within the folder. The delete_folder_by_id_and_user_id method recursively deletes all child folders and provides options for handling contained chats.

```mermaid
flowchart TD
A[Delete Folder] --> B{Delete contents?}
B --> |Yes| C[Delete all chats in folder]
B --> |No| D[Move chats to parent folder]
C --> E[Delete folder and children]
D --> E
E --> F[Remove folder from database]
F --> G[Update UI]
```

### Handling Edge Cases in Nested Folder Displays
The system handles several edge cases in nested folder displays, including circular references, missing parent folders, and permission issues.

```mermaid
flowchart TD
A[Load Folder Hierarchy] --> B{Parent exists?}
B --> |No| C[Set parent_id to null]
C --> D[Update database]
B --> |Yes| E{Circular reference?}
E --> |Yes| F[Break circular reference]
F --> G[Set parent_id to null]
G --> H[Update database]
E --> |No| I{Has permission?}
I --> |No| J[Hide folder]
I --> |Yes| K[Display folder]
```

The system includes validation to prevent common issues:
- Folder name uniqueness within the same parent
- Prevention of circular folder references
- Validation of folder ownership before operations
- Proper cleanup of database references when folders are deleted

**Section sources**
- [folders.py](file://backend/open_webui/models/folders.py#L281-L311)
- [folders.py](file://backend/open_webui/routers/folders.py#L275-L328)