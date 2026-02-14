"""
ЮKassa (YooMoney) payment gateway integration
Documentation: https://yookassa.ru/developers/api
"""

import json
import asyncio
import logging
import uuid
import hashlib
import hmac
import functools
import ipaddress
from typing import Optional, Dict, Any
from decimal import Decimal

import aiohttp

from open_webui.env import SRC_LOG_LEVELS

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS.get("YOOKASSA", logging.INFO))

DEFAULT_TIMEOUT = aiohttp.ClientTimeout(total=15)
RETRYABLE_HTTP_STATUS_CODES = {408, 409, 425, 429, 500, 502, 503, 504}
MAX_RETRY_ATTEMPTS = 2
RETRY_BASE_DELAY_SECONDS = 0.25
RETRY_MAX_DELAY_SECONDS = 1.5


class YooKassaRequestError(Exception):
    """Error returned when a YooKassa API request fails."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        response_text: str = "",
        *,
        retryable: bool = False,
        error_code: Optional[str] = None,
        source: str = "provider",
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.response_text = response_text
        self.retryable = retryable
        self.error_code = error_code
        self.source = source


class YooKassaConfig:
    """YooKassa configuration"""

    def __init__(
        self,
        shop_id: str,
        secret_key: str,
        webhook_secret: Optional[str] = None,
        api_url: str = "https://api.yookassa.ru/v3",
    ):
        self.shop_id = shop_id
        self.secret_key = secret_key
        self.webhook_secret = webhook_secret
        self.api_url = api_url


class YooKassaClient:
    """YooKassa API client"""

    def __init__(self, config: YooKassaConfig):
        self.config = config
        self.auth = aiohttp.BasicAuth(config.shop_id, config.secret_key)

    @staticmethod
    def _extract_error_code(response_text: str) -> Optional[str]:
        if not response_text:
            return None
        try:
            payload = json.loads(response_text)
        except (TypeError, ValueError):
            return None
        if not isinstance(payload, dict):
            return None
        code = payload.get("code")
        return code if isinstance(code, str) and code else None

    @staticmethod
    def _retry_delay_seconds(attempt: int) -> float:
        return min(RETRY_MAX_DELAY_SECONDS, RETRY_BASE_DELAY_SECONDS * (2 ** (attempt - 1)))

    @staticmethod
    def _supports_retry(method: str, idempotence_key: Optional[str]) -> bool:
        method_upper = method.upper()
        if method_upper in {"GET", "HEAD", "OPTIONS"}:
            return True
        # For writes retry only when provider idempotency key is present.
        return method_upper == "POST" and bool(idempotence_key)

    async def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        idempotence_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Make API request to YooKassa"""
        url = f"{self.config.api_url}/{endpoint}"
        method_upper = method.upper()
        headers = {
            "Content-Type": "application/json",
        }

        # YooKassa requires idempotence key for POST requests
        if idempotence_key:
            headers["Idempotence-Key"] = idempotence_key

        supports_retry = self._supports_retry(method_upper, idempotence_key)
        max_attempts = 1 + MAX_RETRY_ATTEMPTS if supports_retry else 1

        for attempt in range(1, max_attempts + 1):
            try:
                log.debug(
                    "YooKassa %s %s (attempt %s/%s)",
                    method_upper,
                    url,
                    attempt,
                    max_attempts,
                )
                async with aiohttp.ClientSession(auth=self.auth) as session:
                    async with session.request(
                        method_upper,
                        url,
                        json=data,
                        headers=headers,
                        timeout=DEFAULT_TIMEOUT,
                    ) as response:
                        response_text = await response.text()
                        log.debug("YooKassa response: %s", response_text)

                        if response.status >= 400:
                            raise YooKassaRequestError(
                                f"YooKassa request failed with status {response.status}",
                                status_code=response.status,
                                response_text=response_text,
                                retryable=response.status in RETRYABLE_HTTP_STATUS_CODES,
                                error_code=self._extract_error_code(response_text),
                                source="provider",
                            )

                        if not response_text:
                            return {}
                        try:
                            return json.loads(response_text)
                        except json.JSONDecodeError as e:
                            raise YooKassaRequestError(
                                "YooKassa returned malformed JSON payload",
                                status_code=response.status,
                                response_text=response_text,
                                source="provider",
                            ) from e

            except asyncio.TimeoutError as e:
                request_error = YooKassaRequestError(
                    "YooKassa request timed out",
                    retryable=True,
                    response_text=str(e),
                    source="timeout",
                )
            except aiohttp.ClientError as e:
                request_error = YooKassaRequestError(
                    "YooKassa network request failed",
                    retryable=True,
                    response_text=str(e),
                    source="network",
                )
            except YooKassaRequestError as e:
                request_error = e
            except Exception as e:
                log.exception("Unexpected error in YooKassa request")
                raise YooKassaRequestError(
                    "Unexpected YooKassa request error",
                    response_text=str(e),
                    source="unexpected",
                ) from e

            if request_error.retryable and attempt < max_attempts:
                delay = self._retry_delay_seconds(attempt)
                log.warning(
                    "Retryable YooKassa error during %s %s (source=%s, status=%s, code=%s), retrying in %.2fs (%s/%s)",
                    method_upper,
                    endpoint,
                    request_error.source,
                    request_error.status_code,
                    request_error.error_code,
                    delay,
                    attempt,
                    max_attempts,
                )
                await asyncio.sleep(delay)
                continue

            log.error(
                "YooKassa request failed for %s %s (source=%s, status=%s, code=%s): %s",
                method_upper,
                endpoint,
                request_error.source,
                request_error.status_code,
                request_error.error_code,
                request_error.response_text,
            )
            raise request_error

        # Defensive fallback: loop should always return or raise.
        raise YooKassaRequestError(
            "YooKassa request failed after retry attempts",
            source="unexpected",
        )

    async def create_payment(
        self,
        amount: Decimal,
        currency: str = "RUB",
        description: str = "",
        return_url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        capture: bool = True,
        payment_method_id: Optional[str] = None,
        save_payment_method: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """
        Create a payment

        Args:
            amount: Payment amount
            currency: Currency code (RUB, USD, EUR)
            description: Payment description
            return_url: URL to redirect user after payment
            metadata: Additional metadata (user_id, plan_id, etc.)
            capture: Auto-capture payment (True) or manual (False)
            payment_method_id: Saved payment method ID for auto payments
            save_payment_method: Save payment method for future payments

        Returns:
            Payment object with confirmation URL
        """
        idempotence_key = str(uuid.uuid4())

        payment_data = {
            "amount": {
                "value": str(amount),
                "currency": currency,
            },
            "capture": capture,
            "description": description,
        }

        if return_url:
            payment_data["confirmation"] = {
                "type": "redirect",
                "return_url": return_url,
            }

        if metadata:
            payment_data["metadata"] = metadata
        if payment_method_id:
            payment_data["payment_method_id"] = payment_method_id
        if save_payment_method is not None:
            payment_data["save_payment_method"] = save_payment_method

        response = await self._request(
            "POST",
            "payments",
            data=payment_data,
            idempotence_key=idempotence_key,
        )

        log.info(f"Created payment {response.get('id')} for {amount} {currency}")
        return response

    async def get_payment(self, payment_id: str) -> Dict[str, Any]:
        """
        Get payment information

        Args:
            payment_id: Payment ID

        Returns:
            Payment object
        """
        response = await self._request("GET", f"payments/{payment_id}")
        return response

    async def capture_payment(
        self,
        payment_id: str,
        amount: Optional[Decimal] = None,
    ) -> Dict[str, Any]:
        """
        Capture payment (confirm payment that was created with capture=False)

        Args:
            payment_id: Payment ID
            amount: Amount to capture (if less than authorized amount)

        Returns:
            Updated payment object
        """
        idempotence_key = str(uuid.uuid4())

        capture_data = {}
        if amount:
            capture_data["amount"] = {
                "value": str(amount),
                "currency": "RUB",
            }

        response = await self._request(
            "POST",
            f"payments/{payment_id}/capture",
            data=capture_data,
            idempotence_key=idempotence_key,
        )

        log.info(f"Captured payment {payment_id}")
        return response

    async def cancel_payment(self, payment_id: str) -> Dict[str, Any]:
        """
        Cancel payment

        Args:
            payment_id: Payment ID

        Returns:
            Updated payment object
        """
        idempotence_key = str(uuid.uuid4())

        response = await self._request(
            "POST",
            f"payments/{payment_id}/cancel",
            idempotence_key=idempotence_key,
        )

        log.info(f"Canceled payment {payment_id}")
        return response

    async def create_refund(
        self,
        payment_id: str,
        amount: Decimal,
        currency: str = "RUB",
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create refund

        Args:
            payment_id: Payment ID to refund
            amount: Refund amount
            currency: Currency code
            description: Refund description

        Returns:
            Refund object
        """
        idempotence_key = str(uuid.uuid4())

        refund_data = {
            "payment_id": payment_id,
            "amount": {
                "value": str(amount),
                "currency": currency,
            },
        }

        if description:
            refund_data["description"] = description

        response = await self._request(
            "POST",
            "refunds",
            data=refund_data,
            idempotence_key=idempotence_key,
        )

        log.info(f"Created refund for payment {payment_id}: {amount} {currency}")
        return response

    async def get_refund(self, refund_id: str) -> Dict[str, Any]:
        """
        Get refund information

        Args:
            refund_id: Refund ID

        Returns:
            Refund object
        """
        response = await self._request("GET", f"refunds/{refund_id}")
        return response

    def verify_webhook(
        self,
        webhook_body: str,
        signature: str,
    ) -> bool:
        """
        Verify a webhook signature (best-effort / custom).

        YooKassa incoming notifications docs recommend verifying authenticity by:
        - Fetching the payment/refund via YooKassa API and validating status/amount.
        - Verifying the source IP belongs to YooKassa documented ranges.

        As of 2026-02-03, the docs do not describe an official request signature header/format.
        This method is kept for backward compatibility in case the caller provides a signature
        via a custom reverse-proxy setup.

        Args:
            webhook_body: Raw webhook body (JSON string)
            signature: Signature from HTTP header

        Returns:
            True if signature is valid
        """
        if not self.config.webhook_secret:
            log.warning("Webhook secret not configured, skipping verification")
            return True

        # Custom HMAC-SHA256 hex over raw body.
        expected_signature = hmac.new(
            self.config.webhook_secret.encode("utf-8"),
            webhook_body.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        is_valid = hmac.compare_digest(signature, expected_signature)

        if not is_valid:
            log.warning("Invalid webhook signature")

        return is_valid


_DEFAULT_YOOKASSA_WEBHOOK_ALLOWED_IP_RANGES: tuple[str, ...] = (
    "185.71.76.0/27",
    "185.71.77.0/27",
    "77.75.153.0/25",
    "77.75.154.128/25",
    "77.75.156.11",
    "77.75.156.35",
    "2a02:5180:0:1509::/64",
    "2a02:5180:0:2655::/64",
    "2a02:5180:0:1533::/64",
)


@functools.lru_cache(maxsize=16)
def _parse_ip_allowlist(extra_ranges_csv: str) -> tuple[
    ipaddress.IPv4Network | ipaddress.IPv6Network, ...
]:
    ranges: list[str] = list(_DEFAULT_YOOKASSA_WEBHOOK_ALLOWED_IP_RANGES)
    for raw in extra_ranges_csv.split(","):
        token = raw.strip()
        if token:
            ranges.append(token)

    networks: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = []
    for token in ranges:
        try:
            if "/" in token:
                network = ipaddress.ip_network(token, strict=False)
                networks.append(network)
                continue

            address = ipaddress.ip_address(token)
            networks.append(
                ipaddress.ip_network(f"{address}/{address.max_prefixlen}", strict=False)
            )
        except ValueError:
            log.warning("Invalid YooKassa webhook allowlist entry: %s", token)

    return tuple(networks)


def is_yookassa_webhook_source_ip(client_ip: str, extra_ranges_csv: str = "") -> bool:
    """Return True when the source IP matches YooKassa allowlist.

    Args:
        client_ip: Remote client IP (IPv4/IPv6 string).
        extra_ranges_csv: Additional CIDRs/IPs (comma-separated) to allow.

    Returns:
        True when `client_ip` belongs to YooKassa documented ranges (plus extras).
    """
    try:
        address = ipaddress.ip_address(client_ip)
    except ValueError:
        return False

    for network in _parse_ip_allowlist(extra_ranges_csv):
        if address in network:
            return True

    return False


class YooKassaWebhookHandler:
    """Handle YooKassa webhooks"""

    @staticmethod
    def parse_webhook(webhook_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse webhook data from YooKassa

        Webhook types:
        - payment.succeeded - Payment successfully completed
        - payment.waiting_for_capture - Payment authorized, waiting for capture
        - payment.canceled - Payment canceled
        - refund.succeeded - Refund completed

        Args:
            webhook_data: Parsed webhook JSON

        Returns:
            Normalized webhook data
        """
        event_type = webhook_data.get("event")
        if not isinstance(event_type, str) or not event_type:
            raise ValueError("Missing webhook event type")
        payment_object = webhook_data.get("object", {})

        result = {
            "event_type": event_type,
            "payment_id": payment_object.get("id"),
            "status": payment_object.get("status"),
            "amount": payment_object.get("amount", {}).get("value"),
            "currency": payment_object.get("amount", {}).get("currency"),
            "metadata": payment_object.get("metadata", {}),
            "created_at": payment_object.get("created_at"),
            "captured_at": payment_object.get("captured_at"),
            "paid": payment_object.get("paid", False),
            "test": payment_object.get("test", False),
        }

        # For refund events
        if event_type.startswith("refund."):
            result["payment_id"] = payment_object.get("payment_id")
            result["refund_id"] = payment_object.get("id")

        return result


# Global YooKassa client instance (initialized in config)
_yookassa_client: Optional[YooKassaClient] = None


def init_yookassa(config: YooKassaConfig) -> YooKassaClient:
    """Initialize global YooKassa client"""
    global _yookassa_client
    _yookassa_client = YooKassaClient(config)
    log.info("YooKassa client initialized")
    return _yookassa_client


def get_yookassa_client() -> Optional[YooKassaClient]:
    """Get global YooKassa client instance"""
    return _yookassa_client
