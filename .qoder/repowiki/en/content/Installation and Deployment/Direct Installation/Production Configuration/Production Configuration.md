# Production Configuration

<cite>
**Referenced Files in This Document**   
- [README.md](file://README.md)
- [INSTALLATION.md](file://INSTALLATION.md)
- [TROUBLESHOOTING.md](file://TROUBLESHOOTING.md)
- [.env.example](file://.env.example)
- [backend/start.sh](file://backend/start.sh)
- [backend/open_webui/main.py](file://backend/open_webui/main.py)
- [backend/open_webui/config.py](file://backend/open_webui/config.py)
- [backend/open_webui/env.py](file://backend/open_webui/env.py)
- [backend/requirements.txt](file://backend/requirements.txt)
- [kubernetes/manifest/base/webui-deployment.yaml](file://kubernetes/manifest/base/webui-deployment.yaml)
- [kubernetes/manifest/base/webui-service.yaml](file://kubernetes/manifest/base/webui-service.yaml)
- [kubernetes/manifest/base/webui-ingress.yaml](file://kubernetes/manifest/base/webui-ingress.yaml)
- [docs/apache.md](file://docs/apache.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Reverse Proxy Configuration with Nginx](#reverse-proxy-configuration-with-nginx)
3. [Systemd Service Configuration](#systemd-service-configuration)
4. [Security Considerations](#security-considerations)
5. [Environment Variables and Configuration](#environment-variables-and-configuration)
6. [Application Health Monitoring and Logging](#application-health-monitoring-and-logging)
7. [Performance Optimization](#performance-optimization)
8. [Backup and Disaster Recovery](#backup-and-disaster-recovery)
9. [Conclusion](#conclusion)

## Introduction

This document provides comprehensive guidance for configuring open-webui in a production environment. The focus is on establishing a secure, reliable, and high-performance deployment. Key areas covered include setting up a reverse proxy with Nginx for SSL termination and static asset serving, creating systemd service files for robust process management, implementing critical security measures, configuring environment variables, setting up monitoring and logging, optimizing performance, and establishing backup procedures. The configuration is based on the open-webui application structure and its integration with Ollama, as detailed in the provided codebase and documentation.

**Section sources**
- [README.md](file://README.md)
- [INSTALLATION.md](file://INSTALLATION.md)

## Reverse Proxy Configuration with Nginx

Configuring a reverse proxy with Nginx is essential for a production deployment of open-webui. It provides SSL termination, serves static assets efficiently, and acts as a security layer between the internet and the application. The reverse proxy will forward requests to the open-webui backend, which by default runs on port 8080.

The Nginx configuration should include the following key components:

1.  **SSL Termination**: Nginx will handle the HTTPS connection, decrypting incoming traffic and forwarding it as HTTP to the backend. This offloads the encryption/decryption work from the application server.
2.  **Static Asset Serving**: Nginx is highly efficient at serving static files (like JavaScript, CSS, and images) directly from the filesystem, reducing the load on the Python application.
3.  **WebSocket Support**: The open-webui application uses WebSockets for real-time communication (e.g., streaming chat responses). The Nginx configuration must explicitly proxy WebSocket connections.
4.  **Proxy Headers**: Nginx must set appropriate headers (like `X-Forwarded-For`, `X-Forwarded-Proto`) so that the backend application can correctly identify the original client's IP address and protocol.

A sample Nginx configuration for open-webui is shown below. This configuration assumes the application is running on the same server as Nginx on port 8080.

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Proxy the main application
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Serve static assets directly from Nginx if possible
    # This path should point to the build directory of the frontend
    location /static/ {
        alias build/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

This configuration redirects HTTP traffic to HTTPS, sets up SSL with strong ciphers, adds important security headers, and proxies all requests to the open-webui backend. The `Upgrade` and `Connection` headers are crucial for enabling WebSocket support.

**Section sources**
- [TROUBLESHOOTING.md](file://TROUBLESHOOTING.md)
- [docs/apache.md](file://docs/apache.md)

## Systemd Service Configuration

For reliable process management and automatic restarts, open-webui should be run as a systemd service. This ensures the application starts on boot and is automatically restarted if it crashes.

The systemd service file defines how the application should be started, stopped, and monitored. It is typically placed in `/etc/systemd/system/open-webui.service`.

A sample systemd service file is provided below:

```ini
[Unit]
Description=Open WebUI
After=network.target

[Service]
Type=simple
User=openwebui
Group=openwebui
WorkingDirectory=backend
Environment="PATH=venv/bin"
Environment="WEBUI_SECRET_KEY=your-generated-secret-key"
Environment="OLLAMA_BASE_URL=http://localhost:11434"
Environment="DATABASE_URL=sqlite:///backend/data/webui.db"
ExecStart=venv/bin/uvicorn open_webui.main:app --host 127.0.0.1 --port 8080 --forwarded-allow-ips '*'
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Key points in this configuration:
-   **User/Group**: The service runs under a dedicated `openwebui` user for security.
-   **Environment**: Critical environment variables are set within the service file. The `WEBUI_SECRET_KEY` is essential for session security.
-   **ExecStart**: Uses `uvicorn` to start the FastAPI application. The `--forwarded-allow-ips '*'` flag is necessary when running behind a reverse proxy.
-   **Restart**: The `Restart=always` directive ensures the service is automatically restarted after a crash or system reboot. `RestartSec=10` adds a 10-second delay before restarting.

After creating the service file, run `sudo systemctl daemon-reload` to reload the systemd configuration, then `sudo systemctl enable open-webui` to enable it at boot, and `sudo systemctl start open-webui` to start the service.

**Section sources**
- [backend/start.sh](file://backend/start.sh)
- [.env.example](file://.env.example)

## Security Considerations

Securing an open-webui production deployment involves multiple layers, from network configuration to application settings.

### HTTPS and Let's Encrypt

Using HTTPS is non-negotiable for production. The most common way to obtain free SSL certificates is through Let's Encrypt using Certbot. After setting up the Nginx configuration, you can obtain and install a certificate with a command like:
```bash
sudo certbot --nginx -d your-domain.com
```
This command will automatically configure Nginx to use the obtained certificate and set up automatic renewal.

### Rate Limiting

To protect against brute-force attacks and denial-of-service, rate limiting should be implemented at the reverse proxy level. Nginx provides the `limit_req` module for this purpose. Add the following to the `http` block of your Nginx configuration:

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
```

Then, apply the rate limit to specific locations in your server block:

```nginx
location /api/v1/auths/login {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://127.0.0.1:8080;
    # ... other proxy settings
}
```

This configuration limits login attempts to 10 requests per second, with a burst capacity of 20.

### Access Logging

Nginx access logs are crucial for monitoring and troubleshooting. The default log format is usually sufficient, but you can customize it. Ensure logs are stored in a secure location and rotated regularly. The log path is typically defined in the main Nginx configuration (`/etc/nginx/nginx.conf`).

The application itself also generates logs. The `GLOBAL_LOG_LEVEL` and `SRC_LOG_LEVELS` environment variables in `env.py` control the verbosity of the application logs, which are essential for debugging issues.

**Section sources**
- [TROUBLESHOOTING.md](file://TROUBLESHOOTING.md)
- [backend/open_webui/env.py](file://backend/open_webui/env.py)

## Environment Variables and Configuration

open-webui relies heavily on environment variables for configuration. A comprehensive list of available options can be found in the `.env.example` file. For production, these variables should be securely managed.

### Setting Environment Variables

The recommended way to set environment variables for production is through the systemd service file (as shown above) or by using a dedicated `.env` file that is loaded by the application. The `env.py` file uses the `python-dotenv` library to load variables from a `.env` file located in the project root.

### Securing Sensitive Configuration

The most critical sensitive variable is `WEBUI_SECRET_KEY`. This key is used to sign session cookies and must be kept secret. Never commit this key to version control. It should be generated using a cryptographically secure random generator and stored securely (e.g., in a secrets manager or a file with restricted permissions).

Other sensitive variables include `DATABASE_URL` (if using a remote database with credentials), `OPENAI_API_KEY`, and any other API keys used by the application. These should also be managed securely and not hardcoded in configuration files.

**Section sources**
- [.env.example](file://.env.example)
- [backend/open_webui/env.py](file://backend/open_webui/env.py)

## Application Health Monitoring and Logging

Monitoring the health of the application and having comprehensive logs are vital for maintaining a stable production environment.

### Health Checks

The open-webui application provides a health check endpoint at `/health`. This endpoint can be used by monitoring tools (like Prometheus, Nagios, or a simple cron job) to verify that the application is responsive. A simple health check script could be:

```bash
#!/bin/bash
if curl -f http://127.0.0.1:8080/health; then
    echo "Application is healthy"
    exit 0
else
    echo "Application is unhealthy"
    exit 1
fi
```

### Logging Configuration

The application uses Python's `logging` module. The log level is controlled by the `GLOBAL_LOG_LEVEL` environment variable (e.g., `INFO`, `DEBUG`, `WARNING`). Individual components can have their log levels set with variables like `MAIN_LOG_LEVEL`, `DB_LOG_LEVEL`, etc.

Logs are output to stdout by default, which is captured by systemd's journal. You can view these logs with `sudo journalctl -u open-webui.service -f`. For more persistent logging, you can configure the application to write to a file by modifying the logging configuration in the code, though this is not the default behavior.

**Section sources**
- [backend/open_webui/main.py](file://backend/open_webui/main.py)
- [backend/open_webui/env.py](file://backend/open_webui/env.py)

## Performance Optimization

Optimizing performance involves tuning both the application and the infrastructure.

### Caching

The application uses Redis for caching, which can significantly improve performance for operations like user session storage and model list retrieval. To enable Redis, set the `REDIS_URL` environment variable in the systemd service file (e.g., `Environment="REDIS_URL=redis://127.0.0.1:6379"`). The `ENABLE_COMPRESSION_MIDDLEWARE` variable enables Gzip compression for responses, reducing bandwidth usage.

### Connection Pooling

For database connections, the application uses SQLAlchemy. The `DATABASE_POOL_SIZE`, `DATABASE_POOL_MAX_OVERFLOW`, and `DATABASE_POOL_RECYCLE` environment variables allow you to configure the connection pool, preventing the application from opening too many database connections.

### Resource Limits

The Kubernetes deployment configuration in `webui-deployment.yaml` shows resource requests and limits for CPU and memory. When running outside of Kubernetes, ensure the host system has sufficient resources. The `UVICORN_WORKERS` environment variable controls the number of Uvicorn worker processes. Setting this to the number of CPU cores can improve performance under load.

**Section sources**
- [kubernetes/manifest/base/webui-deployment.yaml](file://kubernetes/manifest/base/webui-deployment.yaml)
- [backend/open_webui/env.py](file://backend/open_webui/env.py)

## Backup and Disaster Recovery

A robust backup strategy is essential to prevent data loss.

### Data Backup

The primary data for open-webui is stored in the SQLite database (`webui.db`) and the data directory (which may contain uploaded files, models, and other persistent data). The `DATA_DIR` environment variable defines this location.

A simple backup script could use `rsync` or `tar` to create a compressed archive of the `DATA_DIR` and the database file. This script should be run regularly via a cron job and the backups should be stored offsite.

```bash
#!/bin/bash
BACKUP_DIR="/backups/open-webui"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/backup_$DATE.tar.gz -C backend/data .
```

### Disaster Recovery

The disaster recovery plan should include:
1.  **Documentation**: Clear, up-to-date documentation of the entire deployment process.
2.  **Backup Restoration**: A tested procedure for restoring the application from backups, including restoring the database and data directory.
3.  **Infrastructure as Code**: Using tools like Docker Compose or Kubernetes manifests (as provided in the `kubernetes/` directory) ensures that the infrastructure can be quickly rebuilt.

**Section sources**
- [kubernetes/manifest/base/webui-deployment.yaml](file://kubernetes/manifest/base/webui-deployment.yaml)
- [backend/open_webui/env.py](file://backend/open_webui/env.py)

## Conclusion

Configuring open-webui for production requires careful attention to security, reliability, and performance. By implementing a reverse proxy with Nginx for SSL termination, managing the application with systemd, securing sensitive data, and establishing monitoring and backup procedures, you can create a robust and secure deployment. The provided configuration files and environment variables offer a solid foundation that can be further customized to meet specific operational requirements.