from __future__ import annotations

import asyncio
import json
import os
from typing import BinaryIO

import requests


def _persist_upload_file(
    source_file: BinaryIO,
    destination_path: str,
    chunk_size: int,
) -> None:
    with open(destination_path, "wb") as destination_file:
        while True:
            chunk = source_file.read(chunk_size)
            if not chunk:
                break
            destination_file.write(chunk)


async def persist_upload_file(
    source_file: BinaryIO,
    destination_path: str,
    chunk_size: int,
) -> None:
    await asyncio.to_thread(
        _persist_upload_file,
        source_file,
        destination_path,
        chunk_size,
    )


def _upload_blob(
    ollama_url: str,
    file_path: str,
    file_hash: str,
) -> requests.Response:
    with open(file_path, "rb") as model_file:
        return requests.post(
            f"{ollama_url}/api/blobs/sha256:{file_hash}",
            data=model_file,
        )


async def upload_blob(
    ollama_url: str,
    file_path: str,
    file_hash: str,
) -> requests.Response:
    return await asyncio.to_thread(_upload_blob, ollama_url, file_path, file_hash)


def _create_model(
    ollama_url: str,
    filename: str,
    file_hash: str,
) -> tuple[str, requests.Response]:
    model_name, _ = os.path.splitext(filename)
    payload = {
        "model": model_name,
        "files": {filename: f"sha256:{file_hash}"},
    }
    response = requests.post(
        url=f"{ollama_url}/api/create",
        headers={"Content-Type": "application/json"},
        data=json.dumps(payload),
    )
    return model_name, response


async def create_model(
    ollama_url: str,
    filename: str,
    file_hash: str,
) -> tuple[str, requests.Response]:
    return await asyncio.to_thread(_create_model, ollama_url, filename, file_hash)
