from fastapi import APIRouter, HTTPException, UploadFile, File

from core.config import settings
from core.openai_client import get_client
from models.schemas import TranscriptionResponse

router = APIRouter(prefix="/transcribe", tags=["transcribe"])

# Formats accepted by Whisper API
SUPPORTED_AUDIO_TYPES = {
    "audio/mpeg",
    "audio/mp4",
    "audio/mpga",
    "audio/m4a",
    "audio/wav",
    "audio/webm",
    "audio/ogg",
    "audio/x-m4a",
    "video/mp4",   # some browsers send video/* for recorded audio
    "video/webm",
    "application/octet-stream",  # fallback when content-type is not set
}


@router.post("/audio", response_model=TranscriptionResponse)
async def transcribe_audio(audio_file: UploadFile = File(...)):
    """
    Transcribe an uploaded audio file using Whisper.

    Accepts mp3, mp4, m4a, wav, webm, ogg.
    Returns the transcript text, detected language, duration, and word count.
    The caller is responsible for persisting the result to the transcription_jobs table.
    """
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")

    content_type = (audio_file.content_type or "").lower()
    if content_type and content_type not in SUPPORTED_AUDIO_TYPES:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unsupported audio format: '{content_type}'. "
                "Accepted formats: mp3, mp4, m4a, wav, webm, ogg."
            ),
        )

    file_bytes = await audio_file.read()
    if not file_bytes:
        raise HTTPException(status_code=422, detail="Uploaded audio file is empty")

    filename = audio_file.filename or "audio.mp3"
    effective_type = content_type or "audio/mpeg"

    client = get_client()

    try:
        result = client.audio.transcriptions.create(
            model=settings.openai_audio_model,
            file=(filename, file_bytes, effective_type),
            response_format="verbose_json",
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Transcription API error: {str(e)}",
        )

    text = getattr(result, "text", None) or ""
    if not text.strip():
        raise HTTPException(
            status_code=502,
            detail="Transcription returned empty text. The audio may be silent or inaudible.",
        )

    return TranscriptionResponse(
        transcript=text,
        language=getattr(result, "language", None),
        duration_seconds=float(result.duration) if getattr(result, "duration", None) is not None else None,
        word_count=len(text.split()),
    )
