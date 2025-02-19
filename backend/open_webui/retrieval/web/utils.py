import socket
import aiohttp
import asyncio
import urllib.parse
import validators
from typing import Any, AsyncIterator, Dict, Iterator, List, Sequence, Union


from langchain_community.document_loaders import (
    WebBaseLoader,
)
from langchain_core.documents import Document


from open_webui.constants import ERROR_MESSAGES
from open_webui.config import ENABLE_RAG_LOCAL_WEB_FETCH
from open_webui.env import SRC_LOG_LEVELS

import logging

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS["RAG"])


def validate_url(url: Union[str, Sequence[str]]):
    if isinstance(url, str):
        if isinstance(validators.url(url), validators.ValidationError):
            raise ValueError(ERROR_MESSAGES.INVALID_URL)
        if not ENABLE_RAG_LOCAL_WEB_FETCH:
            # Local web fetch is disabled, filter out any URLs that resolve to private IP addresses
            parsed_url = urllib.parse.urlparse(url)
            # Get IPv4 and IPv6 addresses
            ipv4_addresses, ipv6_addresses = resolve_hostname(parsed_url.hostname)
            # Check if any of the resolved addresses are private
            # This is technically still vulnerable to DNS rebinding attacks, as we don't control WebBaseLoader
            for ip in ipv4_addresses:
                if validators.ipv4(ip, private=True):
                    raise ValueError(ERROR_MESSAGES.INVALID_URL)
            for ip in ipv6_addresses:
                if validators.ipv6(ip, private=True):
                    raise ValueError(ERROR_MESSAGES.INVALID_URL)
        return True
    elif isinstance(url, Sequence):
        return all(validate_url(u) for u in url)
    else:
        return False


def safe_validate_urls(url: Sequence[str]) -> Sequence[str]:
    valid_urls = []
    for u in url:
        try:
            if validate_url(u):
                valid_urls.append(u)
        except ValueError:
            continue
    return valid_urls


def resolve_hostname(hostname):
    # Get address information
    addr_info = socket.getaddrinfo(hostname, None)

    # Extract IP addresses from address information
    ipv4_addresses = [info[4][0] for info in addr_info if info[0] == socket.AF_INET]
    ipv6_addresses = [info[4][0] for info in addr_info if info[0] == socket.AF_INET6]

    return ipv4_addresses, ipv6_addresses


