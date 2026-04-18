from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from routes.ai_router import router as ai_router
from routes.request_router import router as request_router
from routes.tag_router import router as tag_router
from db.db_client import connect_db, disconnect_db
from utils.logger import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Service...")
    await connect_db()
    yield
    await disconnect_db()
    logger.info("AI Service stopped.")


app = FastAPI(
    title="Campus AI Service",
    description="AI-powered copilot, request parser, and tagging engine for campus ERP",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai_router,      prefix="/api/copilot",  tags=["Copilot"])
app.include_router(request_router, prefix="/api/requests", tags=["Requests"])
app.include_router(tag_router,     prefix="/api/tags",     tags=["Tagging"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "campus-ai"}