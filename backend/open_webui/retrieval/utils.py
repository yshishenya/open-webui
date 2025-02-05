import logging
import os
import uuid
from typing import Optional, Union

import asyncio
import requests

from huggingface_hub import snapshot_download
from langchain.retrievers import ContextualCompressionRetriever, EnsembleRetriever
from langchain_community.retrievers import BM25Retriever
from langchain_core.documents import Document


from open_webui.config import VECTOR_DB
from open_webui.retrieval.vector.connector import VECTOR_DB_CLIENT
from open_webui.utils.misc import get_last_user_message
from open_webui.models.users import UserModel

from open_webui.env import (
    SRC_LOG_LEVELS,
    OFFLINE_MODE,
    ENABLE_FORWARD_USER_INFO_HEADERS,
)

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS["RAG"])


from typing import Any

from langchain_core.callbacks import CallbackManagerForRetrieverRun
from langchain_core.retrievers import BaseRetriever


class VectorSearchRetriever(BaseRetriever):
    collection_name: Any
    embedding_function: Any
    top_k: int

    def _get_relevant_documents(
        self,
        query: str,
        *,
        run_manager: CallbackManagerForRetrieverRun,
    ) -> list[Document]:
        result = VECTOR_DB_CLIENT.search(
            collection_name=self.collection_name,
            vectors=[self.embedding_function(query)],
            limit=self.top_k,
        )

        ids = result.ids[0]
        metadatas = result.metadatas[0]
        documents = result.documents[0]

        results = []
        for idx in range(len(ids)):
            results.append(
                Document(
                    metadata=metadatas[idx],
                    page_content=documents[idx],
                )
            )
        return results


def query_doc(
    collection_name: str, query_embedding: list[float], k: int, user: UserModel = None
):
    """Query a document collection using an embedding vector.

    This function searches for documents in a specified collection based on
    the provided embedding vector. It retrieves a limited number of results
    as specified by the parameter `k`. If the search is successful, it logs
    the result IDs and their associated metadata.

    Args:
        collection_name (str): The name of the collection to search.
        query_embedding (list[float]): The embedding vector used for the search.
        k (int): The maximum number of results to return.
        user (UserModel?): An optional user model for context.

    Returns:
        SearchResult: The result of the search containing document IDs and metadata.

    Raises:
        Exception: If an error occurs during the search operation.
    """

    try:
        result = VECTOR_DB_CLIENT.search(
            collection_name=collection_name,
            vectors=[query_embedding],
            limit=k,
        )

        if result:
            log.info(f"query_doc:result {result.ids} {result.metadatas}")

        return result
    except Exception as e:
        print(e)
        raise e


def query_doc_with_hybrid_search(
    collection_name: str,
    query: str,
    embedding_function,
    k: int,
    reranking_function,
    r: float,
) -> dict:
    try:
        result = VECTOR_DB_CLIENT.get(collection_name=collection_name)

        bm25_retriever = BM25Retriever.from_texts(
            texts=result.documents[0],
            metadatas=result.metadatas[0],
        )
        bm25_retriever.k = k

        vector_search_retriever = VectorSearchRetriever(
            collection_name=collection_name,
            embedding_function=embedding_function,
            top_k=k,
        )

        ensemble_retriever = EnsembleRetriever(
            retrievers=[bm25_retriever, vector_search_retriever], weights=[0.5, 0.5]
        )
        compressor = RerankCompressor(
            embedding_function=embedding_function,
            top_n=k,
            reranking_function=reranking_function,
            r_score=r,
        )

        compression_retriever = ContextualCompressionRetriever(
            base_compressor=compressor, base_retriever=ensemble_retriever
        )

        result = compression_retriever.invoke(query)
        result = {
            "distances": [[d.metadata.get("score") for d in result]],
            "documents": [[d.page_content for d in result]],
            "metadatas": [[d.metadata for d in result]],
        }

        log.info(
            "query_doc_with_hybrid_search:result "
            + f'{result["metadatas"]} {result["distances"]}'
        )
        return result
    except Exception as e:
        raise e


