from pydantic import BaseModel, Field
from fastapi import APIRouter

from app.classifier import AppealClassifier
from app.extractor import AppealExtractor
from app.responder import ResponseGenerator
from app.transcriber import AudioTranscriber

router = APIRouter(prefix="/llm", tags=["llm"])

classifier = AppealClassifier()
extractor = AppealExtractor()
responder = ResponseGenerator()
transcriber = AudioTranscriber()


# --- Existing models ---

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


# --- New models for smart bot ---

class ExtractRequest(BaseModel):
    conversation_history: list[dict] = []
    latest_message: str = Field(..., min_length=1, max_length=5000)
    previously_extracted: dict = {}
    language: str | None = None


class ExtractResponse(BaseModel):
    detected_language: str
    category: str | None = None
    subcategory: str | None = None
    confidence: float
    sentiment: str
    summary: str
    extracted_fields: dict = {}


class FollowupRequest(BaseModel):
    category: str | None = None
    subcategory: str | None = None
    missing_fields: dict[str, str]
    language: str = "ru"
    conversation_history: list[dict] = []
    collected_fields: dict = {}


class FollowupResponse(BaseModel):
    message: str


class TranscribeRequest(BaseModel):
    audio_url: str = Field(..., min_length=1)


class TranscribeResponse(BaseModel):
    text: str | None = None
    success: bool


# --- Existing endpoints ---

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


# --- New endpoints for smart bot ---

@router.post("/extract", response_model=ExtractResponse)
async def extract_data(body: ExtractRequest):
    """Extract structured data from a user message using LLM."""
    result = await extractor.extract(
        conversation_history=body.conversation_history,
        latest_message=body.latest_message,
        previously_extracted=body.previously_extracted,
        language=body.language,
    )
    return ExtractResponse(
        detected_language=result.get("detected_language", "ru"),
        category=result.get("category"),
        subcategory=result.get("subcategory"),
        confidence=result.get("confidence", 0.5),
        sentiment=result.get("sentiment", "neutral"),
        summary=result.get("summary", ""),
        extracted_fields=result.get("extracted_fields", {}),
    )


@router.post("/generate-followup", response_model=FollowupResponse)
async def generate_followup(body: FollowupRequest):
    """Generate a natural follow-up question for missing fields."""
    message = await responder.generate_followup(
        category=body.category,
        subcategory=body.subcategory,
        missing_fields=body.missing_fields,
        language=body.language,
        conversation_history=body.conversation_history,
        collected_fields=body.collected_fields,
    )
    return FollowupResponse(message=message)


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(body: TranscribeRequest):
    """Transcribe an audio file URL to text using OpenAI Whisper."""
    text = await transcriber.transcribe(body.audio_url)
    return TranscribeResponse(text=text, success=text is not None)
