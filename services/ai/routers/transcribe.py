import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, UploadFile, File

from core.config import settings
from core.openai_client import get_client
from models.schemas import (
    MeetingDraftResponse,
    TextTranscriptRequest,
    TranscriptionResponse,
)

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


TEXT_DRAFT_SYSTEM_PROMPT = (
    "You extract meeting metadata from consultation transcripts or notes.\n\n"
    "Return JSON with exactly these keys:\n"
    '- "title": concise meeting title (max 120 chars)\n'
    '- "date": ISO 8601 datetime if a date is implied, otherwise today in UTC\n'
    '- "participants": array of participant names (exclude interviewer when obvious)\n'
    '- "notes_preview": first ~240 chars of the source text, verbatim where possible\n\n'
    "Use Australian English spelling. Return only valid JSON."
)


def _preview_text(text: str, max_length: int = 240) -> str:
    trimmed = text.strip()
    if len(trimmed) <= max_length:
        return trimmed
    return f"{trimmed[:max_length].rstrip()}…"


@router.post("/text", response_model=MeetingDraftResponse)
async def transcribe_text(request: TextTranscriptRequest):
    """Build a meeting draft from pasted transcript or notes text."""
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")

    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Text is empty")

    if request.title:
        return MeetingDraftResponse(
            title=request.title.strip(),
            date=datetime.now(timezone.utc).isoformat(),
            participants=[],
            notes_preview=_preview_text(text),
            project_id=request.project_id,
        )

    client = get_client()

    try:
        completion = client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": TEXT_DRAFT_SYSTEM_PROMPT},
                {"role": "user", "content": text[:12000]},
            ],
            response_format={"type": "json_object"},
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM API error: {e}")

    content = completion.choices[0].message.content
    if not content:
        raise HTTPException(status_code=502, detail="Empty response from LLM")

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=422, detail=f"Model returned invalid JSON: {e}")

    title = parsed.get("title") if isinstance(parsed.get("title"), str) else "Untitled meeting"
    date = parsed.get("date") if isinstance(parsed.get("date"), str) else datetime.now(timezone.utc).isoformat()
    participants = [
        name.strip()
        for name in (parsed.get("participants") or [])
        if isinstance(name, str) and name.strip()
    ]
    notes_preview = (
        parsed.get("notes_preview")
        if isinstance(parsed.get("notes_preview"), str) and parsed.get("notes_preview").strip()
        else _preview_text(text)
    )

    return MeetingDraftResponse(
        title=title.strip() or "Untitled meeting",
        date=date,
        participants=participants,
        notes_preview=notes_preview,
        project_id=request.project_id,
    )


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