def merge_and_sort_query_results(
    query_results: list[dict], k: int, reverse: bool = False
) -> list[dict]:
    # Initialize lists to store combined data
    combined_distances = []
    combined_documents = []
    combined_metadatas = []

    for data in query_results:
        combined_distances.extend(data["distances"][0])
        combined_documents.extend(data["documents"][0])
        combined_metadatas.extend(data["metadatas"][0])

    # Create a list of tuples (distance, document, metadata)
    combined = list(zip(combined_distances, combined_documents, combined_metadatas))

    # Sort the list based on distances
    combined.sort(key=lambda x: x[0], reverse=reverse)

    # We don't have anything :-(
    if not combined:
        sorted_distances = []
        sorted_documents = []
        sorted_metadatas = []
    else:
        # Unzip the sorted list
        sorted_distances, sorted_documents, sorted_metadatas = zip(*combined)

        # Slicing the lists to include only k elements
        sorted_distances = list(sorted_distances)[:k]
        sorted_documents = list(sorted_documents)[:k]
        sorted_metadatas = list(sorted_metadatas)[:k]

    # Create the output dictionary
    result = {
        "distances": [sorted_distances],
        "documents": [sorted_documents],
        "metadatas": [sorted_metadatas],
    }

    return result


def query_collection(
    collection_names: list[str],
    queries: list[str],
    embedding_function,
    k: int,
) -> dict:
    results = []
    for query in queries:
        query_embedding = embedding_function(query)
        for collection_name in collection_names:
            if collection_name:
                try:
                    result = query_doc(
                        collection_name=collection_name,
                        k=k,
                        query_embedding=query_embedding,
                    )
                    if result is not None:
                        results.append(result.model_dump())
                except Exception as e:
                    log.exception(f"Error when querying the collection: {e}")
            else:
                pass

    if VECTOR_DB == "chroma":
        # Chroma uses unconventional cosine similarity, so we don't need to reverse the results
        # https://docs.trychroma.com/docs/collections/configure#configuring-chroma-collections
        return merge_and_sort_query_results(results, k=k, reverse=False)
    else:
        return merge_and_sort_query_results(results, k=k, reverse=True)


def query_collection_with_hybrid_search(
    collection_names: list[str],
    queries: list[str],
    embedding_function,
    k: int,
    reranking_function,
    r: float,
) -> dict:
    results = []
    error = False
    for collection_name in collection_names:
        try:
            for query in queries:
                result = query_doc_with_hybrid_search(
                    collection_name=collection_name,
                    query=query,
                    embedding_function=embedding_function,
                    k=k,
                    reranking_function=reranking_function,
                    r=r,
                )
                results.append(result)
        except Exception as e:
            log.exception(
                "Error when querying the collection with " f"hybrid_search: {e}"
            )
            error = True

    if error:
        raise Exception(
            "Hybrid search failed for all collections. Using Non hybrid search as fallback."
        )

    if VECTOR_DB == "chroma":
        # Chroma uses unconventional cosine similarity, so we don't need to reverse the results
        # https://docs.trychroma.com/docs/collections/configure#configuring-chroma-collections
        return merge_and_sort_query_results(results, k=k, reverse=False)
    else:
        return merge_and_sort_query_results(results, k=k, reverse=True)