class SafeWebBaseLoader(WebBaseLoader):
    """WebBaseLoader with enhanced error handling for URLs."""

    def __init__(self, trust_env: bool = False, *args, **kwargs):
        """Initialize SafeWebBaseLoader
        Args:
            trust_env (bool, optional): set to True if using proxy to make web requests, for example
                using http(s)_proxy environment variables. Defaults to False.
        """
        super().__init__(*args, **kwargs)
        self.trust_env = trust_env

    async def _fetch(
        self, url: str, retries: int = 3, cooldown: int = 2, backoff: float = 1.5
    ) -> str:
        """Fetch the content from a specified URL with retries.

        This function attempts to retrieve the content from the given URL using
        an asynchronous HTTP GET request. It allows for a specified number of
        retries in case of connection errors, with an exponential backoff
        strategy for the wait time between attempts. The function also handles
        SSL verification based on the session settings.

        Args:
            url (str): The URL to fetch the content from.
            retries (int?): The number of retry attempts in case of failure. Defaults to 3.
            cooldown (int?): The base wait time (in seconds) before retrying. Defaults to 2.
            backoff (float?): The multiplier for the exponential backoff. Defaults to 1.5.

        Returns:
            str: The content of the response from the URL.

        Raises:
            aiohttp.ClientConnectionError: If there is a connection error during the fetch attempts.
            ValueError: If the maximum number of retry attempts is exceeded without a successful
                fetch.
        """

        async with aiohttp.ClientSession(trust_env=self.trust_env) as session:
            for i in range(retries):
                try:
                    kwargs: Dict = dict(
                        headers=self.session.headers,
                        cookies=self.session.cookies.get_dict(),
                    )
                    if not self.session.verify:
                        kwargs["ssl"] = False

                    async with session.get(
                        url, **(self.requests_kwargs | kwargs)
                    ) as response:
                        if self.raise_for_status:
                            response.raise_for_status()
                        return await response.text()
                except aiohttp.ClientConnectionError as e:
                    if i == retries - 1:
                        raise
                    else:
                        log.warning(
                            f"Error fetching {url} with attempt "
                            f"{i + 1}/{retries}: {e}. Retrying..."
                        )
                        await asyncio.sleep(cooldown * backoff**i)
        raise ValueError("retry count exceeded")

    def _unpack_fetch_results(
        self, results: Any, urls: List[str], parser: Union[str, None] = None
    ) -> List[Any]:
        """Unpack fetch results into BeautifulSoup objects.

        This function takes a list of fetched results and their corresponding
        URLs, then converts each result into a BeautifulSoup object using the
        specified parser. If no parser is provided, it determines the parser
        based on the URL's file extension (using "xml" for URLs ending with
        .xml) or defaults to a predefined parser. The function also checks if
        the parser is valid before proceeding.

        Args:
            results (Any): A list of fetched results to be unpacked.
            urls (List[str]): A list of URLs corresponding to the fetched results.
            parser (Union[str, None]?): The parser to use for BeautifulSoup.
                If None, the parser is determined based on the URL.

        Returns:
            List[Any]: A list of BeautifulSoup objects created from the fetched results.
        """
        from bs4 import BeautifulSoup

        final_results = []
        for i, result in enumerate(results):
            url = urls[i]
            if parser is None:
                if url.endswith(".xml"):
                    parser = "xml"
                else:
                    parser = self.default_parser
                self._check_parser(parser)
            final_results.append(BeautifulSoup(result, parser, **self.bs_kwargs))
        return final_results

    async def ascrape_all(
        self, urls: List[str], parser: Union[str, None] = None
    ) -> List[Any]:
        """Asynchronously fetch all URLs and return the parsed results.

        This function takes a list of URLs, fetches their content
        asynchronously, and then unpacks the results into a list of parsed
        objects. The optional parser argument allows for specifying a parsing
        method to be applied to the fetched content.

        Args:
            urls (List[str]): A list of URLs to fetch.
            parser (Union[str, None]?): An optional parser to use for
                processing the fetched content. Defaults to None.

        Returns:
            List[Any]: A list of parsed results corresponding to the fetched URLs.
        """
        results = await self.fetch_all(urls)
        return self._unpack_fetch_results(results, urls, parser=parser)

    def lazy_load(self) -> Iterator[Document]:
        """Lazy load text from the url(s) in web_path with error handling."""
        for path in self.web_paths:
            try:
                soup = self._scrape(path, bs_kwargs=self.bs_kwargs)
                text = soup.get_text(**self.bs_get_text_kwargs)

                # Build metadata
                metadata = {"source": path}
                if title := soup.find("title"):
                    metadata["title"] = title.get_text()
                if description := soup.find("meta", attrs={"name": "description"}):
                    metadata["description"] = description.get(
                        "content", "No description found."
                    )
                if html := soup.find("html"):
                    metadata["language"] = html.get("lang", "No language found.")

                yield Document(page_content=text, metadata=metadata)
            except Exception as e:
                # Log the error and continue with the next URL
                log.error(f"Error loading {path}: {e}")

    async def alazy_load(self) -> AsyncIterator[Document]:
        """Asynchronously lazy load text from the specified URLs.

        This function retrieves and processes the content from a list of web
        paths. It scrapes the HTML content, extracts the text, and gathers
        relevant metadata such as the title, description, and language of the
        page. The results are yielded as Document objects, which contain both
        the page content and its associated metadata.

        Yields:
            Document: An object containing the scraped text and its metadata for each web
                path.
        """
        results = await self.ascrape_all(self.web_paths)
        for path, soup in zip(self.web_paths, results):
            text = soup.get_text(**self.bs_get_text_kwargs)
            metadata = {"source": path}
            if title := soup.find("title"):
                metadata["title"] = title.get_text()
            if description := soup.find("meta", attrs={"name": "description"}):
                metadata["description"] = description.get(
                    "content", "No description found."
                )
            if html := soup.find("html"):
                metadata["language"] = html.get("lang", "No language found.")
            yield Document(page_content=text, metadata=metadata)

    async def aload(self) -> list[Document]:
        """Load data into Document objects.

        This method asynchronously loads data and returns a list of Document
        objects. It utilizes an asynchronous generator to fetch the documents,
        ensuring that the loading process is efficient and non-blocking.

        Returns:
            list[Document]: A list of loaded Document objects.
        """
        return [document async for document in self.alazy_load()]


def get_web_loader(
    urls: Union[str, Sequence[str]],
    verify_ssl: bool = True,
    requests_per_second: int = 2,
    trust_env: bool = False,
):
    """Create a web loader for the specified URLs.

    This function validates the provided URLs and initializes a
    SafeWebBaseLoader instance with the specified parameters. It ensures
    that the URLs are safe for loading and configures options such as SSL
    verification, request rate, and environment trust settings.

    Args:
        urls (Union[str, Sequence[str]]): A single URL as a string or
            a sequence of URLs to be loaded.
        verify_ssl (bool?): Whether to verify SSL certificates.
            Defaults to True.
        requests_per_second (int?): The number of requests to
            be made per second. Defaults to 2.
        trust_env (bool?): Whether to trust the environment
            settings for proxies and certificates. Defaults to False.

    Returns:
        SafeWebBaseLoader: An instance of SafeWebBaseLoader configured
        with the validated URLs and specified parameters.
    """

    # Check if the URLs are valid
    safe_urls = safe_validate_urls([urls] if isinstance(urls, str) else urls)

    return SafeWebBaseLoader(
        web_path=safe_urls,
        verify_ssl=verify_ssl,
        requests_per_second=requests_per_second,
        continue_on_failure=True,
        trust_env=trust_env,
    )
