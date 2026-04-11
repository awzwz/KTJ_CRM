from contextlib import asynccontextmanager

import aio_pika
import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from shared.config import get_settings

from app.routes.webhook import router as webhook_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    connection = await aio_pika.connect_robust(settings.rabbitmq_url)
    app.state.rabbit_connection = connection
    app.state.redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    yield
    await app.state.redis.aclose()
    await connection.close()


app = FastAPI(
    title="KTZh Webhook Service",
    description="Receives external webhooks (e.g. Wazzup) and forwards events to messaging infrastructure.",
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

app.include_router(webhook_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "webhook"}
