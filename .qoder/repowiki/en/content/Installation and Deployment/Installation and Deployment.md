# Installation and Deployment

<cite>
**Referenced Files in This Document**   
- [README.md](file://README.md)
- [INSTALLATION.md](file://INSTALLATION.md)
- [TROUBLESHOOTING.md](file://TROUBLESHOOTING.md)
- [.env.example](file://.env.example)
- [Dockerfile](file://Dockerfile)
- [docker-compose.yaml](file://docker-compose.yaml)
- [kubernetes/manifest/base/webui-deployment.yaml](file://kubernetes/manifest/base/webui-deployment.yaml)
- [kubernetes/manifest/base/webui-service.yaml](file://kubernetes/manifest/base/webui-service.yaml)
- [kubernetes/manifest/base/webui-ingress.yaml](file://kubernetes/manifest/base/webui-ingress.yaml)
- [kubernetes/manifest/gpu/kustomization.yaml](file://kubernetes/manifest/gpu/kustomization.yaml)
- [kubernetes/helm/README.md](file://kubernetes/helm/README.md)
- [backend/start.sh](file://backend/start.sh)
- [backend/dev.sh](file://backend/dev.sh)
</cite>

## Table of Contents
1. [Installation Methods](#installation-methods)
2. [Environment Configuration](#environment-configuration)
3. [Deployment Scenarios](#deployment-scenarios)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Initialization Process](#initialization-process)
6. [Troubleshooting Guide](#troubleshooting-guide)
7. [Performance Optimization](#performance-optimization)

## Installation Methods

### Docker Installation
The primary installation method for open-webui is through Docker using docker-compose. The default configuration in `docker-compose.yaml` sets up a complete environment with PostgreSQL database and the webui service.

To install using Docker:
```bash
docker compose up -d
```

The Docker deployment uses the official image from ghcr.io with the tag specified by `WEBUI_DOCKER_TAG` (defaults to "main"). The container exposes port 8080 internally, mapped to `OPEN_WEBUI_PORT` (defaults to 3000) on the host.

**Key Docker Configuration**:
- Data persistence is handled through Docker volumes (`airis` and `postgres-data`)
- Database connection is established via environment variables
- Health checks ensure service readiness
- The container restarts automatically unless explicitly stopped

**Section sources**
- [docker-compose.yaml](file://docker-compose.yaml#L1-L60)
- [Dockerfile](file://Dockerfile#L1-L192)

### Direct Installation
For development or custom deployment scenarios, open-webui can be installed directly:

```bash
npm install
npm run dev
```

This method requires Node.js and npm to be installed on the system. The development server runs with CORS configured for common development ports (5173 and 8080).

**Section sources**
- [README.md](file://README.md#L15-L18)
- [backend/dev.sh](file://backend/dev.sh#L1-L4)

## Environment Configuration

### Environment Variables
Configuration is managed through environment variables, with `.env.example` providing a comprehensive reference for available options.

**Core Configuration Variables**:
- `OLLAMA_BASE_URL`: Specifies the Ollama API endpoint (default: http://localhost:11434)
- `CORS_ALLOW_ORIGIN`: Defines allowed origins for CORS (default: *)
- `FORWARDED_ALLOW_IPS`: Configures trusted proxies (default: *)
- `WEBUI_SECRET_KEY`: Secret key for authentication (auto-generated if not provided)

**Analytics and Privacy**:
- `SCARF_NO_ANALYTICS`: Disables Scarf analytics (default: true)
- `DO_NOT_TRACK`: Enables do-not-track mode (default: true)
- `ANONYMIZED_TELEMETRY`: Controls anonymized telemetry collection (default: false)

**Database Configuration**:
- `DATABASE_URL`: PostgreSQL connection string in the format `postgresql://user:password@host:port/database`

**API Integration**:
- `OPENAI_API_BASE_URL`: Alternative API endpoint for OpenAI-compatible services
- `OPENAI_API_KEY`: Authentication key for OpenAI API

**Section sources**
- [.env.example](file://.env.example#L1-L22)
- [Dockerfile](file://Dockerfile#L58-L78)

## Deployment Scenarios

### Local Development
For local development, use the direct installation method with the development script:

```bash
npm install
npm run dev
```

The development environment automatically configures CORS for common frontend development servers and enables hot reloading.

**Development Configuration**:
- Runs on port 5173 by default
- CORS allows localhost:5173 and localhost:8080
- Auto-reload enabled for code changes

**Section sources**
- [README.md](file://README.md#L13-L18)
- [backend/dev.sh](file://backend/dev.sh#L1-L4)

### Production Deployment
Production deployments should use the Docker-based approach with appropriate security configurations:

1. Set `CORS_ALLOW_ORIGIN` to specific domains rather than wildcard (*)
2. Configure `FORWARDED_ALLOW_IPS` to match your proxy configuration
3. Provide a strong `WEBUI_SECRET_KEY`
4. Use a dedicated PostgreSQL instance with proper backups
5. Configure reverse proxy (nginx, Apache) with SSL termination

The production Docker image is optimized with multi-stage builds and includes all necessary dependencies.

**Section sources**
- [docker-compose.yaml](file://docker-compose.yaml#L1-L60)
- [Dockerfile](file://Dockerfile#L25-L192)

### GPU-Enabled Deployment
For GPU-accelerated inference, the Docker image supports CUDA through build arguments:

```bash
docker build --build-arg USE_CUDA=true --build-arg USE_CUDA_VER=cu128 -t open-webui-gpu .
```

The GPU version includes CUDA-optimized PyTorch libraries and configures the appropriate library paths at runtime.

**GPU Configuration**:
- Set `USE_CUDA=true` to enable CUDA support
- Specify CUDA version with `USE_CUDA_VER` (e.g., cu128 for CUDA 12.8)
- Ensure NVIDIA container toolkit is installed on the host
- Mount GPU devices using Docker's `--gpus` flag

**Section sources**
- [Dockerfile](file://Dockerfile#L4-L9)
- [backend/start.sh](file://backend/start.sh#L43-L46)

## Kubernetes Deployment

### Kustomize Deployment
open-webui provides Kubernetes manifests for deployment via Kustomize:

**CPU-Only Deployment**:
```bash
kubectl apply -f ./kubernetes/manifest/base
```

**GPU-Enabled Deployment**:
```bash
kubectl apply -k ./kubernetes/manifest
```

The GPU deployment uses a kustomization overlay that patches the base configuration with GPU-specific settings.

**Kubernetes Components**:
- **Deployment**: Manages the webui application with resource requests and limits
- **Service**: Exposes the application via NodePort (can be changed to LoadBalancer)
- **Ingress**: Provides external access with host-based routing
- **PersistentVolumeClaim**: Ensures data persistence across pod restarts

**Resource Configuration**:
- CPU: 500m request, 1000m limit
- Memory: 500Mi request, 1Gi limit
- Storage: Persistent volume for data persistence

**Section sources**
- [INSTALLATION.md](file://INSTALLATION.md#L1-L13)
- [kubernetes/manifest/base/webui-deployment.yaml](file://kubernetes/manifest/base/webui-deployment.yaml#L1-L38)
- [kubernetes/manifest/base/webui-service.yaml](file://kubernetes/manifest/base/webui-service.yaml#L1-L15)
- [kubernetes/manifest/base/webui-ingress.yaml](file://kubernetes/manifest/base/webui-ingress.yaml#L1-L21)
- [kubernetes/manifest/gpu/kustomization.yaml](file://kubernetes/manifest/gpu/kustomization.yaml#L1-L9)

### Helm Chart Deployment
While the repository contains Helm documentation, the charts are now hosted in a separate repository:

```bash
helm package ./kubernetes/helm/
helm install ollama-webui ./ollama-webui-*.tgz
```

For GPU-enabled deployments:
```bash
helm install ollama-webui ./ollama-webui-*.tgz --set ollama.resources.limits.nvidia.com/gpu="1"
```

The Helm chart allows customization through values in `values.yaml` and supports both CPU and GPU configurations.

**Section sources**
- [INSTALLATION.md](file://INSTALLATION.md#L15-L36)
- [kubernetes/helm/README.md](file://kubernetes/helm/README.md#L1-L4)

## Initialization Process

### Database Setup
The application uses PostgreSQL as its primary database with automatic migration management:

1. The `postgres` service initializes with the specified database, user, and password
2. The webui service waits for the database to be healthy before starting
3. Alembic manages database migrations automatically

**Database Configuration**:
- Database name: Configurable via `POSTGRES_DB`
- Username: Configurable via `POSTGRES_USER`
- Password: Configurable via `POSTGRES_PASSWORD`
- Port: Configurable via `POSTGRES_PORT` (default: 5432)

### Migration Execution
Database migrations are handled automatically through the application startup process:

1. The backend uses Alembic for migration management
2. Migration scripts are located in `backend/open_webui/migrations/versions/`
3. Migrations are applied automatically on application startup
4. The system tracks migration history in the database

The migration system includes 18+ migration scripts that handle schema changes, adding new features like user settings, tools, functions, and enhanced file management.

**Section sources**
- [docker-compose.yaml](file://docker-compose.yaml#L11-L28)
- [backend/open_webui/migrations/versions/](file://backend/open_webui/migrations/versions/)
- [backend/start.sh](file://backend/start.sh#L53-L67)

## Troubleshooting Guide

### Connection Issues
Common connection problems and solutions:

**Server Connection Error**:
- Use `--network=host` flag in Docker to resolve networking issues
- Ensure `OLLAMA_BASE_URL` points to the correct Ollama server
- Verify the Ollama server is running and accessible

**Example Docker Command**:
```bash
docker run -d --network=host -v open-webui:/app/backend/data -e OLLAMA_BASE_URL=http://127.0.0.1:11434 --name open-webui --restart always ghcr.io/open-webui/open-webui:main
```

### Slow Response Handling
The application has a default 5-minute timeout for Ollama responses, configurable via:

```bash
AIOHTTP_CLIENT_TIMEOUT=300  # Timeout in seconds
```

### General Troubleshooting Steps
1. **Verify Ollama URL**: Ensure `OLLAMA_BASE_URL` is correctly configured
2. **Check Ollama Version**: Ensure you're running the latest Ollama version
3. **Validate Network Connectivity**: Confirm the webui container can reach the Ollama server
4. **Review Logs**: Check container logs for error messages
5. **Test API Directly**: Verify Ollama API is functioning independently

**Section sources**
- [TROUBLESHOOTING.md](file://TROUBLESHOOTING.md#L1-L37)
- [Dockerfile](file://Dockerfile#L70-L71)

## Performance Optimization

### Production Deployment Tips
1. **Resource Allocation**: Adjust CPU and memory limits based on usage patterns
2. **Database Optimization**: Configure PostgreSQL with appropriate connection pooling
3. **Caching Strategy**: Implement reverse proxy caching for static assets
4. **Monitoring**: Set up health checks and monitoring for all components
5. **Backup Strategy**: Implement regular database backups

### GPU Performance
For GPU-enabled deployments:
1. Ensure proper NVIDIA drivers and container runtime are installed
2. Monitor GPU utilization and memory usage
3. Consider using mixed precision training when supported
4. Optimize batch sizes for your specific GPU model

### Scaling Considerations
1. **Horizontal Scaling**: Deploy multiple webui instances behind a load balancer
2. **Database Scaling**: Consider read replicas for high-read workloads
3. **Storage Optimization**: Use high-performance storage for the persistent volume
4. **Network Optimization**: Minimize latency between webui and Ollama services

**Section sources**
- [Dockerfile](file://Dockerfile#L119-L125)
- [kubernetes/manifest/base/webui-deployment.yaml](file://kubernetes/manifest/base/webui-deployment.yaml#L22-L27)
- [backend/start.sh](file://backend/start.sh#L73-L80)