# Tool and Function API

<cite>
**Referenced Files in This Document**   
- [tools.py](file://backend/open_webui/routers/tools.py)
- [functions.py](file://backend/open_webui/routers/functions.py)
- [tools.py](file://backend/open_webui/models/tools.py)
- [functions.py](file://backend/open_webui/models/functions.py)
- [tools.py](file://backend/open_webui/utils/tools.py)
- [plugin.py](file://backend/open_webui/utils/plugin.py)
- [index.ts](file://src/lib/apis/tools/index.ts)
- [index.ts](file://src/lib/apis/functions/index.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices) (if necessary)

## Introduction
The Open WebUI platform provides a comprehensive extensibility system through its tools and functions API. This documentation details the architecture, endpoints, and workflows for managing tools and functions within the system. The platform enables users to extend functionality through custom tools that can execute arbitrary code, call external APIs, and integrate with AI models. The system distinguishes between tools and functions, with tools focusing on external API integrations and functions providing pipeline processing capabilities. Security considerations, including sandboxing and permission controls, are integral to the design, ensuring safe execution of user-provided code.

## Project Structure
The tools and functions system is organized across multiple directories in the Open WebUI codebase. The backend contains the core implementation in the `open_webui` package, with routers handling API endpoints, models defining database schemas, and utils providing helper functions. The frontend implementation is located in the `src/lib` directory, with API clients and components for managing tools and functions. The system supports both local tools/functions and external tool servers via OpenAPI specifications.

```mermaid
graph TD
subgraph "Backend"
A[open_webui/routers/tools.py]
B[open_webui/routers/functions.py]
C[open_webui/models/tools.py]
D[open_webui/models/functions.py]
E[open_webui/utils/tools.py]
F[open_webui/utils/plugin.py]
end
subgraph "Frontend"
G[src/lib/apis/tools/index.ts]
H[src/lib/apis/functions/index.ts]
end
A --> E
B --> E
C --> F
D --> F
E --> F
G --> A
H --> B
```

**Diagram sources**
- [tools.py](file://backend/open_webui/routers/tools.py)
- [functions.py](file://backend/open_webui/routers/functions.py)
- [tools.py](file://backend/open_webui/models/tools.py)
- [functions.py](file://backend/open_webui/models/functions.py)
- [tools.py](file://backend/open_webui/utils/tools.py)
- [plugin.py](file://backend/open_webui/utils/plugin.py)
- [index.ts](file://src/lib/apis/tools/index.ts)
- [index.ts](file://src/lib/apis/functions/index.ts)

**Section sources**
- [tools.py](file://backend/open_webui/routers/tools.py)
- [functions.py](file://backend/open_webui/routers/functions.py)

## Core Components
The tools and functions system consists of several core components that work together to provide extensibility. The tools API allows for the creation, management, and execution of tools that can call external APIs or execute custom code. Functions provide pipeline processing capabilities with filter, action, and pipe types. The system uses a plugin architecture to load and execute user-provided code safely. Tool servers enable integration with external services via OpenAPI specifications. The frontend provides a user interface for managing tools and functions, with API clients that communicate with the backend endpoints.

**Section sources**
- [tools.py](file://backend/open_webui/routers/tools.py)
- [functions.py](file://backend/open_webui/routers/functions.py)
- [tools.py](file://backend/open_webui/models/tools.py)
- [functions.py](file://backend/open_webui/models/functions.py)

## Architecture Overview
The tools and functions system follows a modular architecture with clear separation between the frontend, backend, and data layers. The frontend provides a user interface for managing tools and functions, with API clients that communicate with the backend. The backend exposes RESTful endpoints for CRUD operations on tools and functions, with business logic implemented in the routers and models. The system uses a plugin architecture to load and execute user-provided code, with security measures to prevent unauthorized access. Tool servers enable integration with external services via OpenAPI specifications, with the system converting these specifications into tool payloads that can be executed by AI models.

```mermaid
graph TD
A[Frontend] --> B[Backend API]
B --> C[Database]
B --> D[Plugin System]
D --> E[External Services]
B --> F[Tool Servers]
F --> E
D --> G[User Code]
B --> H[Security Layer]
H --> B
H --> D
```

**Diagram sources**
- [tools.py](file://backend/open_webui/routers/tools.py)
- [functions.py](file://backend/open_webui/routers/functions.py)
- [tools.py](file://backend/open_webui/utils/tools.py)
- [plugin.py](file://backend/open_webui/utils/plugin.py)

## Detailed Component Analysis

### Tools API Analysis
The tools API provides endpoints for managing tools, which are used to extend the functionality of the Open WebUI platform. Tools can be created from local code or external URLs, and can call external APIs or execute custom code. The API supports listing available tools, executing tool calls, and managing tool configurations. Tools are registered with the system and exposed to AI models for function calling.

#### Class Diagram for Tools System
```mermaid
classDiagram
class Tool {
+string id
+string user_id
+string name
+string content
+list[dict] specs
+dict meta
+dict access_control
+int updated_at
+int created_at
}
class ToolForm {
+string id
+string name
+string content
+ToolMeta meta
+dict access_control
}
class ToolResponse {
+string id
+string user_id
+string name
+ToolMeta meta
+dict access_control
+int updated_at
+int created_at
}
class ToolUserResponse {
+string id
+string user_id
+string name
+ToolMeta meta
+dict access_control
+int updated_at
+int created_at
+UserResponse user
}
class ToolsTable {
+insert_new_tool(user_id, form_data, specs) ToolModel
+get_tool_by_id(id) ToolModel
+get_tools() list[ToolUserModel]
+get_tools_by_user_id(user_id, permission) list[ToolUserModel]
+get_tool_valves_by_id(id) dict
+update_tool_valves_by_id(id, valves) ToolValves
+get_user_valves_by_id_and_user_id(id, user_id) dict
+update_user_valves_by_id_and_user_id(id, user_id, valves) dict
+update_tool_by_id(id, updated) ToolModel
+delete_tool_by_id(id) bool
}
Tool --> ToolsTable : "managed by"
ToolForm --> Tool : "creates"
ToolResponse --> Tool : "represents"
ToolUserResponse --> Tool : "extends"
```

**Diagram sources**
- [tools.py](file://backend/open_webui/models/tools.py)
- [tools.py](file://backend/open_webui/routers/tools.py)

#### Sequence Diagram for Tool Execution
```mermaid
sequenceDiagram
participant Client as "Frontend Client"
participant Router as "Tools Router"
participant Tools as "Tools Table"
participant Plugin as "Plugin System"
participant External as "External Service"
Client->>Router : POST /tools/create
Router->>Tools : insert_new_tool()
Tools->>Plugin : load_tool_module_by_id()
Plugin->>Plugin : extract_frontmatter()
Plugin->>Plugin : replace_imports()
Plugin->>Plugin : exec(content)
Plugin-->>Tools : ToolModule
Tools-->>Router : ToolModel
Router-->>Client : ToolResponse
Client->>Router : GET /tools/
Router->>Tools : get_tools()
Tools-->>Router : list[ToolUserResponse]
Router-->>Client : list[ToolUserResponse]
Client->>Router : POST /tools/id/{id}/update
Router->>Tools : update_tool_by_id()
Tools->>Plugin : load_tool_module_by_id()
Plugin-->>Tools : ToolModule
Tools-->>Router : ToolModel
Router-->>Client : ToolModel
```

**Diagram sources**
- [tools.py](file://backend/open_webui/routers/tools.py)
- [tools.py](file://backend/open_webui/models/tools.py)
- [plugin.py](file://backend/open_webui/utils/plugin.py)

### Functions API Analysis
The functions API provides endpoints for managing functions, which are used for pipeline processing in the Open WebUI platform. Functions can be of type filter, action, or pipe, and are used to process data as it flows through the system. The API supports listing available functions, creating new functions, and managing function configurations. Functions are registered with the system and can be activated or deactivated as needed.

#### Class Diagram for Functions System
```mermaid
classDiagram
class Function {
+string id
+string user_id
+string name
+string type
+string content
+dict meta
+dict valves
+bool is_active
+bool is_global
+int updated_at
+int created_at
}
class FunctionForm {
+string id
+string name
+string content
+FunctionMeta meta
}
class FunctionResponse {
+string id
+string user_id
+string type
+string name
+FunctionMeta meta
+bool is_active
+bool is_global
+int updated_at
+int created_at
}
class FunctionUserResponse {
+string id
+string user_id
+string type
+string name
+FunctionMeta meta
+bool is_active
+bool is_global
+int updated_at
+int created_at
+UserModel user
}
class FunctionsTable {
+insert_new_function(user_id, type, form_data) FunctionModel
+sync_functions(user_id, functions) list[FunctionWithValvesModel]
+get_function_by_id(id) FunctionModel
+get_functions(active_only, include_valves) list[FunctionModel]
+get_function_list() list[FunctionUserResponse]
+get_functions_by_type(type, active_only) list[FunctionModel]
+get_global_filter_functions() list[FunctionModel]
+get_global_action_functions() list[FunctionModel]
+get_function_valves_by_id(id) dict
+update_function_valves_by_id(id, valves) FunctionValves
+update_function_metadata_by_id(id, metadata) FunctionModel
+get_user_valves_by_id_and_user_id(id, user_id) dict
+update_user_valves_by_id_and_user_id(id, user_id, valves) dict
+update_function_by_id(id, updated) FunctionModel
+deactivate_all_functions() bool
+delete_function_by_id(id) bool
}
Function --> FunctionsTable : "managed by"
FunctionForm --> Function : "creates"
FunctionResponse --> Function : "represents"
FunctionUserResponse --> Function : "extends"
```

**Diagram sources**
- [functions.py](file://backend/open_webui/models/functions.py)
- [functions.py](file://backend/open_webui/routers/functions.py)

#### Sequence Diagram for Function Management
```mermaid
sequenceDiagram
participant Client as "Frontend Client"
participant Router as "Functions Router"
participant Functions as "Functions Table"
participant Plugin as "Plugin System"
Client->>Router : POST /functions/create
Router->>Functions : insert_new_function()
Functions->>Plugin : load_function_module_by_id()
Plugin->>Plugin : extract_frontmatter()
Plugin->>Plugin : replace_imports()
Plugin->>Plugin : exec(content)
Plugin-->>Functions : FunctionModule
Functions-->>Router : FunctionModel
Router-->>Client : FunctionResponse
Client->>Router : GET /functions/
Router->>Functions : get_functions()
Functions-->>Router : list[FunctionResponse]
Router-->>Client : list[FunctionResponse]
Client->>Router : POST /functions/id/{id}/toggle
Router->>Functions : update_function_by_id()
Functions-->>Router : FunctionModel
Router-->>Client : FunctionModel
```

**Diagram sources**
- [functions.py](file://backend/open_webui/routers/functions.py)
- [functions.py](file://backend/open_webui/models/functions.py)
- [plugin.py](file://backend/open_webui/utils/plugin.py)

### Tool and Function Comparison
The system distinguishes between tools and functions, with different use cases and implementation details. Tools are primarily used for external API integrations and arbitrary code execution, while functions are used for pipeline processing within the system. The following table summarizes the key differences:

| Feature | Tools | Functions |
|-------|-------|-----------|
| **Purpose** | External API integration, arbitrary code execution | Pipeline processing, data transformation |
| **Types** | Single type with multiple functions | Filter, Action, Pipe |
| **Execution** | Direct API calls, external service integration | Integrated into processing pipeline |
| **Configuration** | Valves, UserValves, access control | Valves, UserValves, activation state |
| **Security** | Sandboxed execution, permission controls | Sandboxed execution, permission controls |
| **API Endpoints** | /tools/* | /functions/* |
| **Frontend Components** | Tools management interface | Functions management interface |

**Diagram sources**
- [tools.py](file://backend/open_webui/models/tools.py)
- [functions.py](file://backend/open_webui/models/functions.py)

### Tool Manifests and Parameter Schemas
Tools in the Open WebUI system use manifests and parameter schemas to define their interface and capabilities. The manifest is extracted from the tool's code using frontmatter comments, and includes metadata such as the tool's name, description, and required dependencies. The parameter schema is automatically generated from the tool's functions using Pydantic models, and is converted to OpenAI function calling format for use with AI models.

#### Flowchart for Tool Manifest Processing
```mermaid
flowchart TD
Start([Tool Code]) --> ExtractFrontmatter["Extract Frontmatter"]
ExtractFrontmatter --> InstallDependencies["Install Dependencies"]
InstallDependencies --> LoadModule["Load Module"]
LoadModule --> GetFunctions["Get Functions"]
GetFunctions --> CreatePydanticModels["Create Pydantic Models"]
CreatePydanticModels --> ConvertToOpenAISpec["Convert to OpenAI Spec"]
ConvertToOpenAISpec --> StoreSpecs["Store Specs in Tool Model"]
StoreSpecs --> End([Ready for AI Integration])
```

**Diagram sources**
- [plugin.py](file://backend/open_webui/utils/plugin.py)
- [tools.py](file://backend/open_webui/utils/tools.py)

### Tool Server Integration
The system supports integration with external tool servers via OpenAPI specifications. Tool servers can be configured with URLs to their OpenAPI specs, which are then converted into tool payloads that can be executed by AI models. The system handles authentication, parameter mapping, and response handling for tool server calls.

#### Sequence Diagram for Tool Server Integration
```mermaid
sequenceDiagram
participant Client as "Frontend Client"
participant Router as "Tools Router"
participant Tools as "Tools Table"
participant ToolServer as "Tool Server"
participant External as "External Service"
Client->>Router : GET /tools/
Router->>Tools : get_tools()
Tools->>ToolServer : get_tool_servers()
ToolServer->>External : GET OpenAPI Spec
External-->>ToolServer : OpenAPI Spec
ToolServer->>ToolServer : convert_openapi_to_tool_payload()
ToolServer-->>Tools : ToolServerData
Tools-->>Router : list[ToolUserResponse]
Router-->>Client : list[ToolUserResponse]
Client->>Router : Execute Tool Call
Router->>ToolServer : execute_tool_server()
ToolServer->>External : HTTP Request
External-->>ToolServer : Response
ToolServer-->>Router : Result
Router-->>Client : Result
```

**Diagram sources**
- [tools.py](file://backend/open_webui/routers/tools.py)
- [tools.py](file://backend/open_webui/utils/tools.py)

## Dependency Analysis
The tools and functions system has several key dependencies that enable its functionality. The system relies on Pydantic for data validation and model creation, FastAPI for the RESTful API, and SQLAlchemy for database operations. The plugin system uses Python's importlib to dynamically load user-provided code, with security measures to prevent unauthorized access. The system also depends on aiohttp for asynchronous HTTP requests, particularly for tool server integration.

```mermaid
graph TD
A[Tools and Functions System] --> B[Pydantic]
A --> C[FastAPI]
A --> D[SQLAlchemy]
A --> E[aiohttp]
A --> F[importlib]
A --> G[redis]
B --> H[Data Validation]
C --> I[RESTful API]
D --> J[Database Operations]
E --> K[HTTP Requests]
F --> L[Dynamic Code Loading]
G --> M[Caching]
```

**Diagram sources**
- [tools.py](file://backend/open_webui/routers/tools.py)
- [functions.py](file://backend/open_webui/routers/functions.py)
- [tools.py](file://backend/open_webui/utils/tools.py)
- [plugin.py](file://backend/open_webui/utils/plugin.py)

## Performance Considerations
The tools and functions system is designed with performance in mind, using caching and asynchronous operations to minimize latency. Tool and function modules are cached in memory after loading to avoid repeated file I/O and code execution. The system uses asynchronous HTTP requests for tool server integration, allowing for non-blocking operations. Database queries are optimized with appropriate indexing, particularly for frequently accessed fields like tool and function IDs.

## Troubleshooting Guide
When troubleshooting issues with the tools and functions system, consider the following common problems and solutions:

1. **Tool/Function Not Loading**: Verify that the code is valid Python and that all required dependencies are specified in the frontmatter. Check the server logs for import errors.

2. **Authentication Issues with Tool Servers**: Ensure that the authentication method and credentials are correctly configured in the tool server settings.

3. **Parameter Validation Errors**: Verify that the function parameters match the schema defined in the tool's spec. Check for type mismatches or missing required parameters.

4. **Performance Issues**: Monitor the system for slow tool server responses or high CPU usage. Consider optimizing the tool code or adding caching.

5. **Security Warnings**: Always verify the trustworthiness of tools and functions before installing them, as they can execute arbitrary code.

**Section sources**
- [tools.py](file://backend/open_webui/routers/tools.py)
- [functions.py](file://backend/open_webui/routers/functions.py)
- [tools.py](file://backend/open_webui/utils/tools.py)
- [plugin.py](file://backend/open_webui/utils/plugin.py)

## Conclusion
The tools and functions API in Open WebUI provides a powerful and flexible system for extending the platform's capabilities. By allowing users to create custom tools and functions, the system enables integration with external services and custom processing pipelines. The architecture is designed with security in mind, using sandboxing and permission controls to prevent unauthorized access. The system supports both local code execution and integration with external tool servers via OpenAPI specifications, providing a comprehensive solution for AI-powered function calling. With proper implementation and security practices, the tools and functions system can significantly enhance the functionality of the Open WebUI platform.