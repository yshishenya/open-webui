# TODO: Implement a more intelligent load balancing mechanism for distributing requests among multiple backend instances.
# Current implementation uses a simple round-robin approach (random.choice). Consider incorporating algorithms like weighted round-robin,
# least connections, or least response time for better resource utilization and performance optimization.

import asyncio
import json
import logging
import os
import random
import re
import time
from typing import Optional, Union
from urllib.parse import urlparse

import aiohttp
from aiocache import cached

import requests

from fastapi import (
    Depends,
    FastAPI,
    File,
    HTTPException,
    Request,
    UploadFile,
    APIRouter,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict
from starlette.background import BackgroundTask


from open_webui.models.models import Models
from open_webui.utils.misc import (
    calculate_sha256,
)
from open_webui.utils.payload import (
    apply_model_params_to_body_ollama,
    apply_model_params_to_body_openai,
    apply_model_system_prompt_to_body,
)
from open_webui.utils.auth import get_admin_user, get_verified_user
from open_webui.utils.access_control import has_access


from open_webui.config import (
    UPLOAD_DIR,
)
from open_webui.env import (
    ENV,
    SRC_LOG_LEVELS,
    AIOHTTP_CLIENT_TIMEOUT,
    AIOHTTP_CLIENT_TIMEOUT_OPENAI_MODEL_LIST,
    BYPASS_MODEL_ACCESS_CONTROL,
)
from open_webui.constants import ERROR_MESSAGES

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS["OLLAMA"])


##########################################
#
# Utility functions
#
##########################################


async def send_get_request(url, key=None):
    timeout = aiohttp.ClientTimeout(total=AIOHTTP_CLIENT_TIMEOUT_OPENAI_MODEL_LIST)
    try:
        async with aiohttp.ClientSession(timeout=timeout, trust_env=True) as session:
            async with session.get(
                url, headers={**({"Authorization": f"Bearer {key}"} if key else {})}
            ) as response:
                return await response.json()
    except Exception as e:
        # Handle connection error here
        log.error(f"Connection error: {e}")
        return None


async def cleanup_response(
    response: Optional[aiohttp.ClientResponse],
    session: Optional[aiohttp.ClientSession],
):
    if response:
        response.close()
    if session:
        await session.close()


async def send_post_request(
    url: str,
    payload: Union[str, bytes],
    stream: bool = True,
    key: Optional[str] = None,
    content_type: Optional[str] = None,
):

    r = None
    try:
        session = aiohttp.ClientSession(
            trust_env=True, timeout=aiohttp.ClientTimeout(total=AIOHTTP_CLIENT_TIMEOUT)
        )

        r = await session.post(
            url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                **({"Authorization": f"Bearer {key}"} if key else {}),
            },
        )
        r.raise_for_status()

        if stream:
            response_headers = dict(r.headers)

            if content_type:
                response_headers["Content-Type"] = content_type

            return StreamingResponse(
                r.content,
                status_code=r.status,
                headers=response_headers,
                background=BackgroundTask(
                    cleanup_response, response=r, session=session
                ),
            )
        else:
            res = await r.json()
            await cleanup_response(r, session)
            return res

    except Exception as e:
        detail = None

        if r is not None:
            try:
                res = await r.json()
                if "error" in res:
                    detail = f"Ollama: {res.get('error', 'Unknown error')}"
            except Exception:
                detail = f"Ollama: {e}"

        raise HTTPException(
            status_code=r.status if r else 500,
            detail=detail if detail else "Open WebUI: Server Connection Error",
        )


def get_api_key(idx, url, configs):
    """Retrieve the API key based on the provided index and URL.

    This function parses the given URL to extract its base URL and then
    attempts to retrieve the corresponding API key from the provided
    configurations. It first checks for the key associated with the
    specified index and, if not found, falls back to checking the base URL.
    This allows for legacy support in configuration management.

    Args:
        idx (int): The index used to look up the API key in the configs.
        url (str): The URL from which the base URL will be extracted.
        configs (dict): A dictionary containing configuration settings,
            including API keys.

    Returns:
        str or None: The API key associated with the given index or base URL,
            or None if no key is found.
    """

    parsed_url = urlparse(url)
    base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
    return configs.get(str(idx), configs.get(base_url, {})).get(
        "key", None
    )  # Legacy support


##########################################
#
# API routes
#
##########################################

router = APIRouter()


@router.head("/")
@router.get("/")
async def get_status():
    return {"status": True}


class ConnectionVerificationForm(BaseModel):
    url: str
    key: Optional[str] = None


@router.post("/verify")
async def verify_connection(
    form_data: ConnectionVerificationForm, user=Depends(get_admin_user)
):
    url = form_data.url
    key = form_data.key

    async with aiohttp.ClientSession(
        timeout=aiohttp.ClientTimeout(total=AIOHTTP_CLIENT_TIMEOUT_OPENAI_MODEL_LIST)
    ) as session:
        try:
            async with session.get(
                f"{url}/api/version",
                headers={**({"Authorization": f"Bearer {key}"} if key else {})},
            ) as r:
                if r.status != 200:
                    detail = f"HTTP Error: {r.status}"
                    res = await r.json()

                    if "error" in res:
                        detail = f"External Error: {res['error']}"
                    raise Exception(detail)

                data = await r.json()
                return data
        except aiohttp.ClientError as e:
            log.exception(f"Client error: {str(e)}")
            raise HTTPException(
                status_code=500, detail="Open WebUI: Server Connection Error"
            )
        except Exception as e:
            log.exception(f"Unexpected error: {e}")
            error_detail = f"Unexpected error: {str(e)}"
            raise HTTPException(status_code=500, detail=error_detail)


@router.get("/config")
async def get_config(request: Request, user=Depends(get_admin_user)):
    return {
        "ENABLE_OLLAMA_API": request.app.state.config.ENABLE_OLLAMA_API,
        "OLLAMA_BASE_URLS": request.app.state.config.OLLAMA_BASE_URLS,
        "OLLAMA_API_CONFIGS": request.app.state.config.OLLAMA_API_CONFIGS,
    }


class OllamaConfigForm(BaseModel):
    ENABLE_OLLAMA_API: Optional[bool] = None
    OLLAMA_BASE_URLS: list[str]
    OLLAMA_API_CONFIGS: dict


