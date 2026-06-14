"""
Payment provider abstraction.

Billing data (plans, subscriptions, usage) works without any provider. To charge,
set PAYMENT_PROVIDER + the provider's keys; `get_payment_provider()` returns the
right implementation. Everything else in the app talks only to this interface.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import logging
from abc import ABC, abstractmethod
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class PaymentProvider(ABC):
    name: str = "none"
    enabled: bool = False

    @abstractmethod
    async def create_order(self, *, amount_cents: int, currency: str, notes: dict) -> dict:
        """Create a payment order. Returns dict with at least {order_id, key_id, amount, currency}."""

    @abstractmethod
    def verify_payment_signature(self, *, order_id: str, payment_id: str, signature: str) -> bool:
        ...

    @abstractmethod
    def verify_webhook(self, *, payload: bytes, signature: str) -> bool:
        ...


class NoopProvider(PaymentProvider):
    name = "none"
    enabled = False

    async def create_order(self, **_) -> dict:
        raise RuntimeError("No payment provider configured")

    def verify_payment_signature(self, **_) -> bool:
        return False

    def verify_webhook(self, **_) -> bool:
        return False


class RazorpayProvider(PaymentProvider):
    name = "razorpay"

    def __init__(self) -> None:
        import razorpay  # lazy so the dep is only needed when enabled
        self.key_id = settings.RAZORPAY_KEY_ID
        self.key_secret = settings.RAZORPAY_KEY_SECRET
        self.webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET
        self.enabled = bool(self.key_id and self.key_secret)
        self._client = razorpay.Client(auth=(self.key_id, self.key_secret)) if self.enabled else None

    async def create_order(self, *, amount_cents: int, currency: str, notes: dict) -> dict:
        # Razorpay amount is in the minor unit (paise for INR) — same as our price_cents.
        def _create():
            return self._client.order.create({
                "amount": amount_cents,
                "currency": currency or "INR",
                "notes": notes,
                "payment_capture": 1,
            })
        order = await asyncio.to_thread(_create)
        return {
            "order_id": order["id"],
            "key_id": self.key_id,
            "amount": order["amount"],
            "currency": order["currency"],
        }

    def verify_payment_signature(self, *, order_id: str, payment_id: str, signature: str) -> bool:
        # HMAC-SHA256(order_id|payment_id, key_secret) — verified locally, no API call.
        expected = hmac.new(
            self.key_secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature or "")

    def verify_webhook(self, *, payload: bytes, signature: str) -> bool:
        if not self.webhook_secret:
            return False
        expected = hmac.new(self.webhook_secret.encode(), payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature or "")


def get_payment_provider() -> PaymentProvider:
    provider = (settings.PAYMENT_PROVIDER or "").lower()
    if provider == "razorpay":
        try:
            return RazorpayProvider()
        except Exception as e:  # noqa: BLE001 — bad config shouldn't crash imports
            logger.error("Razorpay provider init failed: %s", e)
            return NoopProvider()
    # if provider == "stripe": return StripeProvider()
    return NoopProvider()
