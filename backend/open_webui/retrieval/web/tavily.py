import logging
from typing import Optional

import requests
from open_webui.retrieval.web.main import SearchResult
from open_webui.env import SRC_LOG_LEVELS

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS["RAG"])


def search_tavily(
    api_key: str,
    query: str,
    count: int,
    filter_list: Optional[list[str]] = None,
    # **kwargs,
) -> list[SearchResult]:
    """Search using Tavily's Search API and return the results as a list of
    SearchResult objects.

    This function sends a search request to Tavily's Search API using the
    provided API key and query. It processes the response to extract
    relevant search results and returns them as a list of SearchResult
    objects. The number of results returned can be controlled by the `count`
    parameter. Optionally, a filter list can be provided to refine the
    search results.

    Args:
        api_key (str): A Tavily Search API key.
        query (str): The query to search for.
        count (int): The number of search results to return.
        filter_list (Optional[list[str]]): A list of filters to apply to the search results (default is None).

    Returns:
        list[SearchResult]: A list of search results as SearchResult objects.
    """
    url = "https://api.tavily.com/search"
    data = {"query": query, "api_key": api_key}
    response = requests.post(url, json=data)
    response.raise_for_status()

    json_response = response.json()

    raw_search_results = json_response.get("results", [])

    return [
        SearchResult(
            link=result["url"],
            title=result.get("title", ""),
            snippet=result.get("content"),
        )
        for result in raw_search_results[:count]
    ]