@router.post("/config/update")
async def update_config(
    request: Request, form_data: OllamaConfigForm, user=Depends(get_admin_user)
):
    """Update the Ollama API configuration.

    This function updates the configuration settings for the Ollama API
    based on the provided form data. It modifies the application's state to
    reflect the new settings, including enabling or disabling the API,
    updating the base URLs, and filtering the API configurations to only
    include those that correspond to the specified base URLs.

    Args:
        request (Request): The request object containing application state.
        form_data (OllamaConfigForm): The form data containing new configuration values.
        user: The user making the request, defaults to an admin user.

    Returns:
        dict: A dictionary containing the updated configuration values for
            ENABLE_OLLAMA_API, OLLAMA_BASE_URLS, and OLLAMA_API_CONFIGS.
    """

    request.app.state.config.ENABLE_OLLAMA_API = form_data.ENABLE_OLLAMA_API

    request.app.state.config.OLLAMA_BASE_URLS = form_data.OLLAMA_BASE_URLS
    request.app.state.config.OLLAMA_API_CONFIGS = form_data.OLLAMA_API_CONFIGS

    # Remove the API configs that are not in the API URLS
    keys = list(map(str, range(len(request.app.state.config.OLLAMA_BASE_URLS))))
    request.app.state.config.OLLAMA_API_CONFIGS = {
        key: value
        for key, value in request.app.state.config.OLLAMA_API_CONFIGS.items()
        if key in keys
    }

    return {
        "ENABLE_OLLAMA_API": request.app.state.config.ENABLE_OLLAMA_API,
        "OLLAMA_BASE_URLS": request.app.state.config.OLLAMA_BASE_URLS,
        "OLLAMA_API_CONFIGS": request.app.state.config.OLLAMA_API_CONFIGS,
    }


@cached(ttl=3)
async def get_all_models(request: Request):
    """Retrieve all models from configured OLLAMA APIs.

    This function checks if the OLLAMA API is enabled in the application
    configuration. If enabled, it sends asynchronous GET requests to the
    specified OLLAMA base URLs to retrieve model tags. The function
    processes the responses to filter and merge model information based on
    the provided configurations, including any prefixes and model IDs. If
    the OLLAMA API is not enabled, it returns an empty list of models.

    Args:
        request (Request): The request object containing application state and configuration.

    Returns:
        dict: A dictionary containing a list of models retrieved from the OLLAMA APIs.
    """

    log.info("get_all_models()")
    if request.app.state.config.ENABLE_OLLAMA_API:
        request_tasks = []
        for idx, url in enumerate(request.app.state.config.OLLAMA_BASE_URLS):
            if (str(idx) not in request.app.state.config.OLLAMA_API_CONFIGS) and (
                url not in request.app.state.config.OLLAMA_API_CONFIGS  # Legacy support
            ):
                request_tasks.append(send_get_request(f"{url}/api/tags"))
            else:
                api_config = request.app.state.config.OLLAMA_API_CONFIGS.get(
                    str(idx),
                    request.app.state.config.OLLAMA_API_CONFIGS.get(
                        url, {}
                    ),  # Legacy support
                )

                enable = api_config.get("enable", True)
                key = api_config.get("key", None)

                if enable:
                    request_tasks.append(send_get_request(f"{url}/api/tags", key))
                else:
                    request_tasks.append(asyncio.ensure_future(asyncio.sleep(0, None)))

        responses = await asyncio.gather(*request_tasks)

        for idx, response in enumerate(responses):
            if response:
                url = request.app.state.config.OLLAMA_BASE_URLS[idx]
                api_config = request.app.state.config.OLLAMA_API_CONFIGS.get(
                    str(idx),
                    request.app.state.config.OLLAMA_API_CONFIGS.get(
                        url, {}
                    ),  # Legacy support
                )

                prefix_id = api_config.get("prefix_id", None)
                model_ids = api_config.get("model_ids", [])

                if len(model_ids) != 0 and "models" in response:
                    response["models"] = list(
                        filter(
                            lambda model: model["model"] in model_ids,
                            response["models"],
                        )
                    )

                if prefix_id:
                    for model in response.get("models", []):
                        model["model"] = f"{prefix_id}.{model['model']}"

        def merge_models_lists(model_lists):
            merged_models = {}

            for idx, model_list in enumerate(model_lists):
                if model_list is not None:
                    for model in model_list:
                        id = model["model"]
                        if id not in merged_models:
                            model["urls"] = [idx]
                            merged_models[id] = model
                        else:
                            merged_models[id]["urls"].append(idx)

            return list(merged_models.values())

        models = {
            "models": merge_models_lists(
                map(
                    lambda response: response.get("models", []) if response else None,
                    responses,
                )
            )
        }

    else:
        models = {"models": []}

    request.app.state.OLLAMA_MODELS = {
        model["model"]: model for model in models["models"]
    }
    return models


async def get_filtered_models(models, user):
    # Filter models based on user access control
    filtered_models = []
    for model in models.get("models", []):
        model_info = Models.get_model_by_id(model["model"])
        if model_info:
            if user.id == model_info.user_id or has_access(
                user.id, type="read", access_control=model_info.access_control
            ):
                filtered_models.append(model)
    return filtered_models


@router.get("/api/tags")
@router.get("/api/tags/{url_idx}")
async def get_ollama_tags(
    request: Request, url_idx: Optional[int] = None, user=Depends(get_verified_user)
):
    """Retrieve Ollama tags based on the provided request and user context.

    This function fetches the tags associated with Ollama models. If no
    specific URL index is provided, it retrieves all models. If a URL index
    is specified, it constructs a request to the corresponding Ollama API
    endpoint to fetch the tags. The function handles potential errors during
    the API request and raises an HTTPException with appropriate details if
    an error occurs. Additionally, it applies access control based on the
    user's role.

    Args:
        request (Request): The request object containing application state and configuration.
        url_idx (Optional[int]): The index of the Ollama base URL to use for the API request.
        user: The user object, typically obtained through dependency injection.

    Returns:
        list: A list of models or tags retrieved from the Ollama API.

    Raises:
        HTTPException: If there is an error during the API request or if the user
            does not have access to the requested models.
    """

    models = []

    if url_idx is None:
        models = await get_all_models(request)
    else:
        url = request.app.state.config.OLLAMA_BASE_URLS[url_idx]
        key = get_api_key(url_idx, url, request.app.state.config.OLLAMA_API_CONFIGS)

        r = None
        try:
            r = requests.request(
                method="GET",
                url=f"{url}/api/tags",
                headers={**({"Authorization": f"Bearer {key}"} if key else {})},
            )
            r.raise_for_status()

            models = r.json()
        except Exception as e:
            log.exception(e)

            detail = None
            if r is not None:
                try:
                    res = r.json()
                    if "error" in res:
                        detail = f"Ollama: {res['error']}"
                except Exception:
                    detail = f"Ollama: {e}"

            raise HTTPException(
                status_code=r.status_code if r else 500,
                detail=detail if detail else "Open WebUI: Server Connection Error",
            )

    if user.role == "user" and not BYPASS_MODEL_ACCESS_CONTROL:
        models["models"] = get_filtered_models(models, user)

    return models


