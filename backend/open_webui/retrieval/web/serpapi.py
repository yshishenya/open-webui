import logging
from typing import Optional
from urllib.parse import urlencode

import requests
from open_webui.retrieval.web.main import SearchResult, get_filtered_results
from open_webui.env import SRC_LOG_LEVELS

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS["RAG"])


def search_serpapi(
    api_key: str,
    engine: str,
    query: str,
    count: int,
    filter_list: Optional[list[str]] = None,
) -> list[SearchResult]:
    """Search using serpapi.com's API and return the results as a list of
    SearchResult objects.

    This function constructs a request to the serpapi.com search API using
    the provided API key, search engine, and query. It retrieves the search
    results, sorts them based on their position, and applies any specified
    filters before returning a limited number of results as SearchResult
    objects.

    Args:
        api_key (str): A serpapi.com API key.
        engine (str): The search engine to use (default is "google").
        query (str): The query to search for.
        count (int): The maximum number of results to return.
        filter_list (Optional[list[str]]): A list of filters to apply to the results (default is None).

    Returns:
        list[SearchResult]: A list of SearchResult objects containing the search results.
    """
    url = "https://serpapi.com/search"

    engine = engine or "google"

    payload = {"engine": engine, "q": query, "api_key": api_key}

    url = f"{url}?{urlencode(payload)}"
    response = requests.request("GET", url)

    json_response = response.json()
    log.info(f"results from serpapi search: {json_response}")

    results = sorted(
        json_response.get("organic_results", []), key=lambda x: x.get("position", 0)
    )
    if filter_list:
        results = get_filtered_results(results, filter_list)
    return [
        SearchResult(
            link=result["link"], title=result["title"], snippet=result["snippet"]
        )
        for result in results[:count]
    ]
