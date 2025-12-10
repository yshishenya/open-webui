"""
ЮKassa (YooMoney) payment gateway integration
Documentation: https://yookassa.ru/developers/api
"""

import json
import logging
import uuid
import hashlib
import hmac
from typing import Optional, Dict, Any
from decimal import Decimal

import aiohttp

from open_webui.env import SRC_LOG_LEVELS

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS.get("YOOKASSA", logging.INFO))


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

    async def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        idempotence_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Make API request to YooKassa"""
        url = f"{self.config.api_url}/{endpoint}"
        headers = {
            "Content-Type": "application/json",
        }

        # YooKassa requires idempotence key for POST requests
        if idempotence_key:
            headers["Idempotence-Key"] = idempotence_key

        try:
            log.debug(f"YooKassa {method} {url}")
            async with aiohttp.ClientSession(auth=self.auth) as session:
                async with session.request(
                    method, url, json=data, headers=headers
                ) as response:
                    response_text = await response.text()
                    log.debug(f"YooKassa response: {response_text}")

                    if response.status >= 400:
                        log.error(
                            f"YooKassa error {response.status}: {response_text}"
                        )
                        response.raise_for_status()

                    return json.loads(response_text) if response_text else {}

        except aiohttp.ClientError as e:
            log.exception(f"YooKassa request failed: {e}")
            raise
        except Exception as e:
            log.exception(f"Unexpected error in YooKassa request: {e}")
            raise

    async def create_payment(
        self,
        amount: Decimal,
        currency: str = "RUB",
        description: str = "",
        return_url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        capture: bool = True,
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

        Returns:
            Payment object with confirmation URL
        """
        idempotence_key = str(uuid.uuid4())

        payment_data = {
            "amount": {
                "value": str(amount),
                "currency": currency,
            },
            "confirmation": {
                "type": "redirect",
                "return_url": return_url or "https://example.com/payment/success",
            },
            "capture": capture,
            "description": description,
        }

        if metadata:
            payment_data["metadata"] = metadata

        response = await self._request(
            "POST",
            "payments",
            data=payment_data,
            idempotence_key=idempotence_key,
        )

        log.info(
            f"Created payment {response.get('id')} for {amount} {currency}"
        )
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
        Verify webhook signature from YooKassa

        Args:
            webhook_body: Raw webhook body (JSON string)
            signature: Signature from HTTP header

        Returns:
            True if signature is valid
        """
        if not self.config.webhook_secret:
            log.warning("Webhook secret not configured, skipping verification")
            return True

        # YooKassa uses HMAC-SHA256
        expected_signature = hmac.new(
            self.config.webhook_secret.encode("utf-8"),
            webhook_body.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        is_valid = hmac.compare_digest(signature, expected_signature)

        if not is_valid:
            log.warning("Invalid webhook signature")

        return is_valid


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
        if "refund" in event_type:
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