@router.get("/api/version")
@router.get("/api/version/{url_idx}")
async def get_ollama_versions(request: Request, url_idx: Optional[int] = None):
    """Get the versions of the Ollama API.

    This function retrieves the version information from the Ollama API. If
    no specific URL index is provided, it will query all configured Ollama
    base URLs and return the lowest version found. If a specific URL index
    is provided, it will query that particular URL for its version. The
    function handles potential errors and raises HTTP exceptions with
    appropriate status codes and messages when necessary.

    Args:
        request (Request): The request object containing application state and configuration.
        url_idx (Optional[int]): The index of the Ollama base URL to query. If None, queries all URLs.

    Returns:
        dict: A dictionary containing the version information, or {"version": False}
            if the Ollama API is disabled.

    Raises:
        HTTPException: If there is an error retrieving the version from the Ollama API or if no
            versions are found.
    """

    if request.app.state.config.ENABLE_OLLAMA_API:
        if url_idx is None:
            # returns lowest version
            request_tasks = [
                send_get_request(
                    f"{url}/api/version",
                    request.app.state.config.OLLAMA_API_CONFIGS.get(
                        str(idx),
                        request.app.state.config.OLLAMA_API_CONFIGS.get(
                            url, {}
                        ),  # Legacy support
                    ).get("key", None),
                )
                for idx, url in enumerate(request.app.state.config.OLLAMA_BASE_URLS)
            ]
            responses = await asyncio.gather(*request_tasks)
            responses = list(filter(lambda x: x is not None, responses))

            if len(responses) > 0:
                lowest_version = min(
                    responses,
                    key=lambda x: tuple(
                        map(int, re.sub(r"^v|-.*", "", x["version"]).split("."))
                    ),
                )

                return {"version": lowest_version["version"]}
            else:
                raise HTTPException(
                    status_code=500,
                    detail=ERROR_MESSAGES.OLLAMA_NOT_FOUND,
                )
        else:
            url = request.app.state.config.OLLAMA_BASE_URLS[url_idx]

            r = None
            try:
                r = requests.request(method="GET", url=f"{url}/api/version")
                r.raise_for_status()

                return r.json()
            except Exception as e:
                log.exception(e)

                detail = None
                if r is not None:
                    try:
                        res = r.json()
                        if "error" in res:
                            detail = f"Ollama: {res['error']}"
                    except Exception:
                        detail = f"Ollama: {e}"

                raise HTTPException(
                    status_code=r.status_code if r else 500,
                    detail=detail if detail else "Open WebUI: Server Connection Error",
                )
    else:
        return {"version": False}


@router.get("/api/ps")
async def get_ollama_loaded_models(request: Request, user=Depends(get_verified_user)):
    """Retrieve a list of models currently loaded in Ollama memory.

    This function checks if the Ollama API is enabled in the application
    configuration. If enabled, it sends asynchronous GET requests to the
    Ollama API for each base URL configured in the application state. The
    function collects the responses and returns a dictionary mapping each
    base URL to its corresponding response, which contains information about
    the loaded models.

    Args:
        request (Request): The request object containing application state and configuration.
        user: The verified user dependency (default is obtained from
            `get_verified_user`).

    Returns:
        dict: A dictionary mapping Ollama base URLs to their respective loaded model
            responses.
    """
    if request.app.state.config.ENABLE_OLLAMA_API:
        request_tasks = [
            send_get_request(
                f"{url}/api/ps",
                request.app.state.config.OLLAMA_API_CONFIGS.get(
                    str(idx),
                    request.app.state.config.OLLAMA_API_CONFIGS.get(
                        url, {}
                    ),  # Legacy support
                ).get("key", None),
            )
            for idx, url in enumerate(request.app.state.config.OLLAMA_BASE_URLS)
        ]
        responses = await asyncio.gather(*request_tasks)

        return dict(zip(request.app.state.config.OLLAMA_BASE_URLS, responses))
    else:
        return {}


class ModelNameForm(BaseModel):
    name: str


@router.post("/api/pull")
@router.post("/api/pull/{url_idx}")
async def pull_model(
    request: Request,
    form_data: ModelNameForm,
    url_idx: int = 0,
    user=Depends(get_admin_user),
):
    """Pull a model from a specified source using the provided request and form
    data.

    This function allows an admin user to pull models from a specified URL.
    It constructs a payload from the provided form data and sends a POST
    request to the appropriate API endpoint. The URL is determined based on
    the index provided, and the function utilizes the application's
    configuration to retrieve the necessary API key for authentication.

    Args:
        request (Request): The HTTP request object containing application state and configuration.
        form_data (ModelNameForm): The form data containing model information to be pulled.
        url_idx (int?): The index of the URL to use from the configuration. Defaults to 0.
        user: The user dependency that ensures the user has admin privileges.

    Returns:
        Awaitable: The result of the POST request to the model pull API.
    """

    url = request.app.state.config.OLLAMA_BASE_URLS[url_idx]
    log.info(f"url: {url}")

    # Admin should be able to pull models from any source
    payload = {**form_data.model_dump(exclude_none=True), "insecure": True}

    return await send_post_request(
        url=f"{url}/api/pull",
        payload=json.dumps(payload),
        key=get_api_key(url_idx, url, request.app.state.config.OLLAMA_API_CONFIGS),
    )


class PushModelForm(BaseModel):
    name: str
    insecure: Optional[bool] = None
    stream: Optional[bool] = None


@router.delete("/api/push")
@router.delete("/api/push/{url_idx}")
async def push_model(
    request: Request,
    form_data: PushModelForm,
    url_idx: Optional[int] = None,
    user=Depends(get_admin_user),
):
    """Push a model to the specified URL.

    This function handles the process of pushing a model to a specified
    endpoint. It first checks if a URL index is provided; if not, it
    retrieves all available models and attempts to find the corresponding
    URL for the given model name. If the model name is not found, it raises
    an HTTPException with a 400 status code. Once the URL is determined, it
    sends a POST request to the appropriate API endpoint with the model
    data.

    Args:
        request (Request): The HTTP request object.
        form_data (PushModelForm): The form data containing model information to be pushed.
        url_idx (Optional[int]?): The index of the URL to use. Defaults to None.
        user: The user dependency, which defaults to the admin user.

    Returns:
        Response: The response from the POST request sent to the model API.

    Raises:
        HTTPException: If the model name is not found in the available models.
    """

    if url_idx is None:
        await get_all_models(request)
        models = request.app.state.OLLAMA_MODELS

        if form_data.name in models:
            url_idx = models[form_data.name]["urls"][0]
        else:
            raise HTTPException(
                status_code=400,
                detail=ERROR_MESSAGES.MODEL_NOT_FOUND(form_data.name),
            )

    url = request.app.state.config.OLLAMA_BASE_URLS[url_idx]
    log.debug(f"url: {url}")

    return await send_post_request(
        url=f"{url}/api/push",
        payload=form_data.model_dump_json(exclude_none=True).encode(),
        key=get_api_key(url_idx, url, request.app.state.config.OLLAMA_API_CONFIGS),
    )


