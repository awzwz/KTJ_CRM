from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from shared.database import engine, Base
from app.routes.branches import router as branches_router
from app.routes.routing import router as routing_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title="KTZh Routing Service",
    description="Branch routing and assignment rules for appeals.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(branches_router)
app.include_router(routing_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "routing"}
