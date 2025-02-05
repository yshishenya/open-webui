from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
import logging
from typing import Optional

from open_webui.models.memories import Memories, MemoryModel
from open_webui.retrieval.vector.connector import VECTOR_DB_CLIENT
from open_webui.utils.auth import get_verified_user
from open_webui.env import SRC_LOG_LEVELS


log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS["MODELS"])

router = APIRouter()


@router.get("/ef")
async def get_embeddings(request: Request):
    return {"result": request.app.state.EMBEDDING_FUNCTION("hello world")}


############################
# GetMemories
############################


@router.get("/", response_model=list[MemoryModel])
async def get_memories(user=Depends(get_verified_user)):
    return Memories.get_memories_by_user_id(user.id)


############################
# AddMemory
############################


class AddMemoryForm(BaseModel):
    content: str


class MemoryUpdateModel(BaseModel):
    content: Optional[str] = None


@router.post("/add", response_model=Optional[MemoryModel])
async def add_memory(
    request: Request,
    form_data: AddMemoryForm,
    user=Depends(get_verified_user),
):
    """Add a new memory for the verified user.

    This function inserts a new memory into the database using the provided
    form data and associates it with the verified user. It also updates the
    vector database with the new memory's content and metadata, including
    the creation timestamp. The embedding function is used to generate a
    vector representation of the memory content.

    Args:
        request (Request): The HTTP request object containing application state.
        form_data (AddMemoryForm): The form data containing the content of the memory.
        user (User): The verified user for whom the memory is being added.

    Returns:
        Memory: The newly created memory object.
    """

    memory = Memories.insert_new_memory(user.id, form_data.content)

    VECTOR_DB_CLIENT.upsert(
        collection_name=f"user-memory-{user.id}",
        items=[
            {
                "id": memory.id,
                "text": memory.content,
                "vector": request.app.state.EMBEDDING_FUNCTION(memory.content, user),
                "metadata": {"created_at": memory.created_at},
            }
        ],
    )

    return memory


############################
# QueryMemory
############################


class QueryMemoryForm(BaseModel):
    content: str
    k: Optional[int] = 1


@router.post("/query")
async def query_memory(
    request: Request, form_data: QueryMemoryForm, user=Depends(get_verified_user)
):
    """Query the memory database for relevant results based on user input.

    This function takes a request and form data to perform a search in the
    memory database. It utilizes a vector database client to find relevant
    entries based on the user's input content, which is transformed into a
    vector using an embedding function. The results are limited to the
    specified number of entries defined in the form data.

    Args:
        request (Request): The HTTP request object containing the context for the query.
        form_data (QueryMemoryForm): The form data containing the user's query and parameters.
        user (User): The verified user making the request, defaults to the result of
            `get_verified_user`.

    Returns:
        list: A list of search results from the memory database.
    """

    results = VECTOR_DB_CLIENT.search(
        collection_name=f"user-memory-{user.id}",
        vectors=[request.app.state.EMBEDDING_FUNCTION(form_data.content, user)],
        limit=form_data.k,
    )

    return results


############################
# ResetMemoryFromVectorDB
############################
@router.post("/reset", response_model=bool)
async def reset_memory_from_vector_db(
    request: Request, user=Depends(get_verified_user)
):
    """Reset the user's memory in the vector database.

    This function deletes the existing memory collection for a user and
    retrieves the user's memories from the database. It then upserts the
    memories into a new collection in the vector database, transforming each
    memory into a vector representation using an embedding function. The
    function ensures that the user's memory is accurately reflected in the
    vector database.

    Args:
        request (Request): The request object containing application state.
        user: The verified user whose memory is being reset.

    Returns:
        bool: Returns True if the operation was successful.
    """

    VECTOR_DB_CLIENT.delete_collection(f"user-memory-{user.id}")

    memories = Memories.get_memories_by_user_id(user.id)
    VECTOR_DB_CLIENT.upsert(
        collection_name=f"user-memory-{user.id}",
        items=[
            {
                "id": memory.id,
                "text": memory.content,
                "vector": request.app.state.EMBEDDING_FUNCTION(memory.content, user),
                "metadata": {
                    "created_at": memory.created_at,
                    "updated_at": memory.updated_at,
                },
            }
            for memory in memories
        ],
    )

    return True


############################
# DeleteMemoriesByUserId
############################


@router.delete("/delete/user", response_model=bool)
async def delete_memory_by_user_id(user=Depends(get_verified_user)):
    result = Memories.delete_memories_by_user_id(user.id)

    if result:
        try:
            VECTOR_DB_CLIENT.delete_collection(f"user-memory-{user.id}")
        except Exception as e:
            log.error(e)
        return True

    return False


############################
# UpdateMemoryById
############################


@router.post("/{memory_id}/update", response_model=Optional[MemoryModel])
async def update_memory_by_id(
    memory_id: str,
    request: Request,
    form_data: MemoryUpdateModel,
    user=Depends(get_verified_user),
):
    """Update a memory entry by its ID.

    This function updates a memory entry identified by the provided memory
    ID. It retrieves the existing memory, updates its content if provided,
    and then upserts the updated memory into a vector database for further
    processing. If the memory entry is not found, an HTTP exception is
    raised.

    Args:
        memory_id (str): The unique identifier of the memory to be updated.
        request (Request): The request object containing application state.
        form_data (MemoryUpdateModel): The data model containing the new
            content for the memory.
        user: The verified user making the request.

    Returns:
        Memory: The updated memory object.

    Raises:
        HTTPException: If the memory with the specified ID is not found.
    """

    memory = Memories.update_memory_by_id(memory_id, form_data.content)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")

    if form_data.content is not None:
        VECTOR_DB_CLIENT.upsert(
            collection_name=f"user-memory-{user.id}",
            items=[
                {
                    "id": memory.id,
                    "text": memory.content,
                    "vector": request.app.state.EMBEDDING_FUNCTION(
                        memory.content, user
                    ),
                    "metadata": {
                        "created_at": memory.created_at,
                        "updated_at": memory.updated_at,
                    },
                }
            ],
        )

    return memory


############################
# DeleteMemoryById
############################


@router.delete("/{memory_id}", response_model=bool)
async def delete_memory_by_id(memory_id: str, user=Depends(get_verified_user)):
    result = Memories.delete_memory_by_id_and_user_id(memory_id, user.id)

    if result:
        VECTOR_DB_CLIENT.delete(
            collection_name=f"user-memory-{user.id}", ids=[memory_id]
        )
        return True

    return False
