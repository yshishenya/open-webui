# Technology Stack

<cite>
**Referenced Files in This Document**   
- [main.py](file://backend/open_webui/main.py)
- [config.py](file://backend/open_webui/config.py)
- [package.json](file://package.json)
- [requirements.txt](file://backend/requirements.txt)
- [Dockerfile](file://Dockerfile)
- [docker-compose.yaml](file://docker-compose.yaml)
- [vite.config.ts](file://vite.config.ts)
- [svelte.config.js](file://svelte.config.js)
- [tailwind.config.js](file://tailwind.config.js)
- [+layout.svelte](file://src/routes/+layout.svelte)
- [socket/main.py](file://backend/open_webui/socket/main.py)
- [redis.py](file://backend/open_webui/utils/redis.py)
- [db.py](file://backend/open_webui/internal/db.py)
- [start.sh](file://backend/start.sh)
- [index.ts](file://src/lib/apis/index.ts)
- [constants.ts](file://src/lib/constants.ts)
- [chats.py](file://backend/open_webui/routers/chats.py)
- [rate_limit.py](file://backend/open_webui/utils/rate_limit.py)
- [cypress.config.ts](file://cypress.config.ts)
</cite>

## Table of Contents
1. [Backend Framework](#backend-framework)
2. [Frontend Framework](#frontend-framework)
3. [Supporting Technologies](#supporting-technologies)
4. [Containerization and Orchestration](#containerization-and-orchestration)
5. [Testing and Build Tools](#testing-and-build-tools)
6. [Deployment Infrastructure](#deployment-infrastructure)
7. [Technology Integration Examples](#technology-integration-examples)
8. [Version Compatibility and Dependency Management](#version-compatibility-and-dependency-management)

## Backend Framework

The open-webui application utilizes Python with FastAPI as its primary backend framework, providing a robust foundation for building modern web applications. FastAPI serves as the core REST API framework, leveraging Python's type hints and asynchronous capabilities to deliver high-performance endpoints with automatic OpenAPI documentation generation. The application's main entry point, `main.py`, initializes the FastAPI application with comprehensive configuration for various AI services, authentication mechanisms, and external integrations.

FastAPI's dependency injection system is extensively used throughout the application, with dependencies defined for user authentication, database sessions, and configuration management. The framework's middleware capabilities are employed for critical functionality including CORS handling, request compression, session management, and security headers. The application implements a modular router structure, with separate router modules for different functional areas such as authentication, chat management, file handling, and AI model integration.

The backend architecture follows a clean separation of concerns, with distinct layers for routing, business logic, data models, and database operations. The application leverages SQLAlchemy as its ORM (Object-Relational Mapper) for database interactions, providing a powerful and flexible interface for working with the PostgreSQL database. Alembic is used for database migrations, ensuring schema changes are managed systematically across deployments.

**Section sources**
- [main.py](file://backend/open_webui/main.py#L1-L800)
- [config.py](file://backend/open_webui/config.py#L100-L899)
- [chats.py](file://backend/open_webui/routers/chats.py#L50-L849)

## Frontend Framework

The frontend of the open-webui application is built using TypeScript with Svelte, a modern reactive framework that compiles away at build time to produce highly efficient vanilla JavaScript. Svelte's reactivity model eliminates the need for a virtual DOM, resulting in faster performance and smaller bundle sizes compared to traditional frameworks. The application's primary layout component, `+layout.svelte`, establishes the foundation for the entire user interface, managing global state, authentication, and real-time communication.

Svelte's component-based architecture is evident throughout the application, with a well-organized component hierarchy in the `src/lib/components` directory. The application leverages Svelte stores extensively for state management, with dedicated stores for configuration, user information, settings, theme preferences, and real-time data from the backend. The stores pattern enables reactive data flow across components without the need for prop drilling or complex state management libraries.

The frontend implements a sophisticated real-time communication system using Socket.IO, establishing a persistent connection between the client and server for instant updates. This enables features like live chat updates, real-time notifications, and collaborative editing. The application also integrates Pyodide, allowing Python code execution directly in the browser through WebAssembly, which facilitates advanced functionality like code interpretation and data analysis without server round-trips.

**Section sources**
- [+layout.svelte](file://src/routes/+layout.svelte#L1-L800)
- [index.ts](file://src/lib/apis/index.ts#L1-L800)
- [constants.ts](file://src/lib/constants.ts#L1-L104)

## Supporting Technologies

The open-webui application incorporates a comprehensive suite of supporting technologies that enhance its functionality and performance. Redis serves as the primary in-memory data store, handling session management, rate limiting, real-time communication coordination, and caching. The application's Redis implementation includes support for Redis Sentinel for high availability and failover capabilities, as well as Redis Cluster for distributed data storage. The rate limiting system, implemented in `rate_limit.py`, uses a rolling window strategy with Redis to prevent abuse of API endpoints while providing a fallback to in-memory storage if Redis is unavailable.

PostgreSQL is used as the primary relational database, storing user data, chat histories, configurations, and application metadata. The application supports various vector databases through its retrieval system, including Chroma, Weaviate, OpenSearch, and specialized solutions like pgvector, Milvus, Qdrant, and Pinecone, enabling advanced semantic search and retrieval-augmented generation (RAG) capabilities. The application also integrates with multiple AI service providers, including OpenAI, Anthropic, Google's Gemini, and local Ollama instances, providing flexibility in model selection and deployment.

For real-time communication, the application uses Socket.IO with support for both WebSocket and HTTP long-polling transports, ensuring compatibility across different network environments. The application implements a sophisticated event system that allows the backend to push updates to specific users or groups of users, enabling features like chat notifications, typing indicators, and collaborative document editing. The application also integrates with various external services for document processing, including Google Drive, OneDrive, and specialized document intelligence services.

**Section sources**
- [redis.py](file://backend/open_webui/utils/redis.py#L1-L231)
- [db.py](file://backend/open_webui/internal/db.py#L1-L165)
- [socket/main.py](file://backend/open_webui/socket/main.py#L50-L839)
- [config.py](file://backend/open_webui/config.py#L100-L899)

## Containerization and Orchestration

The open-webui application employs a sophisticated containerization strategy using Docker, with comprehensive support for various deployment scenarios and hardware configurations. The Dockerfile implements a multi-stage build process, separating the frontend and backend builds to optimize image size and build efficiency. The build process includes conditional compilation flags for CUDA support, Ollama integration, and slim builds, allowing for tailored deployments based on specific requirements.

The application provides extensive Docker configuration options through build arguments, enabling customization of embedding models, tokenization settings, and hardware acceleration. The Docker image is designed to be highly configurable at runtime through environment variables, supporting various deployment scenarios from development to production. The image includes support for user and group ID customization, facilitating deployment in environments with specific security requirements.

For orchestration, the application provides multiple docker-compose configurations tailored to different use cases, including GPU support, API-only deployments, and monitoring integration. The primary `docker-compose.yaml` file defines a production-ready configuration with PostgreSQL for persistent storage and proper service dependencies. The application also includes Kubernetes manifests in the `kubernetes/` directory, providing both base and GPU-optimized configurations for container orchestration at scale. The Kubernetes deployment includes Helm chart documentation, indicating support for advanced deployment patterns and configuration management.

**Section sources**
- [Dockerfile](file://Dockerfile#L1-L192)
- [docker-compose.yaml](file://docker-compose.yaml#L1-L60)
- [start.sh](file://backend/start.sh#L1-L87)

## Testing and Build Tools

The open-webui application implements a comprehensive testing and build infrastructure to ensure code quality and reliability. Cypress is used for end-to-end testing, with test scenarios covering critical user workflows including chat functionality, document management, and user settings. The Cypress configuration establishes a base URL for testing and enables video recording of test runs for debugging purposes. The test suite includes scenarios for registration, chat interactions, document handling, and settings management, providing broad coverage of the application's core functionality.

For frontend development and build processes, the application leverages Vite as its build tool, providing fast development server startup and hot module replacement. Vite is configured with Svelte integration and includes plugins for static file copying, particularly for WebAssembly assets required by the ONNX runtime. The build process is orchestrated through npm scripts defined in `package.json`, with commands for development, production builds, linting, formatting, and type checking. The application uses ESLint for code linting with a comprehensive configuration that includes plugins for TypeScript, Svelte, and Cypress testing.

The frontend build process incorporates Tailwind CSS for utility-first styling, with a custom configuration that extends the default color palette and typography settings. The application also uses PostCSS with Tailwind CSS plugins for container queries and typography, enabling responsive design patterns and consistent text styling. The build process generates source maps for debugging and includes optimization for production builds, with conditional removal of console logging statements based on the environment.

**Section sources**
- [cypress.config.ts](file://cypress.config.ts#L1-L9)
- [package.json](file://package.json#L1-L152)
- [vite.config.ts](file://vite.config.ts#L1-L33)
- [svelte.config.js](file://svelte.config.js#L1-L58)
- [tailwind.config.js](file://tailwind.config.js#L1-L47)

## Deployment Infrastructure

The open-webui application is designed with flexible deployment infrastructure that supports various hosting environments and scaling requirements. The application can be deployed using Docker Compose for simple setups, Kubernetes for complex orchestrated environments, or directly using the provided start script for traditional server deployments. The deployment configuration supports environment-specific settings through environment variables, allowing for easy configuration of database connections, AI service endpoints, authentication settings, and feature flags.

The application includes built-in support for various deployment scenarios, including Hugging Face Spaces, with specific configuration handling for space deployment in the `start.sh` script. The application can be configured to work behind reverse proxies with proper handling of forwarded headers, making it suitable for deployment in cloud environments with load balancers. The health check endpoint and proper container signaling ensure compatibility with orchestration platforms that require liveness and readiness probes.

For production deployments, the application provides configuration options for security hardening, including session security settings, content security policies, and permission hardening for OpenShift environments. The application supports external monitoring through OpenTelemetry instrumentation, enabling integration with observability platforms for tracing, metrics, and logging. The deployment infrastructure also includes support for billing integration with YooKassa, indicating readiness for commercial deployments with subscription management.

**Section sources**
- [Dockerfile](file://Dockerfile#L1-L192)
- [docker-compose.yaml](file://docker-compose.yaml#L1-L60)
- [start.sh](file://backend/start.sh#L1-L87)
- [kubernetes/manifest/base](file://kubernetes/manifest/base)
- [main.py](file://backend/open_webui/main.py#L1-L800)

## Technology Integration Examples

The open-webui application demonstrates sophisticated integration patterns between its various technologies, creating a cohesive and powerful user experience. One key integration pattern is the interaction between the Svelte frontend and FastAPI backend, where the frontend consumes REST APIs for data retrieval and mutation while maintaining real-time synchronization through Socket.IO events. For example, when a user creates a new chat, the frontend makes a POST request to the `/api/chats/new` endpoint, and upon success, the backend emits a `chat:created` event through Socket.IO that updates the chat list in all connected clients without requiring a page refresh.

Another critical integration is the use of Redis for rate limiting API endpoints, as implemented in `rate_limit.py`. This system works in conjunction with FastAPI's middleware to track request counts per user or IP address, preventing abuse while maintaining performance. The rate limiter uses Redis for storage but includes a fallback to in-memory storage, ensuring functionality even if Redis is temporarily unavailable. This integration demonstrates the application's resilience and graceful degradation capabilities.

The application also showcases advanced integration between the frontend and AI services through the direct connections feature. When enabled, the frontend can route requests directly to external AI providers like OpenAI, bypassing the backend for certain operations. This is implemented in the `+layout.svelte` file, where the `chatEventHandler` function handles direct chat completions by making requests to the configured AI provider endpoints. This integration reduces latency and server load while maintaining the same user experience.

**Section sources**
- [+layout.svelte](file://src/routes/+layout.svelte#L1-L800)
- [rate_limit.py](file://backend/open_webui/utils/rate_limit.py#L1-L140)
- [chats.py](file://backend/open_webui/routers/chats.py#L50-L849)
- [index.ts](file://src/lib/apis/index.ts#L1-L800)

## Version Compatibility and Dependency Management

The open-webui application maintains careful version compatibility and dependency management across both frontend and backend components. The backend dependencies are managed through `requirements.txt`, which specifies exact versions for critical packages including FastAPI (0.123.0), SQLAlchemy (2.0.38), and Redis (latest). The application also includes a `requirements-min.txt` file, suggesting support for minimal dependency installations in resource-constrained environments. The Docker build process includes version-specific configurations for PyTorch and ONNX runtime, ensuring compatibility with different hardware acceleration options.

For the frontend, dependencies are managed through `package.json`, which specifies exact versions for Svelte (5.0.0), Vite (5.4.14), and TypeScript (5.5.4). The application uses npm for package management with a `.npmrc` configuration file, indicating attention to consistent installation behavior across environments. The build process includes version-specific configurations for Tailwind CSS (4.0.0) and its plugins, ensuring compatibility between the CSS framework and its extensions.

The application implements a version update check feature, with configuration options to enable or disable automatic version checks. The frontend build process includes version embedding, with the application version and build hash injected into the build output, facilitating version tracking and debugging. The application also supports configuration through environment variables with sensible defaults, allowing for easy upgrades without requiring changes to configuration files. The migration system, using Alembic for database schema changes and a custom migration system for configuration data, ensures backward compatibility during upgrades.

**Section sources**
- [requirements.txt](file://backend/requirements.txt#L1-L153)
- [package.json](file://package.json#L1-L152)
- [Dockerfile](file://Dockerfile#L1-L192)
- [main.py](file://backend/open_webui/main.py#L1-L800)
- [config.py](file://backend/open_webui/config.py#L100-L899)