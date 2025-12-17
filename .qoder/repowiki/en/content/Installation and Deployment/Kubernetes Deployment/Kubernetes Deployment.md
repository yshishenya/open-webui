# Kubernetes Deployment

<cite>
**Referenced Files in This Document**   
- [kustomization.yaml](file://kubernetes/manifest/base/kustomization.yaml)
- [webui-deployment.yaml](file://kubernetes/manifest/base/webui-deployment.yaml)
- [webui-service.yaml](file://kubernetes/manifest/base/webui-service.yaml)
- [webui-pvc.yaml](file://kubernetes/manifest/base/webui-pvc.yaml)
- [webui-ingress.yaml](file://kubernetes/manifest/base/webui-ingress.yaml)
- [open-webui.yaml](file://kubernetes/manifest/base/open-webui.yaml)
- [ollama-statefulset.yaml](file://kubernetes/manifest/base/ollama-statefulset.yaml)
- [ollama-service.yaml](file://kubernetes/manifest/base/ollama-service.yaml)
- [gpu/kustomization.yaml](file://kubernetes/manifest/gpu/kustomization.yaml)
- [gpu/ollama-statefulset-gpu.yaml](file://kubernetes/manifest/gpu/ollama-statefulset-gpu.yaml)
- [helm/README.md](file://kubernetes/helm/README.md)
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

## Introduction
This document provides comprehensive guidance for deploying Open WebUI on Kubernetes using both Kustomize and Helm. The deployment configuration supports both CPU-only and GPU-accelerated environments, with dedicated manifests for each use case. The documentation covers the base Kubernetes manifests, Kustomize overlays for GPU configurations, and references the external Helm chart repository for advanced deployment options.

## Project Structure

```mermaid
graph TD
K["kubernetes/"]
K --> H["helm/"]
K --> M["manifest/"]
M --> B["base/"]
M --> G["gpu/"]
B --> KU["kustomization.yaml"]
B --> NS["open-webui.yaml"]
B --> WD["webui-deployment.yaml"]
B --> WS["webui-service.yaml"]
B --> WP["webui-pvc.yaml"]
B --> WI["webui-ingress.yaml"]
B --> OS["ollama-statefulset.yaml"]
B --> OSE["ollama-service.yaml"]
G --> GKU["kustomization.yaml"]
G --> OGPU["ollama-statefulset-gpu.yaml"]
```

**Diagram sources**
- [kustomization.yaml](file://kubernetes/manifest/base/kustomization.yaml)
- [open-webui.yaml](file://kubernetes/manifest/base/open-webui.yaml)
- [webui-deployment.yaml](file://kubernetes/manifest/base/webui-deployment.yaml)
- [webui-service.yaml](file://kubernetes/manifest/base/webui-service.yaml)
- [webui-pvc.yaml](file://kubernetes/manifest/base/webui-pvc.yaml)
- [webui-ingress.yaml](file://kubernetes/manifest/base/webui-ingress.yaml)
- [ollama-statefulset.yaml](file://kubernetes/manifest/base/ollama-statefulset.yaml)
- [ollama-service.yaml](file://kubernetes/manifest/base/ollama-service.yaml)
- [gpu/kustomization.yaml](file://kubernetes/manifest/gpu/kustomization.yaml)
- [gpu/ollama-statefulset-gpu.yaml](file://kubernetes/manifest/gpu/ollama-statefulset-gpu.yaml)

**Section sources**
- [kustomization.yaml](file://kubernetes/manifest/base/kustomization.yaml)
- [open-webui.yaml](file://kubernetes/manifest/base/open-webui.yaml)
- [webui-deployment.yaml](file://kubernetes/manifest/base/webui-deployment.yaml)
- [webui-service.yaml](file://kubernetes/manifest/base/webui-service.yaml)
- [webui-pvc.yaml](file://kubernetes/manifest/base/webui-pvc.yaml)
- [webui-ingress.yaml](file://kubernetes/manifest/base/webui-ingress.yaml)
- [ollama-statefulset.yaml](file://kubernetes/manifest/base/ollama-statefulset.yaml)
- [ollama-service.yaml](file://kubernetes/manifest/base/ollama-service.yaml)
- [gpu/kustomization.yaml](file://kubernetes/manifest/gpu/kustomization.yaml)
- [gpu/ollama-statefulset-gpu.yaml](file://kubernetes/manifest/gpu/ollama-statefulset-gpu.yaml)

## Core Components

The Open WebUI Kubernetes deployment consists of several core components organized in the kubernetes/ directory. The base manifests provide a complete CPU-only deployment configuration, while the GPU-specific configuration extends this base with GPU resource allocation. The architecture includes separate StatefulSets for Ollama and the web UI, persistent volume claims for data storage, services for internal communication, and ingress configuration for external access.

**Section sources**
- [kustomization.yaml](file://kubernetes/manifest/base/kustomization.yaml)
- [webui-deployment.yaml](file://kubernetes/manifest/base/webui-deployment.yaml)
- [ollama-statefulset.yaml](file://kubernetes/manifest/base/ollama-statefulset.yaml)
- [webui-pvc.yaml](file://kubernetes/manifest/base/webui-pvc.yaml)
- [webui-service.yaml](file://kubernetes/manifest/base/webui-service.yaml)
- [ollama-service.yaml](file://kubernetes/manifest/base/ollama-service.yaml)

## Architecture Overview

```mermaid
graph TB
subgraph "airis namespace"
Ollama[Ollama StatefulSet]
WebUI[WebUI Deployment]
PVC[WebUI PVC]
OllamaPVC[Ollama PVC]
OllamaSvc[Ollama Service]
WebUISvc[WebUI Service]
Ingress[Ingress]
end
Client[External Client] --> Ingress
Ingress --> WebUISvc
WebUISvc --> WebUI
WebUI --> PVC
WebUI --> OllamaSvc
OllamaSvc --> Ollama
Ollama --> OllamaPVC
style Ollama fill:#f9f,stroke:#333
style WebUI fill:#bbf,stroke:#333
style PVC fill:#f96,stroke:#333
style OllamaPVC fill:#f96,stroke:#333
style OllamaSvc fill:#9f9,stroke:#333
style WebUISvc fill:#9f9,stroke:#333
style Ingress fill:#ff9,stroke:#333
```

**Diagram sources**
- [webui-deployment.yaml](file://kubernetes/manifest/base/webui-deployment.yaml)
- [ollama-statefulset.yaml](file://kubernetes/manifest/base/ollama-statefulset.yaml)
- [webui-pvc.yaml](file://kubernetes/manifest/base/webui-pvc.yaml)
- [ollama-statefulset.yaml](file://kubernetes/manifest/base/ollama-statefulset.yaml)
- [webui-service.yaml](file://kubernetes/manifest/base/webui-service.yaml)
- [ollama-service.yaml](file://kubernetes/manifest/base/ollama-service.yaml)
- [webui-ingress.yaml](file://kubernetes/manifest/base/webui-ingress.yaml)

## Detailed Component Analysis

### Base Manifests Analysis

The base manifests in kubernetes/manifest/base provide a complete CPU-only deployment configuration for Open WebUI. The architecture consists of a dedicated namespace, deployments for both the web UI and Ollama service, persistent volume claims for data persistence, services for internal communication, and ingress configuration for external access.

#### Namespace Configuration
The deployment creates a dedicated namespace named "airis" to isolate the Open WebUI components from other applications in the cluster. This provides better resource management and security isolation.

**Section sources**
- [open-webui.yaml](file://kubernetes/manifest/base/open-webui.yaml)

#### Web UI Deployment
The web UI is deployed as a Deployment resource with resource requests and limits configured for CPU and memory. The container is configured to connect to the Ollama service via a service DNS name and mounts a persistent volume for data storage.

```mermaid
classDiagram
class WebUIDeployment {
+replicas : 1
+selector : app=airis
+container : airis
+image : ghcr.io/airis/airis : main
+port : 8080
+env : OLLAMA_BASE_URL
+volumeMount : /app/backend/data
}
class WebUIService {
+type : NodePort
+selector : app=airis
+port : 8080
+targetPort : 8080
}
class WebUIPVC {
+accessModes : ReadWriteOnce
+storage : 2Gi
}
WebUIDeployment --> WebUIService : "exposes"
WebUIDeployment --> WebUIPVC : "uses"
```

**Diagram sources**
- [webui-deployment.yaml](file://kubernetes/manifest/base/webui-deployment.yaml)
- [webui-service.yaml](file://kubernetes/manifest/base/webui-service.yaml)
- [webui-pvc.yaml](file://kubernetes/manifest/base/webui-pvc.yaml)

**Section sources**
- [webui-deployment.yaml](file://kubernetes/manifest/base/webui-deployment.yaml)
- [webui-service.yaml](file://kubernetes/manifest/base/webui-service.yaml)
- [webui-pvc.yaml](file://kubernetes/manifest/base/webui-pvc.yaml)

#### Ollama Service Configuration
Ollama is deployed as a StatefulSet to ensure stable network identifiers and persistent storage. The configuration includes resource requests and limits optimized for CPU-based inference workloads, with a large persistent volume claim to store models.

```mermaid
classDiagram
class OllamaStatefulSet {
+replicas : 1
+serviceName : ollama
+selector : app=ollama
+container : ollama
+image : ollama/ollama : latest
+port : 11434
+cpu request : 2000m
+memory request : 2Gi
+cpu limit : 4000m
+memory limit : 4Gi
+volumeMount : /root/.ollama
}
class OllamaService {
+selector : app=ollama
+port : 11434
+targetPort : 11434
}
class OllamaPVC {
+accessModes : ReadWriteOnce
+storage : 30Gi
}
OllamaStatefulSet --> OllamaService : "exposes"
OllamaStatefulSet --> OllamaPVC : "uses"
```

**Diagram sources**
- [ollama-statefulset.yaml](file://kubernetes/manifest/base/ollama-statefulset.yaml)
- [ollama-service.yaml](file://kubernetes/manifest/base/ollama-service.yaml)

**Section sources**
- [ollama-statefulset.yaml](file://kubernetes/manifest/base/ollama-statefulset.yaml)
- [ollama-service.yaml](file://kubernetes/manifest/base/ollama-service.yaml)

### GPU Configuration Analysis

The GPU-specific configuration in kubernetes/manifest/gpu extends the base manifests with GPU resource allocation for Ollama. This configuration enables hardware acceleration for inference workloads, significantly improving performance for large language models.

#### Kustomize Overlay Structure
The GPU configuration uses Kustomize overlays to modify the base deployment. The kustomization.yaml file references the base manifests and applies a patch to add GPU resources to the Ollama StatefulSet.

```mermaid
flowchart TD
Base["Base Manifests"] --> |Inherited by| Overlay["GPU Overlay"]
Overlay --> Patch["ollama-statefulset-gpu.yaml"]
Patch --> GPU["Add nvidia.com/gpu: '1'"]
Overlay --> Final["Final GPU Deployment"]
style Base fill:#f9f,stroke:#333
style Overlay fill:#bbf,stroke:#333
style Patch fill:#9f9,stroke:#333
style Final fill:#ff9,stroke:#333
```

**Diagram sources**
- [gpu/kustomization.yaml](file://kubernetes/manifest/gpu/kustomization.yaml)
- [gpu/ollama-statefulset-gpu.yaml](file://kubernetes/manifest/gpu/ollama-statefulset-gpu.yaml)

**Section sources**
- [gpu/kustomization.yaml](file://kubernetes/manifest/gpu/kustomization.yaml)

#### GPU Resource Patch
The GPU patch modifies the Ollama StatefulSet to request one NVIDIA GPU for the container. This enables the Ollama service to leverage GPU acceleration for model inference, dramatically reducing response times for complex queries.

```mermaid
classDiagram
class OllamaStatefulSetBase {
+cpu request : 2000m
+memory request : 2Gi
+cpu limit : 4000m
+memory limit : 4Gi
+nvidia.com/gpu : "0"
}
class OllamaStatefulSetGPU {
+cpu request : 2000m
+memory request : 2Gi
+cpu limit : 4000m
+memory limit : 4Gi
+nvidia.com/gpu : "1"
}
OllamaStatefulSetBase --> OllamaStatefulSetGPU : "patched with"
note right of OllamaStatefulSetGPU
GPU patch adds nvidia.com/gpu : "1"
to enable GPU acceleration
end note
```

**Diagram sources**
- [gpu/ollama-statefulset-gpu.yaml](file://kubernetes/manifest/gpu/ollama-statefulset-gpu.yaml)

**Section sources**
- [gpu/ollama-statefulset-gpu.yaml](file://kubernetes/manifest/gpu/ollama-statefulset-gpu.yaml)

### Helm Chart Deployment

The Open WebUI project provides Helm charts for simplified deployment and management. The charts are hosted in a separate repository and published to a dedicated Helm repository, enabling easy installation and upgrades.

#### Helm Chart Configuration
The Helm charts offer a comprehensive set of configuration options through values.yaml, allowing customization of resources, ingress settings, persistence, and other deployment parameters. This provides a more flexible and maintainable deployment approach compared to raw manifests.

```mermaid
sequenceDiagram
participant User
participant Helm
participant Cluster
User->>Helm : helm repo add open-webui https : //helm.openwebui.com
User->>Helm : helm install open-webui open-webui/open-webui -f values.yaml
Helm->>Cluster : Deploy resources
Cluster-->>Helm : Confirmation
Helm-->>User : Installation complete
Note over Helm,Cluster : Helm processes templates<br/>and deploys resources<br/>to the Kubernetes cluster
```

**Section sources**
- [helm/README.md](file://kubernetes/helm/README.md)

## Dependency Analysis

```mermaid
graph TD
WebUI[WebUI Deployment] --> OllamaSvc[Ollama Service]
OllamaSvc --> Ollama[Ollama StatefulSet]
WebUI --> WebUIPVC[WebUI PVC]
Ollama --> OllamaPVC[Ollama PVC]
Ingress --> WebUISvc[WebUI Service]
WebUISvc --> WebUI
style WebUI stroke:#f00,stroke-width:2px
style Ollama stroke:#00f,stroke-width:2px
style WebUIPVC stroke:#0f0,stroke-width:2px
style OllamaPVC stroke:#0f0,stroke-width:2px
style Ingress stroke:#ff0,stroke-width:2px
classDef component stroke:#333,stroke-width:1px;
class WebUI,WebUISvc,WebUIPVC,Ollama,OllamaSvc,OllamaPVC,Ingress component;
```

**Diagram sources**
- [webui-deployment.yaml](file://kubernetes/manifest/base/webui-deployment.yaml)
- [webui-service.yaml](file://kubernetes/manifest/base/webui-service.yaml)
- [webui-pvc.yaml](file://kubernetes/manifest/base/webui-pvc.yaml)
- [ollama-statefulset.yaml](file://kubernetes/manifest/base/ollama-statefulset.yaml)
- [ollama-service.yaml](file://kubernetes/manifest/base/ollama-service.yaml)
- [webui-ingress.yaml](file://kubernetes/manifest/base/webui-ingress.yaml)

**Section sources**
- [webui-deployment.yaml](file://kubernetes/manifest/base/webui-deployment.yaml)
- [webui-service.yaml](file://kubernetes/manifest/base/webui-service.yaml)
- [webui-pvc.yaml](file://kubernetes/manifest/base/webui-pvc.yaml)
- [ollama-statefulset.yaml](file://kubernetes/manifest/base/ollama-statefulset.yaml)
- [ollama-service.yaml](file://kubernetes/manifest/base/ollama-service.yaml)
- [webui-ingress.yaml](file://kubernetes/manifest/base/webui-ingress.yaml)

## Performance Considerations

The Kubernetes deployment configuration for Open WebUI includes several performance optimizations. The base manifests allocate substantial CPU and memory resources to both the web UI and Ollama components, ensuring smooth operation for typical workloads. The Ollama StatefulSet is configured with 2-4 CPU cores and 2-4GB of memory, which is sufficient for CPU-based inference with smaller language models.

For GPU-accelerated deployments, the configuration enables hardware acceleration by requesting an NVIDIA GPU resource. This dramatically improves inference performance, particularly for larger models that benefit from parallel processing on GPU hardware. The separation of the web UI and Ollama into different StatefulSets allows for independent scaling and resource allocation based on workload requirements.

Persistent storage is configured with appropriate sizes for both components: 2GB for the web UI's data storage and 30GB for Ollama's model storage. This ensures sufficient space for application data and downloaded models while allowing for future expansion.

## Troubleshooting Guide

Common deployment issues may include:
- **Networking problems**: Verify that the Ingress host (airis.minikube.local) is resolvable and that the Ingress controller is properly configured
- **Resource allocation issues**: Ensure that nodes have sufficient CPU, memory, and GPU resources available, especially for GPU deployments
- **Pod initialization failures**: Check that persistent volumes are properly provisioned and accessible
- **Service connectivity**: Verify that the OLLAMA_BASE_URL environment variable in the web UI deployment matches the Ollama service DNS name
- **GPU driver issues**: For GPU deployments, ensure that NVIDIA drivers and device plugins are properly installed on worker nodes

When troubleshooting, examine pod logs and events using kubectl commands, verify resource availability, and check the status of all Kubernetes resources in the airis namespace.

**Section sources**
- [webui-deployment.yaml](file://kubernetes/manifest/base/webui-deployment.yaml)
- [ollama-statefulset.yaml](file://kubernetes/manifest/base/ollama-statefulset.yaml)
- [webui-ingress.yaml](file://kubernetes/manifest/base/webui-ingress.yaml)

## Conclusion

The Kubernetes deployment configuration for Open WebUI provides a robust foundation for both CPU-only and GPU-accelerated deployments. The use of Kustomize enables flexible configuration management through overlays, while the availability of Helm charts offers an alternative deployment method with enhanced customization options. The architecture separates concerns between the web UI and Ollama service, provides persistent storage for data and models, and includes ingress configuration for external access. By following the documented deployment procedures and understanding the component relationships, users can successfully deploy and manage Open WebUI in various Kubernetes environments.