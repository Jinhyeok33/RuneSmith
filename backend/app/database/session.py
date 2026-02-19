"""
Database session configuration for SQLAlchemy async
"""
import os
import ssl
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool

# Load environment variables from .env file in project root
env_path = Path(__file__).parent.parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:password@localhost:5432/runesmith")

# Detect if connecting to a remote database (Supabase, Railway, etc.)
_is_remote = "localhost" not in DATABASE_URL and "127.0.0.1" not in DATABASE_URL

# Build engine kwargs
_engine_kwargs: dict = dict(
    echo=False,
)

if _is_remote:
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE
    _engine_kwargs["connect_args"] = {
        "ssl": ssl_ctx,
        "statement_cache_size": 0,
        "prepared_statement_name_func": lambda: "",
    }
    _engine_kwargs["poolclass"] = NullPool
else:
    _engine_kwargs["pool_pre_ping"] = True
    _engine_kwargs["pool_size"] = 10
    _engine_kwargs["max_overflow"] = 20

# Create async engine
engine = create_async_engine(DATABASE_URL, **_engine_kwargs)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base class for models
Base = declarative_base()


# Dependency for FastAPI routes
async def get_db():
    """Dependency for database sessions"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# Initialize database (create tables)
async def init_db():
    """Initialize database tables"""
    if _is_remote:
        # Skip create_all for remote DBs (Supabase pgbouncer doesn't support
        # the multiple prepared statements that create_all uses internally).
        # Tables should be created via Supabase SQL Editor or migrations.
        return
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


# Close database connections
async def close_db():
    """Close all database connections"""
    await engine.dispose()
