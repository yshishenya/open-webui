# Prerequisites

<cite>
**Referenced Files in This Document**   
- [Dockerfile](file://Dockerfile)
- [package.json](file://package.json)
- [pyproject.toml](file://pyproject.toml)
- [backend/requirements.txt](file://backend/requirements.txt)
- [backend/start.sh](file://backend/start.sh)
- [Makefile](file://Makefile)
</cite>

## Table of Contents
1. [System Dependencies](#system-dependencies)
2. [Hardware Requirements](#hardware-requirements)
3. [Installation on Ubuntu/Debian](#installation-on-ubuntudebian)
4. [Installation on CentOS/RHEL](#installation-on-centosrhel)
5. [User Permissions Setup](#user-permissions-setup)
6. [Verification of Dependencies](#verification-of-dependencies)
7. [Common Installation Issues](#common-installation-issues)

## System Dependencies

Open WebUI requires several system dependencies to function properly. The application consists of a Python backend and a Node.js frontend, requiring both Python and Node.js environments to be properly configured.

The core system dependencies include:
- **Python 3.11**: Required for the backend application, with specific version constraints (>= 3.11, < 3.13.0a1)
- **Node.js 18+**: Required for building and running the frontend application, with compatibility up to Node.js 22
- **npm**: Node package manager for installing frontend dependencies
- **build-essential**: Development tools including gcc and make for compiling native extensions
- **ffmpeg**: Multimedia framework for audio and video processing
- **libgl1**: OpenGL library for graphics rendering
- **libsm6 and libxext6**: X11 Session Management and X11 protocol extension libraries

These dependencies are specified in the Dockerfile and package configuration files, ensuring the application can properly handle multimedia processing, graphics rendering, and compilation of native Python extensions.

**Section sources**
- [Dockerfile](file://Dockerfile#L120-L125)
- [package.json](file://package.json#L148-L149)
- [pyproject.toml](file://pyproject.toml#L119)

## Hardware Requirements

Open WebUI is designed to run AI models locally, requiring specific hardware specifications to ensure optimal performance. The minimum hardware requirements vary based on whether you're running models with or without GPU acceleration.

### RAM Requirements
- **Minimum**: 8GB RAM for basic operation with small language models
- **Recommended**: 16GB+ RAM for smooth operation with larger models
- **High-performance**: 32GB+ RAM for running multiple large models simultaneously

### Storage Requirements
- **Minimum**: 20GB free disk space
- **Recommended**: 50GB+ free disk space to accommodate model downloads and cached data
- **Model storage**: Additional space required based on downloaded models (typically 4-20GB per model)

### GPU Considerations
For GPU acceleration, Open WebUI supports CUDA-enabled NVIDIA GPUs:
- **CUDA support**: Requires NVIDIA GPU with CUDA capability (compute capability 5.0+)
- **CUDA version**: Compatible with CUDA 11.7+ and CUDA 12.x
- **VRAM**: Minimum 8GB VRAM recommended for running large models efficiently
- **Driver requirements**: Latest NVIDIA drivers with CUDA toolkit installed

The application can also run in CPU-only mode, though performance will be significantly slower for inference tasks. When using GPU acceleration, the application automatically configures the LD_LIBRARY_PATH to include necessary CUDA and cuDNN libraries.

**Section sources**
- [Dockerfile](file://Dockerfile#L4-L9)
- [backend/start.sh](file://backend/start.sh#L43-L46)

## Installation on Ubuntu/Debian

To install Open WebUI dependencies on Ubuntu or Debian systems, follow these steps:

```bash
# Update package index
sudo apt-get update

# Install system dependencies
sudo apt-get install -y \
    python3.11 \
    python3.11-venv \
    python3.11-dev \
    nodejs \
    npm \
    build-essential \
    ffmpeg \
    libgl1 \
    libsm6 \
    libxext6 \
    git \
    curl \
    jq \
    gcc \
    pandoc \
    netcat-openbsd

# Verify Python installation
python3.11 --version

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install Python dependencies
pip install -r backend/requirements.txt
```

For Node.js, ensure you have version 18 or higher. If your distribution provides an older version, use NodeSource to install a compatible version:

```bash
# Add NodeSource repository (for Node.js 18+)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Section sources**
- [Dockerfile](file://Dockerfile#L120-L125)
- [backend/requirements.txt](file://backend/requirements.txt)

## Installation on CentOS/RHEL

To install Open WebUI dependencies on CentOS or RHEL systems, use the following commands:

```bash
# Enable EPEL repository
sudo yum install -y epel-release

# Install system dependencies
sudo yum groupinstall -y "Development Tools"
sudo yum install -y \
    python3.11 \
    python3.11-devel \
    python3.11-libs \
    nodejs \
    npm \
    ffmpeg \
    mesa-libGL \
    libSM \
    libXext \
    git \
    curl \
    jq \
    gcc \
    pandoc \
    netcat

# For RHEL/CentOS 8+ using dnf
sudo dnf install -y \
    python3.11 \
    python3.11-devel \
    python3.11-libs \
    nodejs \
    npm \
    ffmpeg \
    mesa-libGL \
    libSM \
    libXext \
    git \
    curl \
    jq \
    gcc \
    pandoc \
    nc

# Create symbolic link for python3.11
sudo ln -sf /usr/bin/python3.11 /usr/bin/python3

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install Python dependencies
pip install -r backend/requirements.txt
```

For Node.js, ensure you have version 18 or higher. If your distribution provides an older version, use NodeSource to install a compatible version:

```bash
# Add NodeSource repository (for Node.js 18+)
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

**Section sources**
- [Dockerfile](file://Dockerfile#L120-L125)
- [backend/requirements.txt](file://backend/requirements.txt)

## User Permissions Setup

For security reasons, it's recommended to run Open WebUI with a non-root user. The application supports custom UID and GID configuration through build arguments:

```bash
# Create dedicated user for Open WebUI
sudo useradd -m -s /bin/bash openwebui

# Add user to necessary groups
sudo usermod -aG audio,video openwebui

# Set appropriate permissions on application directory
sudo chown -R openwebui:openwebui 
sudo chmod -R 755 

# Switch to the openwebui user
sudo su - openwebui
```

When running in Docker, you can specify the user ID and group ID using build arguments:

```bash
docker build --build-arg UID=$(id -u) --build-arg GID=$(id -g) -t open-webui .
```

The application automatically handles permission configuration, ensuring the specified user has access to necessary directories and files. The start script also creates necessary cache directories with appropriate ownership.

**Section sources**
- [Dockerfile](file://Dockerfile#L106-L111)
- [backend/start.sh](file://backend/start.sh#L23-L36)

## Verification of Dependencies

After installing the dependencies, verify each component is properly installed and configured:

### Python Verification
```bash
# Check Python version
python3.11 --version
# Expected output: Python 3.11.x

# Verify venv module
python3.11 -m venv --help

# Check pip installation
pip --version

# Verify key Python packages
python3.11 -c "import torch; print(f'Torch version: {torch.__version__}')"
python3.11 -c "import tensorflow; print(f'TensorFlow version: {tensorflow.__version__}')"
python3.11 -c "from sentence_transformers import SentenceTransformer; print('Sentence Transformers available')"
```

### Node.js and npm Verification
```bash
# Check Node.js version
node --version
# Expected output: v18.x.x, v19.x.x, v20.x.x, v21.x.x, or v22.x.x

# Check npm version
npm --version

# Verify Node.js can access required modules
node -e "console.log('Node.js is working')"
```

### System Libraries Verification
```bash
# Check ffmpeg installation
ffmpeg -version

# Verify OpenGL library
ldconfig -p | grep libGL

# Check X11 libraries
ldconfig -p | grep libSM
ldconfig -p | grep libXext

# Verify build tools
gcc --version
make --version
```

### Application-Specific Verification
```bash
# Verify Python dependencies
pip list | grep -E "(fastapi|uvicorn|pydantic|transformers|sentence-transformers)"

# Check if required Python modules can be imported
python3.11 -c "import fastapi; import uvicorn; import pydantic; print('Backend dependencies OK')"

# Verify frontend build tools
npm ls | grep -E "(vite|svelte)"
```

**Section sources**
- [Dockerfile](file://Dockerfile#L130-L148)
- [backend/requirements.txt](file://backend/requirements.txt)

## Common Installation Issues

### Outdated Package Index
When installing on Ubuntu/Debian systems, ensure the package index is up to date:

```bash
sudo apt-get update
sudo apt-get upgrade
```

For CentOS/RHEL systems:
```bash
sudo yum update
# or for dnf-based systems
sudo dnf update
```

### Missing Development Headers
Some Python packages require development headers. If you encounter compilation errors, install the necessary development packages:

```bash
# Ubuntu/Debian
sudo apt-get install -y python3.11-dev python3.11-venv

# CentOS/RHEL
sudo yum install -y python3.11-devel
```

### Architecture-Specific Dependencies
On ARM-based systems (like Raspberry Pi), some packages may require specific versions:

```bash
# For ARM64 systems, pyarrow version may need to be pinned
pip install pyarrow==20.0.0
```

### CUDA and GPU Issues
When using GPU acceleration, ensure CUDA libraries are properly configured:

```bash
# Verify CUDA installation
nvidia-smi

# Check CUDA version
nvcc --version

# If CUDA libraries are not found, update LD_LIBRARY_PATH
export LD_LIBRARY_PATH="$LD_LIBRARY_PATH:/usr/local/cuda/lib64:/usr/local/cuda/extras/CUPTI/lib64"
```

### Permission Issues
If encountering permission errors when running the application:

```bash
# Ensure the user has write permissions to the data directory
chmod -R u+rw backend/data

# Or run with appropriate user
sudo chown -R $USER:$USER 
```

### Node.js Memory Issues
During frontend build, you may encounter JavaScript heap out of memory errors:

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Or add to your shell profile
echo 'export NODE_OPTIONS="--max-old-space-size=4096"' >> ~/.bashrc
```

**Section sources**
- [Dockerfile](file://Dockerfile#L120-L125)
- [backend/start.sh](file://backend/start.sh#L43-L46)
- [hatch_build.py](file://hatch_build.py#L13-L23)