def get_embedding_function(
    embedding_engine,
    embedding_model,
    embedding_function,
    url,
    key,
    embedding_batch_size,
):
    """Get a function to generate embeddings based on the specified engine.

    This function returns a callable that generates embeddings for a given
    query using the specified embedding engine and model. If the embedding
    engine is not recognized, it raises a ValueError. The returned function
    can handle both single queries and lists of queries, processing them in
    batches if necessary.

    Args:
        embedding_engine (str): The name of the embedding engine to use.
        embedding_model (str): The model to use for generating embeddings.
        embedding_function (object): The function used to encode queries.
        url (str): The URL for the embedding service, if applicable.
        key (str): The API key for authentication, if required.
        embedding_batch_size (int): The number of queries to process in a single batch.

    Returns:
        function: A function that takes a query or a list of queries and returns
            their corresponding embeddings.

    Raises:
        ValueError: If the specified embedding engine is unknown.
    """

    if embedding_engine == "":
        return lambda query, user=None: embedding_function.encode(query).tolist()
    elif embedding_engine in ["ollama", "openai"]:
        func = lambda query, user=None: generate_embeddings(
            engine=embedding_engine,
            model=embedding_model,
            text=query,
            url=url,
            key=key,
            user=user,
        )

        def generate_multiple(query, user, func):
            """Generate embeddings for a query or a list of queries.

            This function checks if the provided query is a list. If it is, it
            processes the list in batches, generating embeddings for each batch
            using the provided function. If the query is not a list, it directly
            applies the function to the query. This is useful for handling multiple
            queries efficiently.

            Args:
                query (Union[str, list]): A single query string or a list of query strings.
                user (Any): The user context to be passed to the function.
                func (Callable): A function that generates embeddings for the given query or queries.

            Returns:
                list: A list of generated embeddings.
            """

            if isinstance(query, list):
                embeddings = []
                for i in range(0, len(query), embedding_batch_size):
                    embeddings.extend(
                        func(query[i : i + embedding_batch_size], user=user)
                    )
                return embeddings
            else:
                return func(query, user)

        return lambda query, user=None: generate_multiple(query, user, func)
    else:
        raise ValueError(f"Unknown embedding engine: {embedding_engine}")


def get_sources_from_files(
    files,
    queries,
    embedding_function,
    k,
    reranking_function,
    r,
    hybrid_search,
):
    log.debug(f"files: {files} {queries} {embedding_function} {reranking_function}")

    extracted_collections = []
    relevant_contexts = []

    for file in files:
        if file.get("context") == "full":
            context = {
                "documents": [[file.get("file").get("data", {}).get("content")]],
                "metadatas": [[{"file_id": file.get("id"), "name": file.get("name")}]],
            }
        else:
            context = None

            collection_names = []
            if file.get("type") == "collection":
                if file.get("legacy"):
                    collection_names = file.get("collection_names", [])
                else:
                    collection_names.append(file["id"])
            elif file.get("collection_name"):
                collection_names.append(file["collection_name"])
            elif file.get("id"):
                if file.get("legacy"):
                    collection_names.append(f"{file['id']}")
                else:
                    collection_names.append(f"file-{file['id']}")

            collection_names = set(collection_names).difference(extracted_collections)
            if not collection_names:
                log.debug(f"skipping {file} as it has already been extracted")
                continue

            try:
                context = None
                if file.get("type") == "text":
                    context = file["content"]
                else:
                    if hybrid_search:
                        try:
                            context = query_collection_with_hybrid_search(
                                collection_names=collection_names,
                                queries=queries,
                                embedding_function=embedding_function,
                                k=k,
                                reranking_function=reranking_function,
                                r=r,
                            )
                        except Exception as e:
                            log.debug(
                                "Error when using hybrid search, using"
                                " non hybrid search as fallback."
                            )

                    if (not hybrid_search) or (context is None):
                        context = query_collection(
                            collection_names=collection_names,
                            queries=queries,
                            embedding_function=embedding_function,
                            k=k,
                        )
            except Exception as e:
                log.exception(e)

            extracted_collections.extend(collection_names)

        if context:
            if "data" in file:
                del file["data"]
            relevant_contexts.append({**context, "file": file})

    sources = []
    for context in relevant_contexts:
        try:
            if "documents" in context:
                if "metadatas" in context:
                    source = {
                        "source": context["file"],
                        "document": context["documents"][0],
                        "metadata": context["metadatas"][0],
                    }
                    if "distances" in context and context["distances"]:
                        source["distances"] = context["distances"][0]

                    sources.append(source)
        except Exception as e:
            log.exception(e)

    return sources


