from pydantic import BaseModel, Field
from fastapi import APIRouter

from app.classifier import AppealClassifier
from app.responder import ResponseGenerator

router = APIRouter(prefix="/llm", tags=["llm"])

classifier = AppealClassifier()
responder = ResponseGenerator()


class ClassifyRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    language: str = "ru"


class ClassifyResponse(BaseModel):
    category: str
    subcategory: str | None = None
    confidence: float
    sentiment: str
    summary: str
    extracted_data: dict = {}


class GenerateResponseRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    category: str
    language: str = "ru"


class GenerateResponseResult(BaseModel):
    response: str


@router.post("/classify", response_model=ClassifyResponse)
async def classify_appeal(body: ClassifyRequest):
    """Classify an appeal text using LLM with keyword fallback."""
    result = await classifier.classify(body.text, body.language)
    return ClassifyResponse(
        category=result.get("category", "complaint"),
        subcategory=result.get("subcategory"),
        confidence=result.get("confidence", 0.5),
        sentiment=result.get("sentiment", "neutral"),
        summary=result.get("summary", body.text[:200]),
        extracted_data=result.get("extracted_data", {}),
    )


@router.post("/generate-response", response_model=GenerateResponseResult)
async def generate_response(body: GenerateResponseRequest):
    """Generate an auto-response for a client appeal."""
    text = await responder.generate(body.text, body.category, body.language)
    return GenerateResponseResult(response=text)