class CreateModelForm(BaseModel):
    model: Optional[str] = None
    stream: Optional[bool] = None
    path: Optional[str] = None

    model_config = ConfigDict(extra="allow")


@router.post("/api/create")
@router.post("/api/create/{url_idx}")
async def create_model(
    request: Request,
    form_data: CreateModelForm,
    url_idx: int = 0,
    user=Depends(get_admin_user),
):
    """Create a model using the provided form data.

    This function sends a POST request to create a model based on the data
    provided in the form. It retrieves the base URL from the application
    configuration and encodes the form data as JSON before sending it to the
    specified endpoint. The function also handles user dependency injection
    to ensure that only authorized users can create models.

    Args:
        request (Request): The HTTP request object containing application state and configuration.
        form_data (CreateModelForm): The form data containing the model information to be created.
        url_idx (int?): The index of the base URL to use from the configuration. Defaults to 0.
        user: The user dependency, which is resolved to ensure admin access.

    Returns:
        Response: The response from the POST request indicating the result of the model
            creation.
    """

    log.debug(f"form_data: {form_data}")
    url = request.app.state.config.OLLAMA_BASE_URLS[url_idx]

    return await send_post_request(
        url=f"{url}/api/create",
        payload=form_data.model_dump_json(exclude_none=True).encode(),
        key=get_api_key(url_idx, url, request.app.state.config.OLLAMA_API_CONFIGS),
    )


class CopyModelForm(BaseModel):
    source: str
    destination: str


@router.post("/api/copy")
@router.post("/api/copy/{url_idx}")
async def copy_model(
    request: Request,
    form_data: CopyModelForm,
    url_idx: Optional[int] = None,
    user=Depends(get_admin_user),
):
    """Copy a model from a specified source.

    This function handles the copying of a model by making a POST request to
    the Ollama API. It retrieves the necessary model information based on
    the provided form data and, if no URL index is specified, it fetches all
    available models. If the source model is found, it constructs the
    appropriate request to copy the model. In case of any errors during the
    request, it raises an HTTPException with relevant details.

    Args:
        request (Request): The HTTP request object.
        form_data (CopyModelForm): The form data containing model information.
        url_idx (Optional[int]?): The index of the URL to use for the API request. Defaults to None.
        user: The user dependency for admin access.

    Returns:
        bool: True if the model copy operation was successful.

    Raises:
        HTTPException: If the source model is not found or if there is an error
    """

    if url_idx is None:
        await get_all_models(request)
        models = request.app.state.OLLAMA_MODELS

        if form_data.source in models:
            url_idx = models[form_data.source]["urls"][0]
        else:
            raise HTTPException(
                status_code=400,
                detail=ERROR_MESSAGES.MODEL_NOT_FOUND(form_data.source),
            )

    url = request.app.state.config.OLLAMA_BASE_URLS[url_idx]
    key = get_api_key(url_idx, url, request.app.state.config.OLLAMA_API_CONFIGS)

    try:
        r = requests.request(
            method="POST",
            url=f"{url}/api/copy",
            headers={
                "Content-Type": "application/json",
                **({"Authorization": f"Bearer {key}"} if key else {}),
            },
            data=form_data.model_dump_json(exclude_none=True).encode(),
        )
        r.raise_for_status()

        log.debug(f"r.text: {r.text}")
        return True
    except Exception as e:
        log.exception(e)

        detail = None
        if r is not None:
            try:
                res = r.json()
                if "error" in res:
                    detail = f"Ollama: {res['error']}"
            except Exception:
                detail = f"Ollama: {e}"

        raise HTTPException(
            status_code=r.status_code if r else 500,
            detail=detail if detail else "Open WebUI: Server Connection Error",
        )


@router.delete("/api/delete")
@router.delete("/api/delete/{url_idx}")
async def delete_model(
    request: Request,
    form_data: ModelNameForm,
    url_idx: Optional[int] = None,
    user=Depends(get_admin_user),
):
    """Delete a model from the server.

    This function handles the deletion of a specified model by sending a
    DELETE request to the server. It first checks if the model name provided
    in the form data exists in the list of models. If the model is found, it
    retrieves the corresponding URL and API key, then sends the deletion
    request. In case of an error during the request, it raises an
    HTTPException with appropriate details.

    Args:
        request (Request): The HTTP request object.
        form_data (ModelNameForm): The form data containing the model name to be deleted.
        url_idx (Optional[int]?): The index of the URL to use for the request. Defaults to None.
        user: The user dependency, which defaults to an admin user.

    Returns:
        bool: True if the model was successfully deleted.

    Raises:
        HTTPException: If the model is not found or if there is an error during the deletion
            request.
    """

    if url_idx is None:
        await get_all_models(request)
        models = request.app.state.OLLAMA_MODELS

        if form_data.name in models:
            url_idx = models[form_data.name]["urls"][0]
        else:
            raise HTTPException(
                status_code=400,
                detail=ERROR_MESSAGES.MODEL_NOT_FOUND(form_data.name),
            )

    url = request.app.state.config.OLLAMA_BASE_URLS[url_idx]
    key = get_api_key(url_idx, url, request.app.state.config.OLLAMA_API_CONFIGS)

    try:
        r = requests.request(
            method="DELETE",
            url=f"{url}/api/delete",
            data=form_data.model_dump_json(exclude_none=True).encode(),
            headers={
                "Content-Type": "application/json",
                **({"Authorization": f"Bearer {key}"} if key else {}),
            },
        )
        r.raise_for_status()

        log.debug(f"r.text: {r.text}")
        return True
    except Exception as e:
        log.exception(e)

        detail = None
        if r is not None:
            try:
                res = r.json()
                if "error" in res:
                    detail = f"Ollama: {res['error']}"
            except Exception:
                detail = f"Ollama: {e}"

        raise HTTPException(
            status_code=r.status_code if r else 500,
            detail=detail if detail else "Open WebUI: Server Connection Error",
        )


