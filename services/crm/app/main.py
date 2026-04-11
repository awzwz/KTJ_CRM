import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from shared.config import get_settings
from shared.database import engine, Base
from app.routes.appeals import router as appeals_router
from app.events import init_publisher, close_publisher

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await init_publisher(settings.rabbitmq_url)
    yield
    await close_publisher()
    await engine.dispose()


app = FastAPI(
    title="KTZh CRM Service",
    description="Core CRM API for appeals, status workflow, and audit history.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(appeals_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "crm"}
