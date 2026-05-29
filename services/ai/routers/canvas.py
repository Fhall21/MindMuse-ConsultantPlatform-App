from __future__ import annotations

from typing import Any

import openai
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from spatial_layout import compute_spatial_layout, is_timeout_error

router = APIRouter(prefix="/canvas", tags=["canvas"])

_db_engine: Any = None


class NodeInput(BaseModel):
    id: str = Field(min_length=1)
    text: str


class SpatialLayoutRequest(BaseModel):
    roundId: str = Field(min_length=1)
    nodes: list[NodeInput]


class CacheStats(BaseModel):
    hits: int
    misses: int


class SuggestedFrame(BaseModel):
    id: str
    name: str
    nodeIds: list[str]
    x: float
    y: float
    width: float
    height: float
    color: str


class SpatialLayoutResponse(BaseModel):
    positions: dict[str, dict[str, float]]
    cacheStats: CacheStats
    suggestedFrames: list[SuggestedFrame]


def _get_db_engine() -> Any:
    global _db_engine
    if _db_engine is None:
        from core.config import settings
        from sqlalchemy import create_engine

        url = settings.build_database_url()
        if not url:
            raise RuntimeError("DATABASE_URL not configured")
        _db_engine = create_engine(url, future=True, pool_pre_ping=True)
    return _db_engine


@router.post("/spatial-layout", response_model=SpatialLayoutResponse)
def spatial_layout(request: SpatialLayoutRequest) -> SpatialLayoutResponse:
    try:
        result = compute_spatial_layout(
            request.nodes,
            _get_db_engine(),
            round_id=request.roundId,
        )
        return SpatialLayoutResponse(
            positions=result.positions,
            cacheStats=CacheStats(
                hits=result.cache_stats.hits,
                misses=result.cache_stats.misses,
            ),
            suggestedFrames=[
                SuggestedFrame(
                    id=frame.id,
                    name=frame.name,
                    nodeIds=frame.node_ids,
                    x=frame.x,
                    y=frame.y,
                    width=frame.width,
                    height=frame.height,
                    color=frame.color,
                )
                for frame in result.suggested_frames
            ],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except openai.RateLimitError as exc:
        raise HTTPException(
            status_code=503,
            detail="Embedding service rate-limited. Retry shortly.",
        ) from exc
    except Exception as exc:
        if is_timeout_error(exc):
            raise HTTPException(status_code=504, detail="Embedding service timed out.") from exc
        if isinstance(exc, openai.APIStatusError):
            raise HTTPException(
                status_code=502,
                detail=f"Embedding service error: {exc.status_code}",
            ) from exc
        raise