@router.post("/api/show")
async def show_model_info(
    request: Request, form_data: ModelNameForm, user=Depends(get_verified_user)
):
    """Show information about a specified model.

    This function retrieves and displays information about a model based on
    the provided form data. It first checks if the model exists in the
    application's state. If the model is found, it makes a POST request to
    the appropriate API endpoint to fetch the model information. The
    function handles potential errors by logging exceptions and raising HTTP
    exceptions with relevant details.

    Args:
        request (Request): The HTTP request object.
        form_data (ModelNameForm): The form data containing the model name.
        user (Depends): The verified user dependency, defaulting to the result of
            `get_verified_user`.

    Returns:
        dict: The JSON response containing the model information.

    Raises:
        HTTPException: If the model is not found or if there is an error during the
            API request.
    """

    await get_all_models(request)
    models = request.app.state.OLLAMA_MODELS

    if form_data.name not in models:
        raise HTTPException(
            status_code=400,
            detail=ERROR_MESSAGES.MODEL_NOT_FOUND(form_data.name),
        )

    url_idx = random.choice(models[form_data.name]["urls"])

    url = request.app.state.config.OLLAMA_BASE_URLS[url_idx]
    key = get_api_key(url_idx, url, request.app.state.config.OLLAMA_API_CONFIGS)

    try:
        r = requests.request(
            method="POST",
            url=f"{url}/api/show",
            headers={
                "Content-Type": "application/json",
                **({"Authorization": f"Bearer {key}"} if key else {}),
            },
            data=form_data.model_dump_json(exclude_none=True).encode(),
        )
        r.raise_for_status()

        return r.json()
    except Exception as e:
        log.exception(e)

        detail = None
        if r is not None:
            try:
                res = r.json()
                if "error" in res:
                    detail = f"Ollama: {res['error']}"
            except Exception:
                detail = f"Ollama: {e}"

        raise HTTPException(
            status_code=r.status_code if r else 500,
            detail=detail if detail else "Open WebUI: Server Connection Error",
        )


class GenerateEmbedForm(BaseModel):
    model: str
    input: list[str] | str
    truncate: Optional[bool] = None
    options: Optional[dict] = None
    keep_alive: Optional[Union[int, str]] = None


@router.post("/api/embed")
@router.post("/api/embed/{url_idx}")
async def embed(
    request: Request,
    form_data: GenerateEmbedForm,
    url_idx: Optional[int] = None,
    user=Depends(get_verified_user),
):
    """Generate embeddings for a given model using the Ollama API.

    This function handles the embedding generation process by first checking
    if a model is specified. If not, it retrieves all available models and
    selects one at random. It then makes a POST request to the Ollama API to
    generate embeddings based on the provided form data. The function also
    handles potential errors during the API request and raises appropriate
    HTTP exceptions with detailed error messages.

    Args:
        request (Request): The HTTP request object.
        form_data (GenerateEmbedForm): The form data containing model information.
        url_idx (Optional[int]?): The index of the URL to use for the API request.
            Defaults to None, which triggers retrieval of all models.
        user: The verified user dependency.

    Returns:
        dict: The JSON response from the Ollama API containing the generated
            embeddings.

    Raises:
        HTTPException: If the specified model is not found or if there is an error
            during the API request.
    """

    log.info(f"generate_ollama_batch_embeddings {form_data}")

    if url_idx is None:
        await get_all_models(request)
        models = request.app.state.OLLAMA_MODELS

        model = form_data.model

        if ":" not in model:
            model = f"{model}:latest"

        if model in models:
            url_idx = random.choice(models[model]["urls"])
        else:
            raise HTTPException(
                status_code=400,
                detail=ERROR_MESSAGES.MODEL_NOT_FOUND(form_data.model),
            )

    url = request.app.state.config.OLLAMA_BASE_URLS[url_idx]
    key = get_api_key(url_idx, url, request.app.state.config.OLLAMA_API_CONFIGS)

    try:
        r = requests.request(
            method="POST",
            url=f"{url}/api/embed",
            headers={
                "Content-Type": "application/json",
                **({"Authorization": f"Bearer {key}"} if key else {}),
            },
            data=form_data.model_dump_json(exclude_none=True).encode(),
        )
        r.raise_for_status()

        data = r.json()
        return data
    except Exception as e:
        log.exception(e)

        detail = None
        if r is not None:
            try:
                res = r.json()
                if "error" in res:
                    detail = f"Ollama: {res['error']}"
            except Exception:
                detail = f"Ollama: {e}"

        raise HTTPException(
            status_code=r.status_code if r else 500,
            detail=detail if detail else "Open WebUI: Server Connection Error",
        )


class GenerateEmbeddingsForm(BaseModel):
    model: str
    prompt: str
    options: Optional[dict] = None
    keep_alive: Optional[Union[int, str]] = None


@router.post("/api/embeddings")
@router.post("/api/embeddings/{url_idx}")
async def embeddings(
    request: Request,
    form_data: GenerateEmbeddingsForm,
    url_idx: Optional[int] = None,
    user=Depends(get_verified_user),
):
    """Generate embeddings using a specified model.

    This function handles the generation of embeddings by sending a request
    to an external API. It first checks if a specific model is provided; if
    not, it retrieves all available models and selects one at random. The
    function constructs the request with the appropriate headers and data,
    then processes the response. If the model is not found or an error
    occurs during the request, it raises an HTTPException with the relevant
    details.

    Args:
        request (Request): The HTTP request object.
        form_data (GenerateEmbeddingsForm): The form data containing model information.
        url_idx (Optional[int]): An optional index to select a specific URL for the model.
        user: A dependency that verifies the user.

    Returns:
        dict: The JSON response containing the generated embeddings.

    Raises:
        HTTPException: If the model is not found or if there is an error during the request.
    """

    log.info(f"generate_ollama_embeddings {form_data}")

    if url_idx is None:
        await get_all_models(request)
        models = request.app.state.OLLAMA_MODELS

        model = form_data.model

        if ":" not in model:
            model = f"{model}:latest"

        if model in models:
            url_idx = random.choice(models[model]["urls"])
        else:
            raise HTTPException(
                status_code=400,
                detail=ERROR_MESSAGES.MODEL_NOT_FOUND(form_data.model),
            )

    url = request.app.state.config.OLLAMA_BASE_URLS[url_idx]
    key = get_api_key(url_idx, url, request.app.state.config.OLLAMA_API_CONFIGS)

    try:
        r = requests.request(
            method="POST",
            url=f"{url}/api/embeddings",
            headers={
                "Content-Type": "application/json",
                **({"Authorization": f"Bearer {key}"} if key else {}),
            },
            data=form_data.model_dump_json(exclude_none=True).encode(),
        )
        r.raise_for_status()

        data = r.json()
        return data
    except Exception as e:
        log.exception(e)

        detail = None
        if r is not None:
            try:
                res = r.json()
                if "error" in res:
                    detail = f"Ollama: {res['error']}"
            except Exception:
                detail = f"Ollama: {e}"

        raise HTTPException(
            status_code=r.status_code if r else 500,
            detail=detail if detail else "Open WebUI: Server Connection Error",
        )


