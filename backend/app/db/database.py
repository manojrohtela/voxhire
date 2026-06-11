"""
Database connection — SQLAlchemy async engine.
Uses DATABASE_URL from .env
"""

import re, ssl
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

def get_async_url(url: str) -> str:
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    url = re.sub(r"[?&]sslmode=[^&]*", "", url)
    url = re.sub(r"\?$", "", url)
    return url

def _make_ssl_ctx() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx

_is_supabase = "supabase" in settings.DATABASE_URL
engine = create_async_engine(
    get_async_url(settings.DATABASE_URL),
    echo=settings.APP_ENV == "development",
    pool_pre_ping=True,
    connect_args={"ssl": _make_ssl_ctx(), "statement_cache_size": 0} if _is_supabase else {},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

class Base(DeclarativeBase):
    pass

async def get_db():
    """FastAPI dependency — yields async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
