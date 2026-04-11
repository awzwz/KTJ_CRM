from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from shared.config import get_settings
from app.routes.llm import router as llm_router

app = FastAPI(
    title="KTZh LLM Service",
    description="LLM-powered classification, data extraction, and response generation for appeals.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(llm_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "llm"}
