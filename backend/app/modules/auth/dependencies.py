"""
FastAPI dependency for JWT-protected routes.
Usage: current_user: dict = Depends(get_current_user)
       admin_user: dict = Depends(require_org_admin)
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.modules.auth.service import decode_token, get_user_by_id
from app.modules.auth.models import UserRole

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """Extract and validate JWT — returns user dict."""
    token = credentials.credentials
    payload = decode_token(token)

    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


def require_org_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Only org admins can access this route."""
    if current_user["role"] not in (UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


def require_same_org(org_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    """Ensure user belongs to the org they're accessing."""
    if current_user["org_id"] != org_id and current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    return current_user
