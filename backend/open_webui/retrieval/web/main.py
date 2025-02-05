import validators

from typing import Optional
from urllib.parse import urlparse

from pydantic import BaseModel


def get_filtered_results(results, filter_list):
    """Get filtered results based on a list of domains.

    This function filters a list of results by checking if the domain of
    each result's URL matches any of the domains specified in the filter
    list. If the filter list is empty, the function returns the original
    results. The function uses the `validators` library to validate URLs and
    the `urlparse` module to extract the domain from each URL.

    Args:
        results (list): A list of dictionaries containing result data, where each dictionary
            should have a "url" or "link" key.
        filter_list (list): A list of domain strings to filter the results by.

    Returns:
        list: A list of filtered results that match the specified domains.
    """

    if not filter_list:
        return results
    filtered_results = []
    for result in results:
        url = result.get("url") or result.get("link", "")
        if not validators.url(url):
            continue
        domain = urlparse(url).netloc
        if any(domain.endswith(filtered_domain) for filtered_domain in filter_list):
            filtered_results.append(result)
    return filtered_results


class SearchResult(BaseModel):
    link: str
    title: Optional[str]
    snippet: Optional[str]
