"""
WebSocket connection manager.
Tracks active connections by user ID and broadcasts events.
"""
import json
import logging
from dataclasses import dataclass, field

from fastapi import WebSocket

logger = logging.getLogger(__name__)


@dataclass
class ConnectionManager:
    """Manages active WebSocket connections, keyed by user_id."""
    _connections: dict[str, list[WebSocket]] = field(default_factory=dict)

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        if user_id not in self._connections:
            self._connections[user_id] = []
        self._connections[user_id].append(websocket)
        logger.info("WS connected: user=%s (total=%d)", user_id, self.count)

    def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        if user_id in self._connections:
            self._connections[user_id] = [
                ws for ws in self._connections[user_id] if ws is not websocket
            ]
            if not self._connections[user_id]:
                del self._connections[user_id]
        logger.info("WS disconnected: user=%s (total=%d)", user_id, self.count)

    async def send_to_user(self, user_id: str, data: dict) -> None:
        """Send a message to all connections for a specific user."""
        connections = self._connections.get(user_id, [])
        dead = []
        for ws in connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, user_id)

    async def broadcast(self, data: dict) -> None:
        """Send a message to all connected users."""
        dead_pairs: list[tuple[str, WebSocket]] = []
        for user_id, connections in self._connections.items():
            for ws in connections:
                try:
                    await ws.send_json(data)
                except Exception:
                    dead_pairs.append((user_id, ws))
        for uid, ws in dead_pairs:
            self.disconnect(ws, uid)

    async def broadcast_to_branch(self, branch_id: str, data: dict, branch_users: list[str]) -> None:
        """Send a message to all users belonging to a branch."""
        for user_id in branch_users:
            await self.send_to_user(user_id, data)

    @property
    def count(self) -> int:
        return sum(len(conns) for conns in self._connections.values())


manager = ConnectionManager()
