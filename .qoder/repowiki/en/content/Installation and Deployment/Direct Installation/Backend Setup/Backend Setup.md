# Backend Setup

<cite>
**Referenced Files in This Document**   
- [requirements.txt](file://backend/requirements.txt)
- [start.sh](file://backend/start.sh)
- [dev.sh](file://backend/dev.sh)
- [.env.example](file://.env.example)
- [config.py](file://backend/open_webui/config.py)
- [env.py](file://backend/open_webui/env.py)
- [db.py](file://backend/open_webui/internal/db.py)
- [main.py](file://backend/open_webui/main.py)
- [alembic.ini](file://backend/open_webui/alembic.ini)
- [env.py](file://backend/open_webui/migrations/env.py)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Python Virtual Environment and Dependencies](#python-virtual-environment-and-dependencies)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Database Migrations](#database-migrations)
6. [Starting the FastAPI Backend](#starting-the-fastapi-backend)
7. [Common Issues and Troubleshooting](#common-issues-and-troubleshooting)
8. [Conclusion](#conclusion)

## Introduction
This document provides comprehensive instructions for setting up the backend for open-webui, a web-based user interface for AI models. The setup process covers creating a Python virtual environment, installing dependencies, configuring environment variables, setting up PostgreSQL, running database migrations with Alembic, and starting the FastAPI backend with Uvicorn. The document also addresses common issues that may arise during the setup process and provides troubleshooting steps to resolve them.

**Section sources**
- [requirements.txt](file://backend/requirements.txt)
- [start.sh](file://backend/start.sh)
- [dev.sh](file://backend/dev.sh)

## Python Virtual Environment and Dependencies

### Creating a Python Virtual Environment
To isolate the project's dependencies and avoid conflicts with other Python projects, it is recommended to create a Python virtual environment. This can be done using the `venv` module, which is included in Python 3.3 and later.

```bash
python -m venv venv
```

This command creates a virtual environment named `venv` in the current directory. To activate the virtual environment, use the appropriate command for your operating system:

- On Linux and macOS:
```bash
source venv/bin/activate
```

- On Windows:
```bash
venv\Scripts\activate
```

Once the virtual environment is activated, you will see its name in parentheses at the beginning of your command prompt, indicating that you are working within the virtual environment.

### Installing Dependencies from requirements.txt
The open-webui project includes a `requirements.txt` file that lists all the Python packages required for the backend to function properly. After activating the virtual environment, install the dependencies using pip:

```bash
pip install -r backend/requirements.txt
```

This command reads the `requirements.txt` file and installs all the specified packages. The `requirements.txt` file includes essential packages such as FastAPI for building the API, Uvicorn as the ASGI server, SQLAlchemy for database interactions, Alembic for database migrations, and various AI-related libraries.

**Section sources**
- [requirements.txt](file://backend/requirements.txt)
- [start.sh](file://backend/start.sh)

## Environment Configuration

### Understanding Environment Variables
The open-webui backend uses environment variables to configure various aspects of the application, including database connections, authentication settings, and feature toggles. These variables can be set directly in the environment or loaded from a `.env` file.

### Using .env Files for Configuration
The project provides an `.env.example` file that serves as a template for creating a `.env` file. This file contains commented-out examples of all the environment variables that can be configured. To use it, copy the file to `.env` and modify the values as needed:

```bash
cp .env.example .env
```

Edit the `.env` file to set the desired values for your environment. Key variables include:

- `DATABASE_URL`: The connection string for the database
- `WEBUI_SECRET_KEY`: Secret key for JWT authentication
- `OLLAMA_BASE_URL`: URL for the Ollama service
- `CORS_ALLOW_ORIGIN`: Origins allowed for CORS requests

### Relationship Between .env Files and config.py
The `config.py` file in the `open_webui` package is responsible for loading configuration values from environment variables and providing them to the rest of the application. It uses the `env.py` module to read environment variables and set default values when necessary.

The `env.py` file contains logic to load environment variables from a `.env` file using the `python-dotenv` package. If the package is not installed, it will skip loading the `.env` file and rely on environment variables set in the system.

The `config.py` file defines `PersistentConfig` objects for each configuration value, which are used throughout the application. These objects check for environment variables first, then fall back to values stored in the database, and finally use default values if neither is available.

```mermaid
flowchart TD
A[.env File] --> B[Environment Variables]
C[System Environment] --> B
B --> D[config.py]
D --> E[PersistentConfig Objects]
E --> F[Application Components]
```

**Diagram sources**
- [.env.example](file://.env.example)
- [config.py](file://backend/open_webui/config.py)
- [env.py](file://backend/open_webui/env.py)

**Section sources**
- [.env.example](file://.env.example)
- [config.py](file://backend/open_webui/config.py)
- [env.py](file://backend/open_webui/env.py)

## Database Setup

### PostgreSQL Database Configuration
The open-webui backend supports multiple database backends, with SQLite as the default and PostgreSQL as an option for production environments. To use PostgreSQL, you need to set the appropriate environment variables:

- `DATABASE_TYPE`: Set to "postgresql"
- `DATABASE_USER`: Database username
- `DATABASE_PASSWORD`: Database password
- `DATABASE_HOST`: Database host (e.g., "localhost")
- `DATABASE_PORT`: Database port (e.g., "5432")
- `DATABASE_NAME`: Name of the database

Alternatively, you can set the `DATABASE_URL` directly with a connection string in the format:
```
postgresql://user:password@host:port/database
```

### User Creation and Database Initialization
To set up PostgreSQL for open-webui, follow these steps:

1. Install PostgreSQL on your system if it is not already installed.
2. Start the PostgreSQL service.
3. Create a new database user:
```bash
sudo -u postgres createuser --interactive
```
Follow the prompts to create a user with the desired name and permissions.

4. Create a new database:
```bash
sudo -u postgres createdb -O username database_name
```
Replace `username` with the user created in the previous step and `database_name` with your desired database name.

5. Configure the database connection in the `.env` file or environment variables as described in the previous section.

### Connection Configuration
The database connection is configured in the `env.py` file, which constructs the `DATABASE_URL` based on the provided environment variables. The `db.py` file in the `internal` directory handles the actual database connection using SQLAlchemy.

The connection configuration includes settings for connection pooling, which can be tuned for performance:
- `DATABASE_POOL_SIZE`: Number of connections to maintain in the pool
- `DATABASE_POOL_MAX_OVERFLOW`: Maximum number of connections to create beyond the pool size
- `DATABASE_POOL_TIMEOUT`: Timeout for acquiring a connection from the pool
- `DATABASE_POOL_RECYCLE`: Time after which connections are recycled

For SQLite databases, the configuration also includes an option to enable WAL (Write-Ahead Logging) mode, which improves concurrency:
```python
DATABASE_ENABLE_SQLITE_WAL = os.environ.get("DATABASE_ENABLE_SQLITE_WAL", "False").lower() == "true"
```

```mermaid
erDiagram
USER {
string id PK
string name
string email
string role
datetime timestamp
}
AUTH {
string id PK
string email
string password
boolean active
}
CHAT {
string id PK
string user_id FK
string title
text chat
datetime timestamp
}
USER ||--o{ CHAT : "has"
USER ||--|| AUTH : "credentials"
```

**Diagram sources**
- [env.py](file://backend/open_webui/env.py)
- [db.py](file://backend/open_webui/internal/db.py)

**Section sources**
- [env.py](file://backend/open_webui/env.py)
- [db.py](file://backend/open_webui/internal/db.py)

## Database Migrations

### Understanding Alembic Migrations
The open-webui backend uses Alembic for database migrations, which allows for version control of the database schema. Alembic provides a way to make changes to the database schema over time in a consistent and repeatable manner.

The migration configuration is stored in the `alembic.ini` file, which specifies the location of the migration scripts and other settings. The actual migration scripts are stored in the `migrations/versions` directory.

### Running Migrations with Alembic
Migrations are automatically run when the application starts, thanks to the `run_migrations()` function in `config.py`. This function is called at the beginning of the file, ensuring that the database schema is up to date before the application starts handling requests.

The migration process is also handled in the `db.py` file, which first runs any pending Peewee migrations before initializing the SQLAlchemy database connection. This two-step migration process ensures compatibility with both the old Peewee-based schema and the current SQLAlchemy-based schema.

To manually run migrations (for example, during development), you can use the Alembic command-line tool:

```bash
alembic upgrade head
```

This command applies all pending migrations to bring the database schema to the latest version.

### Migration Files Structure
The migration files are organized in the `migrations/versions` directory, with each file representing a specific migration. The files are named with a revision ID and a description, such as `018012973d35_add_indexes.py`.

Each migration file contains `upgrade()` and `downgrade()` functions that define how to apply and reverse the migration. The `upgrade()` function contains the operations to apply the migration, while the `downgrade()` function contains the operations to reverse it.

The initial migration (`001_initial_schema.py`) in the `internal/migrations` directory sets up the basic schema for the application, creating tables for users, chats, prompts, and other entities.

```mermaid
flowchart TD
A[Application Start] --> B[Run Peewee Migrations]
B --> C[Initialize SQLAlchemy]
C --> D[Run Alembic Migrations]
D --> E[Start Application]
```

**Diagram sources**
- [config.py](file://backend/open_webui/config.py)
- [db.py](file://backend/open_webui/internal/db.py)
- [alembic.ini](file://backend/open_webui/alembic.ini)
- [env.py](file://backend/open_webui/migrations/env.py)

**Section sources**
- [config.py](file://backend/open_webui/config.py)
- [db.py](file://backend/open_webui/internal/db.py)
- [alembic.ini](file://backend/open_webui/alembic.ini)
- [env.py](file://backend/open_webui/migrations/env.py)

## Starting the FastAPI Backend

### Using Uvicorn to Start the Server
The open-webui backend is built using FastAPI and is served using Uvicorn, an ASGI server. There are several ways to start the server, depending on your environment and requirements.

For development, you can use the `dev.sh` script, which starts the server with auto-reload enabled:
```bash
./backend/dev.sh
```

This script sets the CORS allow origin to include common development origins and starts Uvicorn with the reload option, which automatically restarts the server when code changes are detected.

For production or general use, use the `start.sh` script:
```bash
./backend/start.sh
```

This script handles various setup tasks before starting the server, including:
- Installing Playwright browsers if needed
- Generating a secret key if one is not provided
- Starting the Ollama service if configured
- Configuring CUDA libraries if enabled
- Creating an admin user for HuggingFace Space deployment
- Starting the Uvicorn server with the configured number of workers

### Verifying the Service is Running
After starting the server, you can verify that it is running by accessing the API documentation or health check endpoint:

- API Documentation: `http://localhost:8080/docs` (available in development mode)
- Health Check: `http://localhost:8080/health`

You should receive a 200 OK response from the health check endpoint, indicating that the server is running and healthy.

The server logs will also provide information about the startup process, including any migrations that were run and the final status of the server.

```mermaid
sequenceDiagram
participant User
participant start_sh as start.sh
participant Uvicorn
participant App as FastAPI App
User->>start_sh : Execute script
start_sh->>start_sh : Handle Playwright installation
start_sh->>start_sh : Generate secret key if needed
start_sh->>start_sh : Start Ollama if configured
start_sh->>Uvicorn : Start server
Uvicorn->>App : Initialize application
App->>App : Run migrations
App->>App : Load configuration
App->>Uvicorn : Ready to serve requests
Uvicorn->>User : Server running on port 8080
```

**Diagram sources**
- [start.sh](file://backend/start.sh)
- [dev.sh](file://backend/dev.sh)
- [main.py](file://backend/open_webui/main.py)

**Section sources**
- [start.sh](file://backend/start.sh)
- [dev.sh](file://backend/dev.sh)
- [main.py](file://backend/open_webui/main.py)

## Common Issues and Troubleshooting

### Virtual Environment Activation Problems
One common issue is failing to activate the virtual environment before running the application. This can lead to missing package errors or version conflicts.

**Symptoms:**
- "ModuleNotFoundError" for packages listed in requirements.txt
- "Command not found" for pip or python

**Solutions:**
1. Ensure you are in the correct directory before activating the virtual environment
2. Use the correct activation command for your operating system and shell
3. Verify the virtual environment is active by checking for its name in the command prompt
4. If using an IDE, ensure it is configured to use the virtual environment's Python interpreter

### Dependency Conflicts
Dependency conflicts can occur when packages have incompatible version requirements.

**Symptoms:**
- "ResolutionImpossible" error during pip install
- Import errors for specific modules
- Unexpected behavior in the application

**Solutions:**
1. Create a fresh virtual environment and reinstall dependencies
2. Use `pip install --force-reinstall` to override conflicting installations
3. Check for platform-specific packages that may not be available
4. Consider using a requirements lock file (requirements.txt with pinned versions)

### Database Connection Errors
Database connection errors are common when configuring PostgreSQL.

**Symptoms:**
- "Connection refused" or "could not connect to server"
- Authentication failures
- Database not found errors

**Solutions:**
1. Verify that the PostgreSQL service is running
2. Check that the database user and password are correct
3. Ensure the database exists and the user has appropriate permissions
4. Verify the host and port are correct
5. Check firewall settings that may block the connection

### Migration Failures
Migration failures can occur when the database schema is out of sync.

**Symptoms:**
- "alembic.util.CommandError" or similar migration errors
- Table not found errors
- Column not found errors

**Solutions:**
1. Check the migration history with `alembic history`
2. Verify the current database revision with `alembic current`
3. Manually apply pending migrations with `alembic upgrade head`
4. If necessary, reset the database and start fresh (only in development)

### ImportError and psycopg2 Compilation Issues
Import errors for psycopg2, the PostgreSQL adapter for Python, are common due to compilation requirements.

**Symptoms:**
- "ImportError: No module named 'psycopg2'"
- Compilation errors during pip install
- Missing header files or libraries

**Solutions:**
1. Install system dependencies before installing Python packages:
   - On Ubuntu/Debian: `sudo apt-get install libpq-dev python3-dev`
   - On CentOS/RHEL: `sudo yum install postgresql-devel python3-devel`
   - On macOS: `brew install postgresql`

2. Use the binary package instead of compiling from source:
   ```bash
   pip install psycopg2-binary
   ```

3. If using a virtual environment, ensure it has access to system libraries

4. Consider using a Docker container with pre-installed dependencies

**Section sources**
- [requirements.txt](file://backend/requirements.txt)
- [start.sh](file://backend/start.sh)
- [env.py](file://backend/open_webui/env.py)
- [db.py](file://backend/open_webui/internal/db.py)

## Conclusion
Setting up the open-webui backend involves several key steps: creating a Python virtual environment, installing dependencies, configuring environment variables, setting up the database, running migrations, and starting the server. By following the steps outlined in this document, you should be able to successfully set up the backend for development or production use.

The architecture of the application is designed to be flexible, supporting both SQLite for simple setups and PostgreSQL for more robust deployments. The use of environment variables and configuration files makes it easy to adapt the application to different environments.

When encountering issues, refer to the troubleshooting section for common problems and their solutions. The combination of detailed logging, structured configuration, and automated migration handling makes the open-webui backend relatively straightforward to set up and maintain.