class GenerateCompletionForm(BaseModel):
    model: str
    prompt: str
    suffix: Optional[str] = None
    images: Optional[list[str]] = None
    format: Optional[str] = None
    options: Optional[dict] = None
    system: Optional[str] = None
    template: Optional[str] = None
    context: Optional[list[int]] = None
    stream: Optional[bool] = True
    raw: Optional[bool] = None
    keep_alive: Optional[Union[int, str]] = None


@router.post("/api/generate")
@router.post("/api/generate/{url_idx}")
async def generate_completion(
    request: Request,
    form_data: GenerateCompletionForm,
    url_idx: Optional[int] = None,
    user=Depends(get_verified_user),
):
    """Generate a completion response based on the provided request and form
    data.

    This function processes a request to generate a completion using a
    specified model. It checks if the model is available and selects a URL
    from the available models. If the model is not found, it raises an
    HTTPException. The function also handles legacy support for API
    configurations and prepares the request payload before sending it to the
    appropriate endpoint.

    Args:
        request (Request): The incoming request object.
        form_data (GenerateCompletionForm): The form data containing model information.
        url_idx (Optional[int]?): The index of the URL to use for the API call. Defaults to None.
        user: The verified user dependency.

    Returns:
        Response: The response from the API after sending the completion request.

    Raises:
        HTTPException: If the specified model is not found in the available models.
    """

    if url_idx is None:
        await get_all_models(request)
        models = request.app.state.OLLAMA_MODELS

        model = form_data.model

        if ":" not in model:
            model = f"{model}:latest"

        if model in models:
            url_idx = random.choice(models[model]["urls"])
        else:
            raise HTTPException(
                status_code=400,
                detail=ERROR_MESSAGES.MODEL_NOT_FOUND(form_data.model),
            )

    url = request.app.state.config.OLLAMA_BASE_URLS[url_idx]
    api_config = request.app.state.config.OLLAMA_API_CONFIGS.get(
        str(url_idx),
        request.app.state.config.OLLAMA_API_CONFIGS.get(url, {}),  # Legacy support
    )

    prefix_id = api_config.get("prefix_id", None)
    if prefix_id:
        form_data.model = form_data.model.replace(f"{prefix_id}.", "")

    return await send_post_request(
        url=f"{url}/api/generate",
        payload=form_data.model_dump_json(exclude_none=True).encode(),
        key=get_api_key(url_idx, url, request.app.state.config.OLLAMA_API_CONFIGS),
    )


class ChatMessage(BaseModel):
    role: str
    content: str
    images: Optional[list[str]] = None


class GenerateChatCompletionForm(BaseModel):
    model: str
    messages: list[ChatMessage]
    format: Optional[dict] = None
    options: Optional[dict] = None
    template: Optional[str] = None
    stream: Optional[bool] = True
    keep_alive: Optional[Union[int, str]] = None


async def get_ollama_url(request: Request, model: str, url_idx: Optional[int] = None):
    """Retrieve the Ollama URL for a specified model.

    This function checks if the provided model exists in the application's
    state. If a URL index is not provided, it randomly selects one from the
    available URLs associated with the model. It then retrieves the
    corresponding base URL from the application's configuration.

    Args:
        request (Request): The HTTP request object containing application state.
        model (str): The name of the model for which to retrieve the URL.
        url_idx (Optional[int]): An optional index to specify which URL to retrieve.

    Returns:
        tuple: A tuple containing the selected URL (str) and its index (int).

    Raises:
        HTTPException: If the specified model is not found in the application's state.
    """

    if url_idx is None:
        models = request.app.state.OLLAMA_MODELS
        if model not in models:
            raise HTTPException(
                status_code=400,
                detail=ERROR_MESSAGES.MODEL_NOT_FOUND(model),
            )
        url_idx = random.choice(models[model].get("urls", []))
    url = request.app.state.config.OLLAMA_BASE_URLS[url_idx]
    return url, url_idx


@router.post("/api/chat")
@router.post("/api/chat/{url_idx}")
async def generate_chat_completion(
    request: Request,
    form_data: dict,
    url_idx: Optional[int] = None,
    user=Depends(get_verified_user),
    bypass_filter: Optional[bool] = False,
):
    """Generate a chat completion based on the provided request and form data.

    This function processes the incoming request to generate a chat
    completion by validating the form data, checking user access to the
    specified model, and preparing the payload for the API call. It handles
    model parameters and system prompts as necessary, ensuring that the user
    has the appropriate permissions to access the model. If any errors occur
    during form data validation or model access checks, appropriate HTTP
    exceptions are raised.

    Args:
        request (Request): The incoming request object.
        form_data (dict): A dictionary containing the form data for chat completion.
        url_idx (Optional[int]?): An optional index for the URL configuration. Defaults to None.
        user: The verified user making the request, obtained through dependency
            injection.
        bypass_filter (Optional[bool]?): A flag to bypass access control checks. Defaults to False.

    Returns:
        Response: The response from the chat completion API.

    Raises:
        HTTPException: If there are issues with form data validation or if the user does not
            have access
            to the specified model.
    """

    if BYPASS_MODEL_ACCESS_CONTROL:
        bypass_filter = True

    try:
        form_data = GenerateChatCompletionForm(**form_data)
    except Exception as e:
        log.exception(e)
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )

    payload = {**form_data.model_dump(exclude_none=True)}
    if "metadata" in payload:
        del payload["metadata"]

    model_id = payload["model"]
    model_info = Models.get_model_by_id(model_id)

    if model_info:
        if model_info.base_model_id:
            payload["model"] = model_info.base_model_id

        params = model_info.params.model_dump()

        if params:
            if payload.get("options") is None:
                payload["options"] = {}

            payload["options"] = apply_model_params_to_body_ollama(
                params, payload["options"]
            )
            payload = apply_model_system_prompt_to_body(params, payload, user)

        # Check if user has access to the model
        if not bypass_filter and user.role == "user":
            if not (
                user.id == model_info.user_id
                or has_access(
                    user.id, type="read", access_control=model_info.access_control
                )
            ):
                raise HTTPException(
                    status_code=403,
                    detail="Model not found",
                )
    elif not bypass_filter:
        if user.role != "admin":
            raise HTTPException(
                status_code=403,
                detail="Model not found",
            )

    if ":" not in payload["model"]:
        payload["model"] = f"{payload['model']}:latest"

    url, url_idx = await get_ollama_url(request, payload["model"], url_idx)
    api_config = request.app.state.config.OLLAMA_API_CONFIGS.get(
        str(url_idx),
        request.app.state.config.OLLAMA_API_CONFIGS.get(url, {}),  # Legacy support
    )

    prefix_id = api_config.get("prefix_id", None)
    if prefix_id:
        payload["model"] = payload["model"].replace(f"{prefix_id}.", "")

    return await send_post_request(
        url=f"{url}/api/chat",
        payload=json.dumps(payload),
        stream=form_data.stream,
        key=get_api_key(url_idx, url, request.app.state.config.OLLAMA_API_CONFIGS),
        content_type="application/x-ndjson",
    )


