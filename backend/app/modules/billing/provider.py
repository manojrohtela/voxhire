"""
Payment provider abstraction.

Billing data (plans, subscriptions, usage) is fully functional without any
payment provider. When you're ready to charge, implement this interface for
Razorpay/Stripe and return it from `get_payment_provider()` — nothing else in
the app needs to change.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

from app.core.config import settings


@dataclass
class CheckoutSession:
    url: Optional[str]          # hosted checkout URL to redirect the org to
    provider_ref: Optional[str] # provider-side id (subscription/order)


class PaymentProvider(ABC):
    name: str = "none"

    @abstractmethod
    async def create_checkout(self, *, org_id: str, plan_slug: str, amount_cents: int, currency: str) -> CheckoutSession:
        ...

    @abstractmethod
    async def verify_webhook(self, *, payload: bytes, signature: str) -> bool:
        ...


class NoopProvider(PaymentProvider):
    """Default — no real charging. Subscriptions are assigned manually by super-admin."""

    name = "none"

    async def create_checkout(self, **_) -> CheckoutSession:
        return CheckoutSession(url=None, provider_ref=None)

    async def verify_webhook(self, **_) -> bool:
        return False


def get_payment_provider() -> PaymentProvider:
    """Single place to swap in Razorpay/Stripe later (driven by settings.PAYMENT_PROVIDER)."""
    provider = getattr(settings, "PAYMENT_PROVIDER", "") or ""
    # if provider == "razorpay": return RazorpayProvider()
    # if provider == "stripe":   return StripeProvider()
    return NoopProvider()
