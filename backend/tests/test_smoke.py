"""
Lightweight smoke + unit tests — no live DB required.

These catch the regression classes we actually hit:
- import/route errors (e.g. a missing dependency, a bad import) → test_app_imports
- broken pure logic → unit tests below

Run: `pytest -q` (CI sets a dummy DATABASE_URL so imports don't need a real DB).
"""

from datetime import datetime, timezone

from starlette.requests import Request


def _request(headers: dict, client=("9.9.9.9", 0)) -> Request:
    scope = {
        "type": "http",
        "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
        "client": client,
    }
    return Request(scope)


def test_app_imports_and_core_routes_registered():
    from main import app
    paths = {getattr(r, "path", "") for r in app.routes}
    assert "/health" in paths
    assert "/ready" in paths
    # billing routes are mounted under /api/v1/billing
    assert any("/billing/plans" in p for p in paths)
    assert any("/billing/subscription" in p for p in paths)


def test_payment_provider_defaults_to_noop():
    from app.modules.billing.provider import get_payment_provider, NoopProvider
    provider = get_payment_provider()
    assert isinstance(provider, NoopProvider)
    assert provider.name == "none"


def test_billing_period_start_defaults_to_month_start():
    from app.api.v1.endpoints.billing import _period_start
    start = _period_start(None)
    assert start.day == 1 and start.hour == 0 and start.minute == 0
    assert start.tzinfo is not None


def test_client_ip_prefers_first_forwarded_for():
    from app.core.ratelimit import client_ip
    assert client_ip(_request({"x-forwarded-for": "1.2.3.4, 5.6.7.8"})) == "1.2.3.4"
    # No XFF → falls back to the socket peer
    assert client_ip(_request({})) == "9.9.9.9"
