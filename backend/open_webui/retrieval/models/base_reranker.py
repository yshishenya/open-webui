from abc import ABC, abstractmethod
from typing import List, Tuple


class BaseReranker(ABC):
    @abstractmethod
    def predict(self, sentences: List[Tuple[str, str]]) -> List[float] | None:
        pass
