# Direct Installation

<cite>
**Referenced Files in This Document**   
- [run.sh](file://run.sh)
- [setup.sh](file://setup.sh)
- [backend/start.sh](file://backend/start.sh)
- [backend/requirements.txt](file://backend/requirements.txt)
- [backend/requirements-min.txt](file://backend/requirements-min.txt)
- [package.json](file://package.json)
- [.env.example](file://.env.example)
- [backend/open_webui/config.py](file://backend/open_webui/config.py)
- [backend/open_webui/main.py](file://backend/open_webui/main.py)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [System Dependencies](#system-dependencies)
4. [Python Environment Setup](#python-environment-setup)
5. [Frontend Build Process](#frontend-build-process)
6. [Database Configuration](#database-configuration)
7. [Environment Configuration](#environment-configuration)
8. [Running the Application](#running-the-application)
9. [Production Configuration](#production-configuration)
10. [Common Issues and Troubleshooting](#common-issues-and-troubleshooting)
11. [Maintenance and Updates](#maintenance-and-updates)

## Introduction

This guide provides comprehensive instructions for installing open-webui directly on a Linux system without containerization. The installation process covers all necessary components including system dependencies, Python environment setup, frontend compilation, database configuration, and production deployment. The guide is designed to help users set up a fully functional open-webui instance with proper configuration for both development and production environments.

**Section sources**
- [README.md](file://README.md#L1-L27)
- [INSTALLATION.md](file://INSTALLATION.md#L1-L36)

## Prerequisites

Before beginning the installation process, ensure your system meets the following requirements:

- **Operating System**: Linux (Ubuntu/Debian, CentOS/RHEL, or compatible distributions)
- **Python**: Version 3.11 (required for backend functionality)
- **Node.js**: Version 18.13.0 to 22.x.x (required for frontend build)
- **npm**: Version 6.0.0 or higher
- **Sufficient disk space**: At least 2GB of free space for the application and dependencies
- **Memory**: Minimum 4GB RAM recommended
- **Permissions**: Administrative privileges for installing system packages

The open-webui application consists of a Python-based backend using FastAPI and a Svelte-based frontend. The backend requires Python 3.11 specifically, as indicated by the package.json file which specifies compatibility with Node.js versions 18.13.0 through 22.x.x.

**Section sources**
- [package.json](file://package.json#L147-L150)
- [backend/requirements.txt](file://backend/requirements.txt#L1-L153)

## System Dependencies

Install the necessary system-level dependencies before proceeding with the application installation. These dependencies are required for various components of the application to function properly.

### Essential Build Tools

```bash
# For Debian/Ubuntu systems
sudo apt update
sudo apt install -y build-essential python3-dev python3-pip python3-venv \
    git curl wget ffmpeg libgl1-mesa-glx libglib2.0-0

# For CentOS/RHEL systems
sudo yum groupinstall -y "Development Tools"
sudo yum install -y python3-devel python3-pip python3-venv git curl wget \
    ffmpeg mesa-libGL
```

### Additional Multimedia Dependencies

The application requires ffmpeg for audio processing and other multimedia operations:

```bash
# Install ffmpeg
sudo apt install -y ffmpeg  # Debian/Ubuntu
sudo yum install -y ffmpeg  # CentOS/RHEL
```

### Graphics and Image Processing Libraries

For proper image processing capabilities, install the following libraries:

```bash
sudo apt install -y libsm6 libxext6 libxrender-dev libglib2.0-0 \
    libgl1-mesa-glx libglib2.0-bin
```

These system dependencies support various features in the application, including image processing, video handling, and proper rendering of graphical elements.

**Section sources**
- [backend/requirements.txt](file://backend/requirements.txt#L80-L85)
- [backend/requirements.txt](file://backend/requirements.txt#L82-L83)

## Python Environment Setup

Create an isolated Python environment to prevent dependency conflicts and ensure a clean installation.

### Create Virtual Environment

```bash
# Navigate to the project directory
cd 

# Create a virtual environment
python3.11 -m venv venv

# Activate the virtual environment
source venv/bin/activate
```

### Install Backend Dependencies

With the virtual environment activated, install the required Python packages:

```bash
# Install dependencies from requirements.txt
pip install --upgrade pip
pip install -r backend/requirements.txt
```

The requirements.txt file contains all necessary Python packages for the backend, including:
- FastAPI (0.123.0) for the web framework
- Uvicorn (0.37.0) as the ASGI server
- SQLAlchemy (2.0.38) for database operations
- Various AI and machine learning libraries
- Database connectors for PostgreSQL and other databases

For a minimal installation, you can use requirements-min.txt instead, which contains only the essential packages needed to run the backend.

**Section sources**
- [backend/requirements.txt](file://backend/requirements.txt#L1-L153)
- [backend/requirements-min.txt](file://backend/requirements-min.txt#L1-L52)

## Frontend Build Process

The frontend of open-webui is built using Svelte and requires Node.js for compilation.

### Install Node.js Dependencies

```bash
# Install npm packages
npm install

# If you encounter permission issues, you may need to fix npm permissions
# or use a Node version manager like nvm
```

### Build the Frontend

```bash
# Build the frontend assets
npm run build

# For development builds with hot reloading
npm run dev
```

The build process uses Vite as the build tool, which is specified in the package.json file. The frontend assets are compiled and placed in the appropriate directory for serving by the backend.

### Frontend Configuration

The frontend build process is configured in several files:
- vite.config.ts: Vite configuration
- svelte.config.js: Svelte-specific settings
- tailwind.config.js: Styling configuration

The build process also handles the preparation of Pyodide, a Python implementation for WebAssembly, which is used for certain frontend functionalities.

**Section sources**
- [package.json](file://package.json#L1-L152)
- [vite.config.ts](file://vite.config.ts)
- [svelte.config.js](file://svelte.config.js)

## Database Configuration

open-webui uses a database to store application data, user information, and configuration settings.

### Database Setup

By default, the application can use SQLite for simple deployments, but PostgreSQL is recommended for production use.

#### PostgreSQL Installation

```bash
# For Debian/Ubuntu
sudo apt install -y postgresql postgresql-contrib

# For CentOS/RHEL
sudo yum install -y postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Database Configuration

Create a database and user for open-webui:

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE openwebui;
CREATE USER openwebui_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE openwebui TO openwebui_user;
\q
```

Update the application configuration to use the PostgreSQL database by setting the appropriate environment variables in your configuration.

**Section sources**
- [backend/open_webui/config.py](file://backend/open_webui/config.py#L19-L34)
- [backend/requirements.txt](file://backend/requirements.txt#L111-L113)

## Environment Configuration

Proper environment configuration is essential for the application to function correctly.

### Create Environment File

Copy the example environment file and modify it as needed:

```bash
cp .env.example .env

# Edit the .env file with your preferred editor
nano .env
```

### Key Configuration Options

The following environment variables should be configured:

```
# Ollama URL for the backend to connect
OLLAMA_BASE_URL='http://localhost:11434'

# CORS configuration
CORS_ALLOW_ORIGIN='*'

# Security settings
FORWARDED_ALLOW_IPS='*'

# Analytics
SCARF_NO_ANALYTICS=true
DO_NOT_TRACK=true
ANONYMIZED_TELEMETRY=false
```

Additional configuration options can be found in the .env.example file and the config.py file, which contains extensive configuration settings for various aspects of the application.

**Section sources**
- [.env.example](file://.env.example#L1-L22)
- [backend/open_webui/config.py](file://backend/open_webui/config.py#L113-L800)

## Running the Application

Once all components are installed and configured, you can start the application.

### Start the Application

```bash
# Activate the virtual environment
source venv/bin/activate

# Start the backend server
cd backend
./start.sh
```

The start.sh script handles various initialization tasks including:
- Installing Playwright browsers if needed
- Generating secret keys
- Starting the Ollama service if configured
- Launching the Uvicorn server

### Using the Run Script

Alternatively, you can use the main run.sh script, which is designed for containerized environments but can be adapted for direct installation:

```bash
# Make the script executable
chmod +x run.sh

# Run the application
./run.sh
```

Note that the provided run.sh script is configured for Docker execution, so for direct installation, it's recommended to use the backend/start.sh script directly.

### Accessing the Application

By default, the application runs on port 8080. Access it through a web browser:

```
http://localhost:8080
```

**Section sources**
- [run.sh](file://run.sh#L1-L20)
- [backend/start.sh](file://backend/start.sh#L1-L87)
- [backend/dev.sh](file://backend/dev.sh#L1-L4)

## Production Configuration

For production deployments, additional configuration is required to ensure security, performance, and reliability.

### Reverse Proxy with Nginx

Set up Nginx as a reverse proxy to handle SSL termination and serve static assets efficiently.

#### Nginx Configuration

Create a configuration file in /etc/nginx/sites-available/open-webui:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable the site and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/open-webui /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### SSL Configuration

Use Let's Encrypt to obtain a free SSL certificate:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Process Management with systemd

Create a systemd service file to manage the application process:

```ini
# /etc/systemd/system/open-webui.service
[Unit]
Description=Open WebUI
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=
Environment=PATH=venv/bin:/usr/bin
ExecStart=venv/bin/python -m uvicorn open_webui.main:app --host 0.0.0.0 --port 8080
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reexec
sudo systemctl enable open-webui
sudo systemctl start open-webui
```

**Section sources**
- [backend/start.sh](file://backend/start.sh#L72-L87)
- [backend/open_webui/main.py](file://backend/open_webui/main.py#L656-L662)

## Common Issues and Troubleshooting

This section addresses common problems encountered during installation and operation.

### Dependency Conflicts

If you encounter Python package conflicts:

```bash
# Clear pip cache
pip cache purge

# Reinstall in a fresh virtual environment
deactivate
rm -rf venv
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
```

### Permission Errors

For permission-related issues:

```bash
# Ensure proper ownership of the project directory
sudo chown -R $USER:$USER 

# If using systemd, ensure the service user has proper permissions
sudo usermod -a -G your-group your-user
```

### Environment Configuration Issues

If the application fails to start due to configuration issues:

1. Verify that all required environment variables are set
2. Check that the .env file is in the correct location
3. Ensure that database connections are properly configured
4. Validate that port 8080 is not already in use

### Database Migration Problems

If you encounter database migration issues:

```bash
# Run migrations manually
cd backend
alembic upgrade head
```

The application automatically runs migrations on startup, but manual execution may be necessary in some cases.

**Section sources**
- [backend/start.sh](file://backend/start.sh#L53-L67)
- [backend/open_webui/config.py](file://backend/open_webui/config.py#L52-L68)

## Maintenance and Updates

Regular maintenance is essential for security and performance.

### Applying Updates

To update the application to the latest version:

```bash
# Navigate to the project directory
cd 

# Pull the latest changes
git pull origin main

# Update Python dependencies
source venv/bin/activate
pip install --upgrade -r backend/requirements.txt

# Update Node.js dependencies
npm install

# Rebuild the frontend
npm run build

# Restart the service
sudo systemctl restart open-webui
```

### Backup Strategy

Implement a regular backup strategy for your data:

```bash
# Backup the data directory
tar -czf open-webui-backup-$(date +%Y%m%d).tar.gz backend/data

# Backup the database
pg_dump openwebui > openwebui-db-backup-$(date +%Y%m%d).sql
```

### Monitoring

Monitor the application logs to identify and resolve issues:

```bash
# View systemd service logs
sudo journalctl -u open-webui -f

# Check disk space usage
df -h 

# Monitor memory usage
htop
```

Regular updates and monitoring will help maintain a stable and secure open-webui installation.

**Section sources**
- [backend/open_webui/main.py](file://backend/open_webui/main.py#L574-L575)
- [backend/open_webui/config.py](file://backend/open_webui/config.py#L107-L111)