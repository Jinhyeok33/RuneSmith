from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.api.compile import router as compile_router
from app.api.auth import router as auth_router
from app.api.market import router as market_router
from app.api.skills import router as skills_router
from app.database.session import init_db, close_db

# Load environment variables from .env file in project root
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)


# Lifespan context manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    print("[OK] Database initialized")
    yield
    # Shutdown
    await close_db()
    print("[OK] Database connections closed")


app = FastAPI(
    title="RuneSmith API",
    description="스킬 컴파일러 + 밸런스 엔진 + 마켓플레이스 API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3002", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routers
app.include_router(compile_router)
app.include_router(auth_router)
app.include_router(market_router)
app.include_router(skills_router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "runesmith-api", "version": "0.1.1", "database": "connected"}