# TODO: we should update this part once Ollama supports other types
class OpenAIChatMessageContent(BaseModel):
    type: str
    model_config = ConfigDict(extra="allow")


class OpenAIChatMessage(BaseModel):
    role: str
    content: Union[str, list[OpenAIChatMessageContent]]

    model_config = ConfigDict(extra="allow")


class OpenAIChatCompletionForm(BaseModel):
    model: str
    messages: list[OpenAIChatMessage]

    model_config = ConfigDict(extra="allow")


class OpenAICompletionForm(BaseModel):
    model: str
    prompt: str

    model_config = ConfigDict(extra="allow")


@router.post("/v1/completions")
@router.post("/v1/completions/{url_idx}")
async def generate_openai_completion(
    request: Request,
    form_data: dict,
    url_idx: Optional[int] = None,
    user=Depends(get_verified_user),
):
    """Generate a completion from the OpenAI API.

    This function processes the provided form data to create a payload for
    the OpenAI API. It validates the model ID, checks user access
    permissions, and prepares the request to be sent to the OpenAI API. If
    the model is not found or if the user does not have the necessary
    permissions, it raises an HTTPException with an appropriate status code.

    Args:
        request (Request): The HTTP request object.
        form_data (dict): A dictionary containing the form data for the completion request.
        url_idx (Optional[int]?): An optional index for the URL configuration. Defaults to None.
        user: The verified user making the request.

    Returns:
        Response: The response from the OpenAI API after sending the completion request.

    Raises:
        HTTPException: If there is an error in processing the form data, if the model is not
            found,
            or if the user does not have access to the model.
    """

    try:
        form_data = OpenAICompletionForm(**form_data)
    except Exception as e:
        log.exception(e)
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )

    payload = {**form_data.model_dump(exclude_none=True, exclude=["metadata"])}
    if "metadata" in payload:
        del payload["metadata"]

    model_id = form_data.model
    if ":" not in model_id:
        model_id = f"{model_id}:latest"

    model_info = Models.get_model_by_id(model_id)
    if model_info:
        if model_info.base_model_id:
            payload["model"] = model_info.base_model_id
        params = model_info.params.model_dump()

        if params:
            payload = apply_model_params_to_body_openai(params, payload)

        # Check if user has access to the model
        if user.role == "user":
            if not (
                user.id == model_info.user_id
                or has_access(
                    user.id, type="read", access_control=model_info.access_control
                )
            ):
                raise HTTPException(
                    status_code=403,
                    detail="Model not found",
                )
    else:
        if user.role != "admin":
            raise HTTPException(
                status_code=403,
                detail="Model not found",
            )

    if ":" not in payload["model"]:
        payload["model"] = f"{payload['model']}:latest"

    url, url_idx = await get_ollama_url(request, payload["model"], url_idx)
    api_config = request.app.state.config.OLLAMA_API_CONFIGS.get(
        str(url_idx),
        request.app.state.config.OLLAMA_API_CONFIGS.get(url, {}),  # Legacy support
    )

    prefix_id = api_config.get("prefix_id", None)

    if prefix_id:
        payload["model"] = payload["model"].replace(f"{prefix_id}.", "")

    return await send_post_request(
        url=f"{url}/v1/completions",
        payload=json.dumps(payload),
        stream=payload.get("stream", False),
        key=get_api_key(url_idx, url, request.app.state.config.OLLAMA_API_CONFIGS),
    )


@router.post("/v1/chat/completions")
@router.post("/v1/chat/completions/{url_idx}")
async def generate_openai_chat_completion(
    request: Request,
    form_data: dict,
    url_idx: Optional[int] = None,
    user=Depends(get_verified_user),
):
    """Generate a chat completion using OpenAI's API.

    This function constructs a request payload for the OpenAI chat
    completion API based on the provided form data and user information. It
    validates the input, checks user access to the specified model, and
    prepares the payload for the API call. If the model is not found or if
    the user does not have the necessary permissions, it raises an
    HTTPException. The function also handles model parameters and system
    prompts before sending the request.

    Args:
        request (Request): The HTTP request object.
        form_data (dict): A dictionary containing the form data for the chat
            completion request.
        url_idx (Optional[int]?): An optional index for selecting the
            appropriate API URL configuration. Defaults to None.
        user: The user object obtained from dependency injection, which contains
            user information and role.

    Returns:
        dict: The response from the OpenAI chat completion API.

    Raises:
        HTTPException: If there is an error in processing the form data, if the
            model is not found, or if the user does not have access to the model.
    """

    try:
        completion_form = OpenAIChatCompletionForm(**form_data)
    except Exception as e:
        log.exception(e)
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )

    payload = {**completion_form.model_dump(exclude_none=True, exclude=["metadata"])}
    if "metadata" in payload:
        del payload["metadata"]

    model_id = completion_form.model
    if ":" not in model_id:
        model_id = f"{model_id}:latest"

    model_info = Models.get_model_by_id(model_id)
    if model_info:
        if model_info.base_model_id:
            payload["model"] = model_info.base_model_id

        params = model_info.params.model_dump()

        if params:
            payload = apply_model_params_to_body_openai(params, payload)
            payload = apply_model_system_prompt_to_body(params, payload, user)

        # Check if user has access to the model
        if user.role == "user":
            if not (
                user.id == model_info.user_id
                or has_access(
                    user.id, type="read", access_control=model_info.access_control
                )
            ):
                raise HTTPException(
                    status_code=403,
                    detail="Model not found",
                )
    else:
        if user.role != "admin":
            raise HTTPException(
                status_code=403,
                detail="Model not found",
            )

    if ":" not in payload["model"]:
        payload["model"] = f"{payload['model']}:latest"

    url, url_idx = await get_ollama_url(request, payload["model"], url_idx)
    api_config = request.app.state.config.OLLAMA_API_CONFIGS.get(
        str(url_idx),
        request.app.state.config.OLLAMA_API_CONFIGS.get(url, {}),  # Legacy support
    )

    prefix_id = api_config.get("prefix_id", None)
    if prefix_id:
        payload["model"] = payload["model"].replace(f"{prefix_id}.", "")

    return await send_post_request(
        url=f"{url}/v1/chat/completions",
        payload=json.dumps(payload),
        stream=payload.get("stream", False),
        key=get_api_key(url_idx, url, request.app.state.config.OLLAMA_API_CONFIGS),
    )


