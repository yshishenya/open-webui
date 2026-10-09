from abc import ABC, abstractmethod
from typing import Any, Dict, List, Union

from pydantic import BaseModel


class VectorItem(BaseModel):
    id: str
    text: str
    vector: List[float | int]
    metadata: Any


class GetResult(BaseModel):
    ids: List[List[str]] | None
    documents: List[List[str]] | None
    metadatas: List[List[Any]] | None


class SearchResult(GetResult):
    distances: List[List[float | int]] | None


class VectorDBBase(ABC):
    """
    Abstract base class for all vector database backends.

    Implementations of this class provide methods for collection management,
    vector insertion, deletion, similarity search, and metadata filtering.

    Any custom vector database integration must inherit from this class and
    implement all abstract methods.
    """

    @abstractmethod
    def has_collection(self, collection_name: str) -> bool:
        """Check if the collection exists in the vector DB."""
        pass

    @abstractmethod
    def delete_collection(self, collection_name: str) -> None:
        """Delete a collection from the vector DB."""
        pass

    @abstractmethod
    def insert(self, collection_name: str, items: List[VectorItem]) -> None:
        """Insert a list of vector items into a collection."""
        pass

    @abstractmethod
    def upsert(self, collection_name: str, items: List[VectorItem]) -> None:
        """Insert or update vector items in a collection."""
        pass

    @abstractmethod
    def search(
        self,
        collection_name: str,
        vectors: List[List[Union[float, int]]],
        filter: Dict | None = None,
        limit: int = 10,
    ) -> SearchResult | None:
        """Search for similar vectors in a collection."""
        pass

    def hybrid_search(
        self,
        collection_name: str,
        query: str,
        vectors: List[List[Union[float, int]]],
        filter: Dict | None = None,
        limit: int = 10,
        hybrid_bm25_weight: float = 0.5,
    ) -> SearchResult | None:
        """Search using a backend-native hybrid keyword/vector implementation when available."""
        return None

    @abstractmethod
    def query(self, collection_name: str, filter: Dict, limit: int | None = None) -> GetResult | None:
        """Query vectors from a collection using metadata filter."""
        pass

    @abstractmethod
    def get(self, collection_name: str) -> GetResult | None:
        """Retrieve all vectors from a collection."""
        pass

    @abstractmethod
    def delete(
        self,
        collection_name: str,
        ids: List[str] | None = None,
        filter: Dict | None = None,
    ) -> None:
        """Delete vectors by ID or filter from a collection."""
        pass

    @abstractmethod
    def reset(self) -> None:
        """Reset the vector database by removing all collections or those matching a condition."""
        pass
