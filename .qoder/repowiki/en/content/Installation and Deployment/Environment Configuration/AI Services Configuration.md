# AI Services Configuration

<cite>
**Referenced Files in This Document**   
- [.env.example](file://.env.example)
- [backend/open_webui/config.py](file://backend/open_webui/config.py)
- [backend/open_webui/env.py](file://backend/open_webui/env.py)
- [backend/open_webui/routers/ollama.py](file://backend/open_webui/routers/ollama.py)
- [backend/open_webui/routers/openai.py](file://backend/open_webui/routers/openai.py)
- [backend/open_webui/main.py](file://backend/open_webui/main.py)
- [docker-compose.gpu.yaml](file://docker-compose.gpu.yaml)
- [TROUBLESHOOTING.md](file://TROUBLESHOOTING.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Environment Variables for AI Providers](#environment-variables-for-ai-providers)
3. [Configuration of Multiple AI Providers and Model Routing](#configuration-of-multiple-ai-providers-and-model-routing)
4. [API Timeouts, Retry Policies, and Rate Limiting](#api-timeouts-retry-policies-and-rate-limiting)
5. [GPU-Accelerated Inference Setup](#gpu-accelerated-inference-setup)
6. [Model Auto-Pulling and Caching](#model-auto-pulling-and-caching)
7. [Configuration Examples](#configuration-examples)
8. [Troubleshooting Common AI Service Issues](#troubleshooting-common-ai-service-issues)
9. [Conclusion](#conclusion)

## Introduction
This document provides comprehensive guidance on configuring AI services for Open WebUI, a web-based user interface for interacting with AI models. The focus is on setting up and managing integrations with various AI providers, including Ollama and OpenAI. The configuration covers environment variables, multi-provider setups, model routing, performance tuning through timeouts and retries, GPU acceleration, and model management. The document also includes troubleshooting guidance for common issues encountered when connecting to AI endpoints.

**Section sources**
- [backend/open_webui/main.py](file://backend/open_webui/main.py#L656-L800)
- [TROUBLESHOOTING.md](file://TROUBLESHOOTING.md#L1-L37)

## Environment Variables for AI Providers
Open WebUI uses environment variables to configure connections to AI service providers. These variables are defined in the `.env` file or passed directly to the container. The primary variables for Ollama and OpenAI are `OLLAMA_BASE_URL`, `OLLAMA_API_KEY`, `OPENAI_API_BASE_URL`, and `OPENAI_API_KEY`.

The `OLLAMA_BASE_URL` specifies the endpoint for the Ollama service. By default, it is set to `http://localhost:11434`, which is the standard address when Ollama is running on the same host. This URL is used by the Open WebUI backend to proxy requests to the Ollama API, ensuring secure communication and handling CORS policies.

For OpenAI integration, the `OPENAI_API_BASE_URL` defines the base URL for the OpenAI API. This can be used to point to the official OpenAI service or to a compatible API endpoint, such as an Azure OpenAI service. The `OPENAI_API_KEY` is the authentication token required to access the OpenAI API. Similarly, `OLLAMA_API_KEY` can be used for authenticated access to an Ollama server, although it is not required for local instances.

Other environment variables control additional features, such as `ENABLE_OPENAI_API`, which enables or disables the OpenAI API integration, and `ENABLE_OLLAMA_API`, which does the same for Ollama. These can be set to `true` or `false` to toggle the respective services.

**Section sources**
- [.env.example](file://.env.example#L1-L22)
- [backend/open_webui/config.py](file://backend/open_webui/config.py#L974-L1004)
- [backend/open_webui/env.py](file://backend/open_webui/env.py#L279-L285)

## Configuration of Multiple AI Providers and Model Routing
Open WebUI supports the configuration of multiple AI providers, allowing users to route requests to different models based on their availability and performance. This is achieved through the use of configuration objects that define the base URLs and API keys for each provider.

In the backend, the `OLLAMA_BASE_URLS` and `OPENAI_API_BASE_URLS` are lists of strings that contain the URLs for multiple Ollama and OpenAI instances, respectively. These lists are used to distribute requests across multiple servers, providing load balancing and redundancy. The `OLLAMA_API_CONFIGS` and `OPENAI_API_CONFIGS` dictionaries contain additional configuration for each URL, such as API keys, connection types, and model filters.

Model routing is handled by the `get_all_models` function, which queries each configured provider for its available models and merges the results into a single list. This function uses the `merge_ollama_models_lists` and `get_merged_models` functions to combine the model lists from different sources. The merged list is then cached for a configurable period defined by `MODELS_CACHE_TTL`.

The configuration also supports prefixing model IDs with a provider identifier, which helps in distinguishing models from different sources. For example, a model from a specific Ollama instance can be prefixed with `ollama1.` to indicate its origin. This is useful when the same model name exists on multiple providers.

**Section sources**
- [backend/open_webui/routers/ollama.py](file://backend/open_webui/routers/ollama.py#L308-L322)
- [backend/open_webui/routers/openai.py](file://backend/open_webui/routers/openai.py#L511-L539)
- [backend/open_webui/main.py](file://backend/open_webui/main.py#L704-L722)

## API Timeouts, Retry Policies, and Rate Limiting
To ensure reliable communication with AI services, Open WebUI implements configurable timeouts, retry policies, and rate limiting. These settings are crucial for handling network latency, server overloads, and API rate limits.

API timeouts are controlled by the `AIOHTTP_CLIENT_TIMEOUT` environment variable, which sets the maximum time in seconds that the client will wait for a response from an AI service. This timeout is applied to all requests, including model listing, chat completion, and model pulling. A shorter timeout can prevent the UI from hanging on slow responses, while a longer timeout allows for more complex queries that may take longer to process.

Retry policies are implemented in the `send_get_request` and `send_post_request` functions in the `ollama.py` and `openai.py` routers. These functions use the `aiohttp` library to make asynchronous HTTP requests and include logic to retry failed requests. The retry logic is based on the type of error encountered. For example, network connection errors and timeouts are considered retryable, while authentication errors and bad requests are not.

Rate limiting is managed by the `RateLimiter` class in the `rate_limit.py` utility. This class uses a rolling window strategy to limit the number of requests a user can make within a specified time window. The rate limiter can use Redis for distributed rate limiting across multiple instances or fall back to in-memory storage if Redis is not available. The rate limiting configuration includes the maximum number of requests allowed in the window and the window size in seconds.

**Section sources**
- [backend/open_webui/routers/ollama.py](file://backend/open_webui/routers/ollama.py#L81-L114)
- [backend/open_webui/routers/openai.py](file://backend/open_webui/routers/openai.py#L72-L103)
- [backend/open_webui/utils/rate_limit.py](file://backend/open_webui/utils/rate_limit.py#L6-L140)

## GPU-Accelerated Inference Setup
GPU acceleration is essential for high-performance inference with large language models. Open WebUI supports GPU acceleration through Docker Compose configurations that allocate GPU resources to the Ollama container.

The `docker-compose.gpu.yaml` file defines a service for Ollama with GPU support. It uses the `deploy` section to reserve GPU devices for the container. The `driver` is set to `${OLLAMA_GPU_DRIVER-nvidia}`, which defaults to `nvidia` if the environment variable is not set. The `count` is set to `${OLLAMA_GPU_COUNT-1}`, allowing the user to specify the number of GPUs to use. The `capabilities` list includes `gpu`, which grants the container access to GPU resources.

To use GPU acceleration, the user must run the `run-compose.sh` script with the `--enable-gpu` flag. This flag adds the `docker-compose.gpu.yaml` file to the compose command, enabling GPU support. The script also sets the `OLLAMA_GPU_DRIVER` and `OLLAMA_GPU_COUNT` environment variables based on the command-line arguments.

For NVIDIA GPUs, the host must have the NVIDIA Container Toolkit installed to allow Docker containers to access the GPU. For AMD GPUs, a different driver may be required, and the `docker-compose.amdgpu.yaml` file can be used instead.

**Section sources**
- [docker-compose.gpu.yaml](file://docker-compose.gpu.yaml#L1-L12)
- [run-compose.sh](file://run-compose.sh#L166-L178)
- [run-ollama-docker.sh](file://run-ollama-docker.sh#L13-L15)

## Model Auto-Pulling and Caching
Open WebUI includes features for automatic model pulling and caching to improve user experience and reduce latency. When a user requests a model that is not available on the configured Ollama instance, the system can automatically pull the model from the Ollama library.

The model auto-pulling feature is implemented in the `pull_model` function in the `ollama.py` router. This function sends a POST request to the Ollama API's `/api/pull` endpoint with the model name. The request includes the `insecure` parameter set to `True`, allowing the pull from untrusted sources. The function is accessible to admin users only, ensuring that only authorized users can pull models.

Model caching is controlled by the `MODELS_CACHE_TTL` environment variable, which sets the time-to-live for the cached model list in seconds. The default value is `1`, meaning the model list is refreshed every second. This ensures that the UI always displays the most up-to-date list of available models, including those that have been recently pulled.

The caching mechanism uses the `aiocache` library to store the model list in memory or in Redis. The `get_all_models` function is decorated with the `@cached` decorator, which automatically caches the result of the function based on the user ID. This reduces the number of requests to the Ollama API and improves performance.

**Section sources**
- [backend/open_webui/routers/ollama.py](file://backend/open_webui/routers/ollama.py#L700-L723)
- [backend/open_webui/config.py](file://backend/open_webui/config.py#L547-L555)
- [backend/open_webui/main.py](file://backend/open_webui/main.py#L629-L649)

## Configuration Examples
This section provides examples of configuration for different AI service providers and hybrid setups. These examples demonstrate how to set up Open WebUI to work with various combinations of Ollama, OpenAI, and other providers.

### Example 1: Single Ollama Instance
For a simple setup with a single Ollama instance running on the same host, the `.env` file can be configured as follows:
```
OLLAMA_BASE_URL=http://localhost:11434
ENABLE_OLLAMA_API=true
ENABLE_OPENAI_API=false
```
This configuration enables the Ollama API and disables the OpenAI API, directing all requests to the local Ollama instance.

### Example 2: Multiple Ollama Instances
To use multiple Ollama instances for load balancing, the `OLLAMA_BASE_URLS` can be set to a semicolon-separated list of URLs:
```
OLLAMA_BASE_URLS=http://ollama1:11434;http://ollama2:11434
OLLAMA_API_CONFIGS={"0":{"key":"secret1"},"1":{"key":"secret2"}}
```
This configuration defines two Ollama instances with different API keys. The `OLLAMA_API_CONFIGS` dictionary maps each URL to its configuration, including the API key.

### Example 3: Hybrid Ollama and OpenAI Setup
For a hybrid setup that uses both Ollama and OpenAI, the configuration can be:
```
OLLAMA_BASE_URL=http://localhost:11434
OPENAI_API_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ENABLE_OLLAMA_API=true
ENABLE_OPENAI_API=true
```
This setup allows the user to choose between models hosted on the local Ollama instance and models available through the OpenAI API.

### Example 4: Azure OpenAI
To connect to an Azure OpenAI service, the `OPENAI_API_BASE_URL` should point to the Azure endpoint, and the `OPENAI_API_KEY` should be the Azure API key:
```
OPENAI_API_BASE_URL=https://your-resource.openai.azure.com
OPENAI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_API_CONFIGS={"0":{"azure":true,"api_version":"2023-03-15-preview"}}
```
The `OPENAI_API_CONFIGS` dictionary includes the `azure` flag to enable Azure-specific features and the `api_version` to specify the API version.

**Section sources**
- [.env.example](file://.env.example#L1-L22)
- [backend/open_webui/config.py](file://backend/open_webui/config.py#L974-L1004)
- [backend/open_webui/routers/openai.py](file://backend/open_webui/routers/openai.py#L769-L799)

## Troubleshooting Common AI Service Issues
This section provides guidance for troubleshooting common issues with AI services in Open WebUI, such as model loading failures, API rate limits, and network connectivity problems.

### Model Loading Failures
If a model fails to load, the first step is to verify that the model is available on the Ollama instance. This can be done by accessing the Ollama API directly at `http://localhost:11434/api/tags` and checking if the model is listed. If the model is not listed, it may need to be pulled using the `pull_model` function.

Another common cause of model loading failures is insufficient GPU memory. Large models require significant GPU memory, and if the available memory is insufficient, the model will fail to load. In this case, the user should check the GPU memory usage and consider using a smaller model or adding more GPU memory.

### API Rate Limits
When using the OpenAI API, rate limits can be encountered if the number of requests exceeds the allowed quota. The error message will typically include the rate limit information. To resolve this, the user can wait for the rate limit to reset or upgrade their OpenAI plan to increase the quota.

In Open WebUI, the rate limiting can be adjusted by modifying the `AIOHTTP_CLIENT_TIMEOUT` and `AIOHTTP_CLIENT_TIMEOUT_MODEL_LIST` environment variables. Increasing these values can help prevent timeouts on slow responses.

### Network Connectivity Problems
Network connectivity problems can occur if the Open WebUI container cannot reach the Ollama server. This is often due to incorrect network configuration in Docker. The `extra_hosts` section in the `docker-compose.yaml` file can be used to add a host entry for `host.docker.internal`, which resolves to the host machine's IP address.

If the Ollama server is running on a different host, the `OLLAMA_BASE_URL` should be set to the correct IP address or hostname. For example, if the Ollama server is running on a machine with IP address `192.168.1.100`, the URL should be `http://192.168.1.100:11434`.

**Section sources**
- [TROUBLESHOOTING.md](file://TROUBLESHOOTING.md#L1-L37)
- [backend/open_webui/routers/ollama.py](file://backend/open_webui/routers/ollama.py#L492-L552)
- [backend/open_webui/routers/openai.py](file://backend/open_webui/routers/openai.py#L643-L727)

## Conclusion
Configuring AI services in Open WebUI involves setting up environment variables, managing multiple providers, and tuning performance parameters. By understanding the configuration options and troubleshooting common issues, users can create a robust and efficient AI service setup. The flexibility of Open WebUI allows for a wide range of configurations, from simple single-instance setups to complex multi-provider hybrid systems. With proper configuration, Open WebUI can provide a seamless and powerful interface for interacting with AI models.