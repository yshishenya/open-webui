# Environment Configuration

<cite>
**Referenced Files in This Document**   
- [.env.example](file://.env.example)
- [backend/open_webui/env.py](file://backend/open_webui/env.py)
- [backend/open_webui/config.py](file://backend/open_webui/config.py)
- [backend/open_webui/utils/yookassa.py](file://backend/open_webui/utils/yookassa.py)
- [backend/open_webui/utils/billing_integration.py](file://backend/open_webui/utils/billing_integration.py)
- [docker-compose.yaml](file://docker-compose.yaml)
- [TROUBLESHOOTING.md](file://TROUBLESHOOTING.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Database Configuration](#database-configuration)
3. [Security Configuration](#security-configuration)
4. [AI Services Configuration](#ai-services-configuration)
5. [Billing Configuration](#billing-configuration)
6. [RAG System Configuration](#rag-system-configuration)
7. [Deployment Scenarios](#deployment-scenarios)
8. [Security Considerations](#security-considerations)
9. [Troubleshooting](#troubleshooting)

## Introduction
This document provides comprehensive guidance on configuring the Open WebUI environment. It covers all available environment variables, their purposes, and how they impact application behavior. The configuration is primarily managed through the `.env.example` file, which serves as a template for setting up the application in various environments. This guide categorizes variables by functionality, details critical configuration options, and provides examples for different deployment scenarios.

**Section sources**
- [.env.example](file://.env.example)

## Database Configuration
The database configuration in Open WebUI supports multiple database types and offers various connection parameters for optimal performance and reliability.

### Connection Parameters
The database connection is configured through several environment variables that define the database type, credentials, and connection details:

- **DATABASE_URL**: The complete database connection URL. For SQLite, it defaults to `sqlite:///{DATA_DIR}/webui.db`. For PostgreSQL, it should be in the format `postgresql://user:password@host:port/database`.
- **DATABASE_TYPE**: Specifies the database type (e.g., sqlite, postgresql).
- **DATABASE_USER**: Database username for authentication.
- **DATABASE_PASSWORD**: Database password for authentication.
- **DATABASE_HOST**: Host address of the database server.
- **DATABASE_PORT**: Port number on which the database server is listening.
- **DATABASE_NAME**: Name of the database to connect to.

When all database variables (type, user, password, host, port, name) are provided, the DATABASE_URL is automatically constructed from these components.

### Connection Pooling
Open WebUI provides configuration options for database connection pooling to optimize performance:

- **DATABASE_POOL_SIZE**: Maximum number of connections in the pool. Defaults to None (unlimited).
- **DATABASE_POOL_MAX_OVERFLOW**: Maximum number of connections that can be created beyond the pool size. Defaults to 0.
- **DATABASE_POOL_TIMEOUT**: Timeout in seconds for acquiring a connection from the pool. Defaults to 30 seconds.
- **DATABASE_POOL_RECYCLE**: Time in seconds after which connections are recycled. Defaults to 3600 seconds (1 hour).

### SQLite-Specific Options
For SQLite databases, additional configuration is available:

- **DATABASE_ENABLE_SQLITE_WAL**: Enables SQLite Write-Ahead Logging for better concurrency. Set to "true" to enable.
- **DATABASE_USER_ACTIVE_STATUS_UPDATE_INTERVAL**: Interval in seconds for updating user active status. Defaults to None (no updates).

### Example Configuration
```env
# PostgreSQL configuration
DATABASE_TYPE=postgresql
DATABASE_USER=openwebui
DATABASE_PASSWORD=securepassword123
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=openwebui_db

# Connection pooling
DATABASE_POOL_SIZE=20
DATABASE_POOL_MAX_OVERFLOW=10
DATABASE_POOL_TIMEOUT=30
DATABASE_POOL_RECYCLE=1800
```

**Section sources**
- [backend/open_webui/env.py](file://backend/open_webui/env.py#L280-L352)

## Security Configuration
Open WebUI provides comprehensive security configuration options to protect the application and user data.

### Authentication and Authorization
The security configuration includes settings for authentication, session management, and access control:

- **WEBUI_AUTH**: Enables or disables authentication. Set to "true" to require user authentication.
- **WEBUI_SECRET_KEY**: Secret key used for signing JWT tokens and encrypting sensitive data. This is a critical security setting.
- **JWT_EXPIRES_IN**: Duration for which JWT tokens remain valid. Format: number followed by unit (e.g., "4w" for 4 weeks).
- **ENABLE_API_KEYS**: Enables API key authentication for programmatic access.
- **ENABLE_API_KEYS_ENDPOINT_RESTRICTIONS**: Restricts API key access to specific endpoints.
- **API_KEYS_ALLOWED_ENDPOINTS**: Semicolon-separated list of endpoints accessible with API keys.

### Session and Cookie Security
Session management settings ensure secure user sessions:

- **WEBUI_SESSION_COOKIE_SAME_SITE**: SameSite attribute for session cookies. Options: "lax", "strict", or "none".
- **WEBUI_SESSION_COOKIE_SECURE**: Requires HTTPS for session cookies when set to "true".
- **WEBUI_AUTH_COOKIE_SAME_SITE**: SameSite attribute for authentication cookies.
- **WEBUI_AUTH_COOKIE_SECURE**: Requires HTTPS for authentication cookies.

### OAuth Configuration
Open WebUI supports OAuth integration with various providers:

- **ENABLE_OAUTH_SIGNUP**: Allows user registration through OAuth providers.
- **OAUTH_MERGE_ACCOUNTS_BY_EMAIL**: Merges accounts with the same email address from different OAuth providers.
- **GOOGLE_CLIENT_ID** and **GOOGLE_CLIENT_SECRET**: Credentials for Google OAuth integration.
- **MICROSOFT_CLIENT_ID** and **MICROSOFT_CLIENT_SECRET**: Credentials for Microsoft OAuth integration.
- **GITHUB_CLIENT_ID** and **GITHUB_CLIENT_SECRET**: Credentials for GitHub OAuth integration.
- **OAUTH_CLIENT_ID** and **OAUTH_CLIENT_SECRET**: Generic OAuth client credentials.
- **OPENID_PROVIDER_URL**: URL of the OpenID provider.

### Security Headers and CORS
Additional security settings include:

- **CORS_ALLOW_ORIGIN**: Origins allowed for Cross-Origin Resource Sharing. Use "*" for development, specific domains for production.
- **FORWARDED_ALLOW_IPS**: IPs allowed to set forwarded headers. Use "*" for development.
- **ENABLE_COMPRESSION_MIDDLEWARE**: Enables response compression to reduce bandwidth usage.

**Section sources**
- [backend/open_webui/env.py](file://backend/open_webui/env.py#L414-L520)
- [backend/open_webui/config.py](file://backend/open_webui/config.py#L290-L629)

## AI Services Configuration
The AI services configuration allows integration with various AI models and providers.

### Ollama Configuration
Ollama is the primary AI backend for Open WebUI:

- **OLLAMA_BASE_URL**: URL of the Ollama server. Defaults to `http://localhost:11434`.
- **OLLAMA_BASE_URLS**: Semicolon-separated list of Ollama URLs for load balancing or failover.
- **USE_CUDA_DOCKER**: Enables CUDA GPU acceleration when set to "true".
- **DEVICE_TYPE**: Automatically determined device type (cpu, cuda, mps) based on system capabilities.

### OpenAI Configuration
Open WebUI can also integrate with OpenAI services:

- **OPENAI_API_BASE_URL**: Base URL for OpenAI API. Leave empty to use the official OpenAI API.
- **OPENAI_API_KEY**: API key for authenticating with OpenAI services.
- **ENABLE_OPENAI_API**: Enables the OpenAI API integration when set to "true".

### Other AI Services
Additional AI service configurations include:

- **GEMINI_API_KEY**: API key for Google Gemini service.
- **GEMINI_API_BASE_URL**: Base URL for Gemini API.
- **AUTOMATIC1111_BASE_URL**: URL for AUTOMATIC1111 (Stable Diffusion) service.

### API Timeout Configuration
Timeout settings for AI service requests:

- **AIOHTTP_CLIENT_TIMEOUT**: Global timeout for HTTP requests to AI services in seconds.
- **AIOHTTP_CLIENT_TIMEOUT_MODEL_LIST**: Timeout for retrieving model lists from AI services.
- **AIOHTTP_CLIENT_TIMEOUT_TOOL_SERVER_DATA**: Timeout for tool server data requests.

**Section sources**
- [.env.example](file://.env.example)
- [backend/open_webui/env.py](file://backend/open_webui/env.py#L43-L69)
- [backend/open_webui/config.py](file://backend/open_webui/config.py#L993-L1004)

## Billing Configuration
Open WebUI includes a comprehensive billing system with support for YooKassa integration.

### Billing System Overview
The billing system manages user subscriptions, quotas, and payments:

- **BILLING_ENABLED**: Enables the billing system when set to "true".
- **ENABLE_BILLING**: Persistent configuration to enable billing features.
- **BILLING_MODEL_QUOTA_ENABLED**: Enables model-specific quotas.
- **BILLING_DEFAULT_QUOTA_LIMIT**: Default quota limit for users without a subscription.

### YooKassa Integration
YooKassa (formerly Yandex.Money) is supported as a payment gateway:

- **YOOKASSA_SHOP_ID**: Merchant ID provided by YooKassa.
- **YOOKASSA_SECRET_KEY**: Secret key for API authentication.
- **YOOKASSA_WEBHOOK_SECRET**: Secret for verifying webhook signatures.
- **BILLING_WEBHOOK_URL**: URL where YooKassa webhooks are received.

The YooKassa integration supports various payment methods including credit cards, bank transfers, and digital wallets. Webhooks are used to receive payment status updates, including successful payments, pending captures, and cancellations.

### Subscription and Quota Management
The billing system tracks usage and enforces quotas:

- **BILLING_SUBSCRIPTION_CHECK_INTERVAL**: Interval in seconds for checking subscription status.
- **BILLING_USAGE_TRACKING_ENABLED**: Enables tracking of AI model usage.
- **BILLING_QUOTA_CHECK_ENABLED**: Enables quota enforcement for API requests.

### Environment Variables in docker-compose.yaml
The docker-compose.yaml file includes specific billing-related environment variables:

```yaml
environment:
  - 'BILLING_ENABLED=${BILLING_ENABLED-true}'
  - 'YOOKASSA_SHOP_ID=${YOOKASSA_SHOP_ID}'
  - 'YOOKASSA_SECRET_KEY=${YOOKASSA_SECRET_KEY}'
  - 'YOOKASSA_WEBHOOK_SECRET=${YOOKASSA_WEBHOOK_SECRET}'
  - 'BILLING_WEBHOOK_URL=${BILLING_WEBHOOK_URL}'
```

**Section sources**
- [docker-compose.yaml](file://docker-compose.yaml#L47-L51)
- [backend/open_webui/utils/yookassa.py](file://backend/open_webui/utils/yookassa.py)
- [backend/open_webui/utils/billing_integration.py](file://backend/open_webui/utils/billing_integration.py)

## RAG System Configuration
The Retrieval-Augmented Generation (RAG) system in Open WebUI provides advanced document retrieval and processing capabilities.

### Embedding Models
The RAG system supports multiple embedding models and configuration options:

- **RAG_EMBEDDING_ENGINE**: Specifies the embedding engine to use. Options include "sentence_transformers", "openai", "ollama", and "azure_openai".
- **RAG_EMBEDDING_MODEL**: Name of the embedding model to use (e.g., "all-MiniLM-L6-v2").
- **RAG_EMBEDDING_BATCH_SIZE**: Number of documents to process in a single batch.
- **RAG_EMBEDDING_CONTENT_PREFIX**: Text prefix added to document content before embedding.
- **RAG_EMBEDDING_QUERY_PREFIX**: Text prefix added to queries before embedding.

### Reranking Models
Reranking improves the quality of retrieved documents:

- **RAG_RERANKING_ENGINE**: Specifies the reranking engine. Options include "sentence_transformers", "external", and "colbert".
- **RAG_RERANKING_MODEL**: Name of the reranking model to use.
- **RAG_EXTERNAL_RERANKER_URL**: URL for external reranking services.
- **RAG_EXTERNAL_RERANKER_API_KEY**: API key for external reranking services.

### Vector Database Configuration
The RAG system supports various vector databases:

- **RAG_VECTOR_DB**: Type of vector database to use (e.g., "chroma", "qdrant", "weaviate").
- **RAG_VECTOR_DB_URI**: Connection URI for the vector database.
- **RAG_VECTOR_DB_COLLECTION**: Name of the collection in the vector database.

### Advanced RAG Options
Additional configuration options for fine-tuning RAG behavior:

- **RAG_TOP_K**: Number of documents to retrieve for each query.
- **RAG_SIMILARITY_THRESHOLD**: Minimum similarity score for retrieved documents.
- **RAG_USE_BM25**: Enables BM25 keyword search in addition to vector search.
- **ENABLE_RAG_HYBRID_SEARCH**: Enables hybrid search combining vector and keyword search.

### API Configuration
The RAG system can be configured through API endpoints:

- **RAG_OPENAI_API_BASE_URL**: Base URL for OpenAI API when used for embeddings.
- **RAG_OPENAI_API_KEY**: API key for OpenAI services.
- **RAG_OLLAMA_BASE_URL**: Base URL for Ollama when used for embeddings.
- **RAG_OLLAMA_API_KEY**: API key for Ollama services.

**Section sources**
- [backend/open_webui/routers/retrieval.py](file://backend/open_webui/routers/retrieval.py#L132-L952)
- [backend/open_webui/main.py](file://backend/open_webui/main.py#L1033-L1073)

## Deployment Scenarios
This section provides environment configuration examples for different deployment scenarios.

### Development Environment
For local development, use the following configuration:

```env
# Basic settings
ENV=dev
WEBUI_NAME=Open WebUI Dev
WEBUI_SECRET_KEY=dev-secret-key-change-in-production

# Database
DATABASE_URL=sqlite:///data/webui.db
DATABASE_ENABLE_SQLITE_WAL=true

# Security
WEBUI_AUTH=true
CORS_ALLOW_ORIGIN=http://localhost:5173;http://localhost:8080
FORWARDED_ALLOW_IPS=127.0.0.1

# AI Services
OLLAMA_BASE_URL=http://localhost:11434
OPENAI_API_KEY=sk-your-openai-key
ENABLE_OPENAI_API=true

# Debugging
GLOBAL_LOG_LEVEL=DEBUG
OLLAMA_LOG_LEVEL=DEBUG
RAG_LOG_LEVEL=DEBUG

# Disable analytics
SCARF_NO_ANALYTICS=true
DO_NOT_TRACK=true
```

### Production Environment
For production deployment, use a more secure configuration:

```env
# Basic settings
ENV=prod
WEBUI_NAME=Open WebUI
WEBUI_SECRET_KEY=your-secure-random-key-here

# Database (PostgreSQL recommended for production)
DATABASE_TYPE=postgresql
DATABASE_USER=openwebui
DATABASE_PASSWORD=strong-password-here
DATABASE_HOST=postgres-server
DATABASE_PORT=5432
DATABASE_NAME=openwebui_prod
DATABASE_POOL_SIZE=20
DATABASE_POOL_MAX_OVERFLOW=10

# Security
WEBUI_AUTH=true
WEBUI_SESSION_COOKIE_SECURE=true
WEBUI_AUTH_COOKIE_SECURE=true
CORS_ALLOW_ORIGIN=https://yourdomain.com
FORWARDED_ALLOW_IPS=127.0.0.1

# AI Services
OLLAMA_BASE_URLS=http://ollama1:11434;http://ollama2:11434
ENABLE_OPENAI_API=false

# Production optimizations
UVICORN_WORKERS=4
ENABLE_COMPRESSION_MIDDLEWARE=true

# Analytics
SCARF_NO_ANALYTICS=false
DO_NOT_TRACK=false
```

### GPU-Enabled Environment
For deployments with GPU acceleration:

```env
# GPU configuration
USE_CUDA_DOCKER=true
DEVICE_TYPE=cuda

# Ollama with GPU
OLLAMA_BASE_URL=http://localhost:11434
# In docker-compose.gpu.yaml, GPU resources are configured:
# deploy:
#   resources:
#     reservations:
#       devices:
#         - driver: nvidia
#           count: 1
#           capabilities:
#             - gpu

# RAG with GPU
SENTENCE_TRANSFORMERS_BACKEND=cuda
RAG_EMBEDDING_BATCH_SIZE=32

# Performance
UVICORN_WORKERS=2
AIOHTTP_CLIENT_TIMEOUT=600
```

### Docker Compose Configuration
The docker-compose.yaml file provides a complete example of environment configuration:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=${POSTGRES_DB-airis}
      - POSTGRES_USER=${POSTGRES_USER-airis}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD-airis_password}
    volumes:
      - postgres-data:/var/lib/postgresql/data

  airis:
    image: ghcr.io/open-webui/open-webui:${WEBUI_DOCKER_TAG-main}
    volumes:
      - airis:/app/backend/data
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - ${OPEN_WEBUI_PORT-3000}:8080
    environment:
      - 'OLLAMA_BASE_URL=${OLLAMA_BASE_URL}'
      - 'WEBUI_SECRET_KEY=${WEBUI_SECRET_KEY}'
      - 'DATABASE_URL=postgresql://${POSTGRES_USER-airis}:${POSTGRES_PASSWORD-airis_password}@postgres:5432/${POSTGRES_DB-airis}'
      - 'BILLING_ENABLED=${BILLING_ENABLED-true}'
      - 'YOOKASSA_SHOP_ID=${YOOKASSA_SHOP_ID}'
      - 'YOOKASSA_SECRET_KEY=${YOOKASSA_SECRET_KEY}'
      - 'YOOKASSA_WEBHOOK_SECRET=${YOOKASSA_WEBHOOK_SECRET}'
      - 'BILLING_WEBHOOK_URL=${BILLING_WEBHOOK_URL}'
    extra_hosts:
      - host.docker.internal:host-gateway
```

**Section sources**
- [.env.example](file://.env.example)
- [docker-compose.yaml](file://docker-compose.yaml)
- [docker-compose.gpu.yaml](file://docker-compose.gpu.yaml)

## Security Considerations
Proper security configuration is critical for protecting Open WebUI and user data.

### Sensitive Configuration Data
Handle sensitive configuration data with care:

- **Never commit secrets to version control**: Keep .env files out of git repositories using .gitignore.
- **Use environment variables in production**: Store secrets in environment variables rather than configuration files.
- **Rotate secrets regularly**: Change WEBUI_SECRET_KEY and API keys periodically.
- **Use strong, random keys**: Generate cryptographically secure random keys for WEBUI_SECRET_KEY.

### Secure Secret Key Management
The WEBUI_SECRET_KEY is particularly important:

- **Minimum length**: Use at least 32 characters.
- **Random generation**: Use cryptographically secure random generators.
- **Storage**: Store in environment variables or secure secret management systems.
- **Rotation**: Have a plan for rotating the secret key without disrupting user sessions.

### Production Security Best Practices
Implement these security measures in production:

- **Use HTTPS**: Always serve Open WebUI over HTTPS in production.
- **Secure cookies**: Set WEBUI_SESSION_COOKIE_SECURE and WEBUI_AUTH_COOKIE_SECURE to true.
- **Restrict CORS**: Limit CORS_ALLOW_ORIGIN to specific domains.
- **Update regularly**: Keep Open WebUI and dependencies up to date.
- **Monitor logs**: Regularly review application logs for suspicious activity.

### OAuth Security
When using OAuth integration:

- **Use HTTPS for redirect URIs**: OAuth redirect URIs should use HTTPS.
- **Validate tokens**: Always validate OAuth tokens before accepting them.
- **Limit scopes**: Request only the minimum necessary OAuth scopes.
- **Verify signatures**: Validate JWT signatures for OAuth tokens.

### Database Security
Secure database connections:

- **Use strong passwords**: Ensure database passwords are complex and unique.
- **Limit privileges**: Database users should have only necessary privileges.
- **Encrypt connections**: Use SSL/TLS for database connections when possible.
- **Regular backups**: Implement regular database backups with secure storage.

**Section sources**
- [backend/open_webui/env.py](file://backend/open_webui/env.py#L455-L482)
- [backend/open_webui/__init__.py](file://backend/open_webui/__init__.py#L38-L47)

## Troubleshooting
This section addresses common configuration issues and their solutions.

### Connection Failures
Common connection issues and solutions:

- **Ollama connection errors**: 
  - Verify OLLAMA_BASE_URL is correct and accessible.
  - In Docker deployments, use `--network=host` or ensure proper network configuration.
  - Check that Ollama is running and listening on the specified port.

- **Database connection errors**:
  - Verify database credentials and connection parameters.
  - Ensure the database server is running and accessible.
  - Check firewall settings that might block the connection.

- **Redis connection errors**:
  - Verify REDIS_URL is correctly formatted.
  - Ensure Redis server is running and accessible.
  - Check authentication credentials if Redis requires a password.

### Authentication Errors
Common authentication issues:

- **Invalid JWT tokens**:
  - Ensure WEBUI_SECRET_KEY is consistent across all instances.
  - Check JWT_EXPIRES_IN setting if tokens expire too quickly.
  - Verify clock synchronization between servers.

- **OAuth configuration errors**:
  - Ensure redirect URIs are correctly configured in the OAuth provider.
  - Verify client IDs and secrets are correct.
  - Check that the OAuth provider is accessible.

### Model Loading Problems
Issues with AI model loading:

- **Model not found**:
  - Verify the model name is correct and available in Ollama.
  - Check that Ollama has internet access to download models.
  - Ensure sufficient disk space for model storage.

- **GPU acceleration issues**:
  - Verify CUDA drivers are properly installed.
  - Check that the GPU is accessible to the container.
  - Ensure USE_CUDA_DOCKER is set to "true".

- **Embedding model errors**:
  - Verify RAG_EMBEDDING_MODEL name is correct.
  - Check internet connectivity for downloading embedding models.
  - Ensure sufficient memory for loading embedding models.

### Performance Issues
Addressing performance problems:

- **Slow responses**:
  - Increase AIOHTTP_CLIENT_TIMEOUT for slow AI services.
  - Optimize database performance with proper indexing.
  - Consider scaling up hardware resources.

- **High memory usage**:
  - Reduce RAG_EMBEDDING_BATCH_SIZE.
  - Monitor and optimize vector database memory usage.
  - Consider using smaller embedding models.

- **Timeout errors**:
  - Increase appropriate timeout settings.
  - Check network connectivity between services.
  - Optimize AI model performance.

**Section sources**
- [TROUBLESHOOTING.md](file://TROUBLESHOOTING.md)
- [backend/open_webui/env.py](file://backend/open_webui/env.py#L664-L672)