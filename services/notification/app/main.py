import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware

from shared.config import get_settings
from app.connections import manager
from app.consumer import start_event_consumer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("Starting notification event consumer...")
    connection = await start_event_consumer(settings.rabbitmq_url)
    app.state.rabbit_connection = connection
    yield
    await connection.close()
    logger.info("Notification consumer stopped.")


app = FastAPI(
    title="KTZh Notification Service",
    description="Real-time WebSocket notifications for CRM operators.",
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


@app.websocket("/ws/notifications")
async def websocket_notifications(
    websocket: WebSocket,
    user_id: str = Query(...),
):
    """
    WebSocket endpoint for real-time notifications.
    Connect with: ws://host:8008/ws/notifications?user_id=<uuid>
    """
    await manager.connect(websocket, user_id)
    try:
        while True:
            # Keep connection alive; client can also send pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "notification",
        "active_connections": manager.count,
    }