def get_model_path(model: str, update_model: bool = False):
    # Construct huggingface_hub kwargs with local_files_only to return the snapshot path
    cache_dir = os.getenv("SENTENCE_TRANSFORMERS_HOME")

    local_files_only = not update_model

    if OFFLINE_MODE:
        local_files_only = True

    snapshot_kwargs = {
        "cache_dir": cache_dir,
        "local_files_only": local_files_only,
    }

    log.debug(f"model: {model}")
    log.debug(f"snapshot_kwargs: {snapshot_kwargs}")

    # Inspiration from upstream sentence_transformers
    if (
        os.path.exists(model)
        or ("\\" in model or model.count("/") > 1)
        and local_files_only
    ):
        # If fully qualified path exists, return input, else set repo_id
        return model
    elif "/" not in model:
        # Set valid repo_id for model short-name
        model = "sentence-transformers" + "/" + model

    snapshot_kwargs["repo_id"] = model

    # Attempt to query the huggingface_hub library to determine the local path and/or to update
    try:
        model_repo_path = snapshot_download(**snapshot_kwargs)
        log.debug(f"model_repo_path: {model_repo_path}")
        return model_repo_path
    except Exception as e:
        log.exception(f"Cannot determine model snapshot path: {e}")
        return model


def generate_openai_batch_embeddings(
    model: str,
    texts: list[str],
    url: str = "https://api.openai.com/v1",
    key: str = "",
    user: UserModel = None,
) -> Optional[list[list[float]]]:
    """Generate batch embeddings from OpenAI's API for a list of texts.

    This function sends a request to the OpenAI API to generate embeddings
    for the provided texts using the specified model. It constructs the
    request with necessary headers, including optional user information if
    available. The function handles the response and extracts the embeddings
    from the returned JSON data. If the request fails or if there is an
    issue with the response, it will print the exception and return None.

    Args:
        model (str): The name of the model to use for generating embeddings.
        texts (list[str]): A list of texts for which embeddings are to be generated.
        url (str?): The URL of the OpenAI API. Defaults to "https://api.openai.com/v1".
        key (str?): The API key for authentication. Defaults to an empty string.
        user (UserModel?): An optional user model containing user information.

    Returns:
        Optional[list[list[float]]]: A list of embeddings for the input texts, or None if an error occurs.

    Raises:
        Exception: If there is an error during the API request or response handling.
    """

    try:
        r = requests.post(
            f"{url}/embeddings",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {key}",
                **(
                    {
                        "X-OpenWebUI-User-Name": user.name,
                        "X-OpenWebUI-User-Id": user.id,
                        "X-OpenWebUI-User-Email": user.email,
                        "X-OpenWebUI-User-Role": user.role,
                    }
                    if ENABLE_FORWARD_USER_INFO_HEADERS and user
                    else {}
                ),
            },
            json={"input": texts, "model": model},
        )
        r.raise_for_status()
        data = r.json()
        if "data" in data:
            return [elem["embedding"] for elem in data["data"]]
        else:
            raise "Something went wrong :/"
    except Exception as e:
        print(e)
        return None


def generate_ollama_batch_embeddings(
    model: str, texts: list[str], url: str, key: str = "", user: UserModel = None
) -> Optional[list[list[float]]]:
    """Generate batch embeddings using the Ollama model.

    This function sends a request to the specified URL to generate
    embeddings for a list of texts using the specified model. It constructs
    the request with appropriate headers, including authorization and user
    information if provided. The function handles the response and returns
    the embeddings if successful. If the response does not contain
    embeddings or an error occurs during the request, it returns None.

    Args:
        model (str): The name of the model to use for generating embeddings.
        texts (list[str]): A list of texts for which embeddings are to be generated.
        url (str): The endpoint URL for the embedding API.
        key (str?): The authorization key for accessing the API. Defaults to an empty
            string.
        user (UserModel?): An optional user model containing user information. Defaults to None.

    Returns:
        Optional[list[list[float]]]: A list of embeddings for the input texts, or None if an error occurs.

    Raises:
        Exception: If there is an error during the API request or if the response does not
            contain embeddings.
    """

    try:
        r = requests.post(
            f"{url}/api/embed",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {key}",
                **(
                    {
                        "X-OpenWebUI-User-Name": user.name,
                        "X-OpenWebUI-User-Id": user.id,
                        "X-OpenWebUI-User-Email": user.email,
                        "X-OpenWebUI-User-Role": user.role,
                    }
                    if ENABLE_FORWARD_USER_INFO_HEADERS
                    else {}
                ),
            },
            json={"input": texts, "model": model},
        )
        r.raise_for_status()
        data = r.json()

        if "embeddings" in data:
            return data["embeddings"]
        else:
            raise "Something went wrong :/"
    except Exception as e:
        print(e)
        return None