@router.get("/v1/models")
@router.get("/v1/models/{url_idx}")
async def get_openai_models(
    request: Request,
    url_idx: Optional[int] = None,
    user=Depends(get_verified_user),
):

    models = []
    if url_idx is None:
        model_list = await get_all_models(request)
        models = [
            {
                "id": model["model"],
                "object": "model",
                "created": int(time.time()),
                "owned_by": "openai",
            }
            for model in model_list["models"]
        ]

    else:
        url = request.app.state.config.OLLAMA_BASE_URLS[url_idx]
        try:
            r = requests.request(method="GET", url=f"{url}/api/tags")
            r.raise_for_status()

            model_list = r.json()

            models = [
                {
                    "id": model["model"],
                    "object": "model",
                    "created": int(time.time()),
                    "owned_by": "openai",
                }
                for model in models["models"]
            ]
        except Exception as e:
            log.exception(e)
            error_detail = "Open WebUI: Server Connection Error"
            if r is not None:
                try:
                    res = r.json()
                    if "error" in res:
                        error_detail = f"Ollama: {res['error']}"
                except Exception:
                    error_detail = f"Ollama: {e}"

            raise HTTPException(
                status_code=r.status_code if r else 500,
                detail=error_detail,
            )

    if user.role == "user" and not BYPASS_MODEL_ACCESS_CONTROL:
        # Filter models based on user access control
        filtered_models = []
        for model in models:
            model_info = Models.get_model_by_id(model["id"])
            if model_info:
                if user.id == model_info.user_id or has_access(
                    user.id, type="read", access_control=model_info.access_control
                ):
                    filtered_models.append(model)
        models = filtered_models

    return {
        "data": models,
        "object": "list",
    }


class UrlForm(BaseModel):
    url: str


class UploadBlobForm(BaseModel):
    filename: str


def parse_huggingface_url(hf_url):
    try:
        # Parse the URL
        parsed_url = urlparse(hf_url)

        # Get the path and split it into components
        path_components = parsed_url.path.split("/")

        # Extract the desired output
        model_file = path_components[-1]

        return model_file
    except ValueError:
        return None


async def download_file_stream(
    ollama_url, file_url, file_path, file_name, chunk_size=1024 * 1024
):
    done = False

    if os.path.exists(file_path):
        current_size = os.path.getsize(file_path)
    else:
        current_size = 0

    headers = {"Range": f"bytes={current_size}-"} if current_size > 0 else {}

    timeout = aiohttp.ClientTimeout(total=600)  # Set the timeout

    async with aiohttp.ClientSession(timeout=timeout, trust_env=True) as session:
        async with session.get(file_url, headers=headers) as response:
            total_size = int(response.headers.get("content-length", 0)) + current_size

            with open(file_path, "ab+") as file:
                async for data in response.content.iter_chunked(chunk_size):
                    current_size += len(data)
                    file.write(data)

                    done = current_size == total_size
                    progress = round((current_size / total_size) * 100, 2)

                    yield f'data: {{"progress": {progress}, "completed": {current_size}, "total": {total_size}}}\n\n'

                if done:
                    file.seek(0)
                    hashed = calculate_sha256(file)
                    file.seek(0)

                    url = f"{ollama_url}/api/blobs/sha256:{hashed}"
                    response = requests.post(url, data=file)

                    if response.ok:
                        res = {
                            "done": done,
                            "blob": f"sha256:{hashed}",
                            "name": file_name,
                        }
                        os.remove(file_path)

                        yield f"data: {json.dumps(res)}\n\n"
                    else:
                        raise "Ollama: Could not create blob, Please try again."


# url = "https://huggingface.co/TheBloke/stablelm-zephyr-3b-GGUF/resolve/main/stablelm-zephyr-3b.Q2_K.gguf"
@router.post("/models/download")
@router.post("/models/download/{url_idx}")
async def download_model(
    request: Request,
    form_data: UrlForm,
    url_idx: Optional[int] = None,
    user=Depends(get_admin_user),
):
    allowed_hosts = ["https://huggingface.co/", "https://github.com/"]

    if not any(form_data.url.startswith(host) for host in allowed_hosts):
        raise HTTPException(
            status_code=400,
            detail="Invalid file_url. Only URLs from allowed hosts are permitted.",
        )

    if url_idx is None:
        url_idx = 0
    url = request.app.state.config.OLLAMA_BASE_URLS[url_idx]

    file_name = parse_huggingface_url(form_data.url)

    if file_name:
        file_path = f"{UPLOAD_DIR}/{file_name}"

        return StreamingResponse(
            download_file_stream(url, form_data.url, file_path, file_name),
        )
    else:
        return None


@router.post("/models/upload")
@router.post("/models/upload/{url_idx}")
def upload_model(
    request: Request,
    file: UploadFile = File(...),
    url_idx: Optional[int] = None,
    user=Depends(get_admin_user),
):
    if url_idx is None:
        url_idx = 0
    ollama_url = request.app.state.config.OLLAMA_BASE_URLS[url_idx]

    file_path = f"{UPLOAD_DIR}/{file.filename}"

    # Save file in chunks
    with open(file_path, "wb+") as f:
        for chunk in file.file:
            f.write(chunk)

    def file_process_stream():
        nonlocal ollama_url
        total_size = os.path.getsize(file_path)
        chunk_size = 1024 * 1024
        try:
            with open(file_path, "rb") as f:
                total = 0
                done = False

                while not done:
                    chunk = f.read(chunk_size)
                    if not chunk:
                        done = True
                        continue

                    total += len(chunk)
                    progress = round((total / total_size) * 100, 2)

                    res = {
                        "progress": progress,
                        "total": total_size,
                        "completed": total,
                    }
                    yield f"data: {json.dumps(res)}\n\n"

                if done:
                    f.seek(0)
                    hashed = calculate_sha256(f)
                    f.seek(0)

                    url = f"{ollama_url}/api/blobs/sha256:{hashed}"
                    response = requests.post(url, data=f)

                    if response.ok:
                        res = {
                            "done": done,
                            "blob": f"sha256:{hashed}",
                            "name": file.filename,
                        }
                        os.remove(file_path)
                        yield f"data: {json.dumps(res)}\n\n"
                    else:
                        raise Exception(
                            "Ollama: Could not create blob, Please try again."
                        )

        except Exception as e:
            res = {"error": str(e)}
            yield f"data: {json.dumps(res)}\n\n"

    return StreamingResponse(file_process_stream(), media_type="text/event-stream")
