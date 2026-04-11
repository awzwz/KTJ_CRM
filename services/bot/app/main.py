import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from shared.config import get_settings
from app.handlers.consumer import start_consumer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("Starting bot consumer...")
    connection = await start_consumer(settings.rabbitmq_url)
    app.state.rabbit_connection = connection
    yield
    await connection.close()
    logger.info("Bot consumer stopped.")


app = FastAPI(
    title="KTZh Bot Service",
    description="Conversational bot with state machine for customer service flows.",
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


@app.get("/health")
async def health():
    return {"status": "ok", "service": "bot"}