def generate_embeddings(engine: str, model: str, text: Union[str, list[str]], **kwargs):
    """Generate embeddings for the given text using the specified engine.

    This function generates embeddings for a single string or a list of
    strings using either the "ollama" or "openai" engine. It retrieves the
    necessary parameters from the provided keyword arguments and calls the
    appropriate embedding generation function based on the selected engine.
    The function returns the embeddings in a format that corresponds to the
    input type.

    Args:
        engine (str): The name of the engine to use for generating embeddings.
            Supported values are "ollama" and "openai".
        model (str): The model to be used for generating embeddings.
        text (Union[str, list[str]]): A single string or a list of strings for
            which embeddings are to be generated.
        **kwargs: Additional keyword arguments that may include:
            - url (str): The URL for the embedding service.
            - key (str): The API key for authentication.
            - user: Optional user information.

    Returns:
        Union[list, str]: The generated embeddings as a list if input is a list,
            or as a single embedding if input is a string.
    """

    url = kwargs.get("url", "")
    key = kwargs.get("key", "")
    user = kwargs.get("user")

    if engine == "ollama":
        if isinstance(text, list):
            embeddings = generate_ollama_batch_embeddings(
                **{"model": model, "texts": text, "url": url, "key": key, "user": user}
            )
        else:
            embeddings = generate_ollama_batch_embeddings(
                **{
                    "model": model,
                    "texts": [text],
                    "url": url,
                    "key": key,
                    "user": user,
                }
            )
        return embeddings[0] if isinstance(text, str) else embeddings
    elif engine == "openai":
        if isinstance(text, list):
            embeddings = generate_openai_batch_embeddings(model, text, url, key, user)
        else:
            embeddings = generate_openai_batch_embeddings(model, [text], url, key, user)

        return embeddings[0] if isinstance(text, str) else embeddings


import operator
from typing import Optional, Sequence

from langchain_core.callbacks import Callbacks
from langchain_core.documents import BaseDocumentCompressor, Document


class RerankCompressor(BaseDocumentCompressor):
    embedding_function: Any
    top_n: int
    reranking_function: Any
    r_score: float

    class Config:
        extra = "forbid"
        arbitrary_types_allowed = True

    def compress_documents(
        self,
        documents: Sequence[Document],
        query: str,
        callbacks: Optional[Callbacks] = None,
    ) -> Sequence[Document]:
        reranking = self.reranking_function is not None

        if reranking:
            scores = self.reranking_function.predict(
                [(query, doc.page_content) for doc in documents]
            )
        else:
            from sentence_transformers import util

            query_embedding = self.embedding_function(query)
            document_embedding = self.embedding_function(
                [doc.page_content for doc in documents]
            )
            scores = util.cos_sim(query_embedding, document_embedding)[0]

        docs_with_scores = list(zip(documents, scores.tolist()))
        if self.r_score:
            docs_with_scores = [
                (d, s) for d, s in docs_with_scores if s >= self.r_score
            ]

        result = sorted(docs_with_scores, key=operator.itemgetter(1), reverse=True)
        final_results = []
        for doc, doc_score in result[: self.top_n]:
            metadata = doc.metadata
            metadata["score"] = doc_score
            doc = Document(
                page_content=doc.page_content,
                metadata=metadata,
            )
            final_results.append(doc)
        return final_results
