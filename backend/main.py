from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from pathlib import Path

from database import engine, init_db
from config import settings
from api import auth, archives, cart, payments, users, admin

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    logger.info("Starting up...")

    # Create database directory if not exists
    db_path = Path("database")
    db_path.mkdir(exist_ok=True)

    # Initialize database
    await init_db()
    logger.info("Database initialized")

    yield

    # Shutdown
    logger.info("Shutting down...")


# Create app
app = FastAPI(
    title="RevitBot Web API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://localhost:3000",
        "https://web.telegram.org",
        "*"  # For development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check
@app.get("/")
async def root():
    return {
        "status": "ok",
        "name": "RevitBot Web API",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# Include routers (we'll create empty routers for now)
# app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
# app.include_router(archives.router, prefix="/api/archives", tags=["archives"])
# app.include_router(cart.router, prefix="/api/cart", tags=["cart"])
# app.include_router(payments.router, prefix="/api/payments", tags=["payments"])
# app.include_router(users.router, prefix="/api/users", tags=["users"])
# app.include_router(admin.router, prefix="/api/admin", tags=["admin"])

# Temporary test endpoint
@app.post("/api/auth/telegram")
async def telegram_auth(data: dict):
    """Temporary auth endpoint for testing"""
    return {
        "success": True,
        "token": "test-token-123",
        "user": {
            "id": 1,
            "username": "testuser",
            "isAdmin": True,
            "language": "ua"
        }
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True
    )