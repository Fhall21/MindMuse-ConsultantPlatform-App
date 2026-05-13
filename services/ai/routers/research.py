from __future__ import annotations

import asyncio
import json
import re
from collections.abc import AsyncIterator
from typing import Any, Literal, TypedDict

from fastapi import APIRouter, Body
from starlette.responses import StreamingResponse

# How long the SSE stream polls before giving up (slightly longer than worker's
# STUCK_TIMEOUT_MINUTES=45 so the worker gets a chance to write a failure first).
SSE_MAX_POLL_SECONDS = 50 * 60

# How long to wait for the worker to claim the session and write task_id.
# Worker polls every 10s; 6 × 5s = 30s covers the worst-case gap.
_TASK_ID_FETCH_RETRIES = 6
_TASK_ID_FETCH_INTERVAL = 5

_db_engine: Any = None


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


def _read_task_id(engine: Any, session_id: str) -> str | None:
    try:
        from sqlalchemy import text
        sql = text("SELECT task_id FROM research_sessions WHERE id = :sid")
    except ModuleNotFoundError:
        sql = "SELECT task_id FROM research_sessions WHERE id = :sid"  # type: ignore[assignment]
    with engine.connect() as conn:
        row = conn.execute(sql, {"sid": session_id}).fetchone()
    return str(row[0]) if row and row[0] else None


async def _fetch_task_id(engine: Any, session_id: str) -> str | None:
    """Poll DB until the worker writes task_id, or give up after ~30s."""
    loop = asyncio.get_event_loop()
    for _ in range(_TASK_ID_FETCH_RETRIES):
        task_id = await loop.run_in_executor(None, _read_task_id, engine, session_id)
        if task_id:
            return task_id
        await asyncio.sleep(_TASK_ID_FETCH_INTERVAL)
    return None


ResearchEventType = Literal["submitted", "polling", "complete", "error"]


class ResearchEvent(TypedDict):
    type: ResearchEventType
    data: dict[str, Any]


router = APIRouter(prefix="/research", tags=["research"])


def _sse_frame(event: ResearchEvent) -> str:
    return f"data: {json.dumps(event, separators=(',', ':'))}\n\n"


async def research_event_stream(
    events: AsyncIterator[ResearchEvent],
) -> StreamingResponse:
    async def stream() -> AsyncIterator[str]:
        async for event in events:
            yield _sse_frame(event)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )


# ── Edison response parsing ───────────────────────────────────────────────────

_STRENGTH_PHRASE_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"highest[- ]quality peer[- ]reviewed journal", re.IGNORECASE), "HIGHEST_QUALITY"),
    (re.compile(r"domain[- ]leading peer[- ]reviewed journal", re.IGNORECASE), "DOMAIN_LEADING"),
    (re.compile(r"peer[- ]reviewed journal", re.IGNORECASE), "PEER_REVIEWED"),
]


def _parse_references_string(refs_str: str) -> list[dict[str, Any]]:
    """Parse Edison's numbered reference string into a deduplicated list.

    Edison emits the same paper multiple times (different page ranges).
    We deduplicate by title and re-number from 1. Citation count and Edison's
    own strength phrase are extracted from the trailing sentence Edison appends
    to each entry: 'This article has N citations and is from a <quality> peer-
    reviewed journal.' Edison's strength is the source of truth (D3) — the
    threshold-based fallback runs later only when Edison didn't tag the paper.
    """
    if not refs_str:
        return []

    ref_pattern = re.compile(
        r"\d+\.\s+\(([^)]+)\):\s+(.*?)(?=\n\d+\.\s+\(|\Z)",
        re.DOTALL,
    )

    seen_titles: dict[str, int] = {}
    result: list[dict[str, Any]] = []

    for m in ref_pattern.finditer(refs_str):
        key_pages = m.group(1)
        rest = m.group(2).strip()

        key_match = re.match(r"(\S+)\s+pages", key_pages)
        citation_key = key_match.group(1) if key_match else key_pages

        # Citation count + Edison-supplied strength tag.
        citation_count: int | None = None
        cite_match = re.search(r"This article has\s+(\d+)\s+citations", rest, re.IGNORECASE)
        if cite_match:
            citation_count = int(cite_match.group(1))
        edison_strength: str | None = None
        for pat, tag in _STRENGTH_PHRASE_PATTERNS:
            if pat.search(rest):
                edison_strength = tag
                break

        url_match = re.search(r"URL:\s*(https?://[^\s,]+)", rest)
        url = url_match.group(1) if url_match else ""
        doi_match = re.search(r"doi:(\S+?)(?:\s|$)", rest)
        if not url and doi_match:
            url = f"https://doi.org/{doi_match.group(1)}"

        year_match = re.search(r"\b(20\d{2}|19\d{2})\b", rest)
        year = year_match.group(1) if year_match else ""

        pre_url = rest[: url_match.start()].rstrip("., ") if url_match else rest

        # Anchor on "Journal, Volume:Pages" to cleanly split title from journal.
        vol_match = re.search(r",\s*\d+:\d+-\d+", pre_url)
        authors = title = journal = ""
        if vol_match:
            before_journal = pre_url[: vol_match.start()]
            last_dot = before_journal.rfind(". ")
            if last_dot >= 0:
                journal = before_journal[last_dot + 2:].strip()
                pre_title = before_journal[:last_dot]
                # Split authors / title at first non-initial sentence boundary.
                boundary = re.search(r"(?<![A-Z])\.(?<!\b[A-Z])[ ]+(?=[A-Z])", pre_title)
                if boundary:
                    authors = pre_title[: boundary.start()].strip()
                    title = pre_title[boundary.end():].strip()
                else:
                    title = pre_title.strip()
            else:
                journal = before_journal.strip()
        else:
            parts = pre_url.split(". ", 2)
            authors = parts[0].strip() if parts else ""
            title = parts[1].strip() if len(parts) > 1 else ""
            journal = parts[2].strip() if len(parts) > 2 else ""

        if not title or title in seen_titles:
            continue

        seen_titles[title] = len(result) + 1
        entry: dict[str, Any] = {
            "number": len(result) + 1,
            "citation_key": citation_key,
            "title": title,
            "authors": authors,
            "year": year,
            "journal": journal,
            "url": url,
        }
        if citation_count is not None:
            entry["citation_count"] = citation_count
        if edison_strength is not None:
            entry["strength"] = edison_strength
        result.append(entry)

    return result


def _replace_inline_citations(answer_text: str, key_to_num: dict[str, int]) -> str:
    """Replace (citationkey pages X-Y, ...) groups with [N, M] markers."""

    def replace_group(m: re.Match) -> str:  # type: ignore[type-arg]
        keys = re.findall(r"(\S+)\s+pages\s+[\d\-]+", m.group(1))
        numbers = sorted({key_to_num[k] for k in keys if k in key_to_num})
        return (" [" + ", ".join(str(n) for n in numbers) + "]") if numbers else m.group(0)

    return re.sub(r"\s*\(([^)]+\bpages\b[^)]+)\)", replace_group, answer_text)


# ── Per-paper metadata + context⇄reference joining ───────────────────────────

def _context_citation_key(ctx: dict[str, Any]) -> str:
    """Citation key for a single context (no page range).

    Prefers the per-paper key on `text.doc.docname`/`text.doc.key` when
    present; falls back to the leading token of `text.name`
    (e.g. 'edmondson2023... pages 1-3' → 'edmondson2023...').
    """
    text = ctx.get("text") or {}
    if isinstance(text, dict):
        doc = text.get("doc") or {}
        if isinstance(doc, dict):
            for k in ("docname", "key", "dockey"):
                v = doc.get(k)
                if isinstance(v, str) and v:
                    return v
        name = text.get("name", "")
        if isinstance(name, str) and name:
            head = name.split(" pages ", 1)[0].strip()
            if head:
                return head
    return ""


def _extract_doc_metadata(contexts: list[Any]) -> dict[str, dict[str, Any]]:
    """Build citation_key → doc-level metadata from contexts.

    Edison repeats the same paper across multiple context chunks; we only
    need the first occurrence per citation_key.
    """
    out: dict[str, dict[str, Any]] = {}
    if not contexts:
        return out
    for ctx in contexts:
        if not isinstance(ctx, dict):
            continue
        ck = _context_citation_key(ctx)
        if not ck or ck in out:
            continue
        doc = (ctx.get("text") or {}).get("doc") or {}
        if not isinstance(doc, dict):
            continue
        bibtex_type = (doc.get("bibtex_type") or "").lower()
        if bibtex_type in {"article", "inproceedings"}:
            paper_type = "journal"
        elif bibtex_type in {"misc", "techreport"}:
            paper_type = "preprint"
        else:
            paper_type = "other"
        out[ck] = {
            "citation_count": doc.get("citation_count"),
            "source_quality": doc.get("source_quality"),
            "is_retracted": bool(doc.get("is_retracted")) if doc.get("is_retracted") is not None else None,
            "paper_type": paper_type,
        }
    return out


def _strength_tag_for(
    edison_tag: str | None,
    citation_count: int | None,
    source_quality: int | None,
    paper_type: str | None,
    year: str,
) -> str | None:
    """Resolve the strength badge per D3.

    Order of precedence:
      1. Edison's own phrase (`edison_tag` — already parsed from references).
      2. Threshold rules:
         - ≥400 citations → DOMAIN_LEADING
         - 50–399 citations on a journal → PEER_REVIEWED
         - ≥200 citations on a journal published in the last 5y → HIGHEST_QUALITY
    """
    if edison_tag in {"DOMAIN_LEADING", "PEER_REVIEWED", "HIGHEST_QUALITY"}:
        return edison_tag

    if citation_count is None:
        return None

    is_journal = paper_type == "journal" or (source_quality is not None and source_quality >= 1)

    # Recent + heavily cited journal → HIGHEST_QUALITY (rare; matches the
    # reference image where a 2012 Work & Stress paper with 251 citations
    # earned the green tag).
    if is_journal and citation_count >= 200 and year:
        try:
            from datetime import datetime
            if (datetime.utcnow().year - int(year)) <= 5:
                return "HIGHEST_QUALITY"
        except (ValueError, TypeError):
            pass

    if citation_count >= 400:
        return "DOMAIN_LEADING"
    if is_journal and citation_count >= 50:
        return "PEER_REVIEWED"
    return None


def _compute_context_usage(
    contexts: list[Any],
    used_ids: set[str],
    references: list[dict[str, Any]],
) -> dict[int, dict[str, list[str]]]:
    """For each reference (by its 1-based number), list used/unused chunks.

    Chunk IDs are formatted as `{ref_number}.{1-based chunk index}`, matching
    Edison's UI (e.g. 'Contexts: Used 1.1 1.2  Unused 1.5').

    Mapping is by citation_key — context's `text.name` token before " pages "
    matches the reference's `citation_key`. Positional ordering of chunks is
    preserved as they appear in `contexts` (Edison emits them ordered).
    """
    key_to_ref_number: dict[str, int] = {r["citation_key"]: r["number"] for r in references}
    per_ref_chunks: dict[int, list[tuple[str, bool]]] = {r["number"]: [] for r in references}

    for ctx in contexts:
        if not isinstance(ctx, dict):
            continue
        ck = _context_citation_key(ctx)
        ref_num = key_to_ref_number.get(ck)
        if ref_num is None:
            continue
        cid = ctx.get("id", "")
        per_ref_chunks[ref_num].append((cid, cid in used_ids))

    result: dict[int, dict[str, list[str]]] = {}
    for ref_num, chunks in per_ref_chunks.items():
        used: list[str] = []
        unused: list[str] = []
        for idx, (_cid, was_used) in enumerate(chunks, start=1):
            label = f"{ref_num}.{idx}"
            (used if was_used else unused).append(label)
        result[ref_num] = {"used": used, "unused": unused}
    return result


_STATUS_TRAILER_RE = re.compile(
    r"Status:\s*Paper Count=(?P<paper>\d+)\s*\|\s*"
    r"Relevant Papers=(?P<relevant>\d+)\s*\|\s*"
    r"Clinical Trial Count=(?P<trials>\d+)\s*\|\s*"
    r"Relevant Clinical Trials=(?P<rel_trials>\d+)\s*\|\s*"
    r"Current Evidence=(?P<evidence>\d+)"
    r"(?:\s*\|\s*Current Cost=\$?[\d.,]+)?"
    r"\s*\|\s*Disease-Target Evidence=(?P<dt>\d+)"
)


def _parse_status_trailer(text: str) -> dict[str, int] | None:
    """Parse Edison's per-result 'Status: …' trailer line.

    Edison appends a line like:
      Status: Paper Count=69 | Relevant Papers=11 | Clinical Trial Count=0 |
      Relevant Clinical Trials=0 | Current Evidence=34 | Current Cost=$0.21 |
      Disease-Target Evidence=0
    to many tool results. We want the LATEST occurrence in the whole message
    history — that's the agent's final tally and exactly matches the numbers
    Edison's own UI shows in the Analysis Status footer.
    """
    last = None
    for m in _STATUS_TRAILER_RE.finditer(text):
        last = m
    if not last:
        return None
    g = last.groupdict()
    return {
        "paper_count": int(g["paper"]),
        "relevant_papers": int(g["relevant"]),
        "clinical_trial_count": int(g["trials"]),
        "relevant_clinical_trials": int(g["rel_trials"]),
        "current_evidence": int(g["evidence"]),
        "disease_target_evidence": int(g["dt"]),
    }


def _extract_analysis_stats(
    inner: dict[str, Any],
    tool_results_concat: str = "",
) -> dict[str, int]:
    """Edison-tab stats strip.

    Source order:
      1. `inner['analysis_status']` (Edison's own dict — only present on some
         job versions; absent in this account).
      2. The LAST `Status: Paper Count=… | …` trailer Edison appends to many
         tool results (authoritative — these are the EXACT numbers shown in
         Edison's own Analysis Status footer).
      3. Fallback: derive from list lengths.
    """
    edison = inner.get("analysis_status")
    if isinstance(edison, dict) and edison:
        return {
            "paper_count": int(edison.get("paper_count", 0)),
            "relevant_papers": int(edison.get("relevant_papers", 0)),
            "clinical_trial_count": int(edison.get("clinical_trial_count", 0)),
            "relevant_clinical_trials": int(edison.get("relevant_clinical_trials", 0)),
            "current_evidence": int(edison.get("current_evidence", 0)),
            "disease_target_evidence": int(edison.get("disease_target_evidence", 0)),
        }

    if tool_results_concat:
        trailer = _parse_status_trailer(tool_results_concat)
        if trailer:
            return trailer

    # Derived fallback.
    contexts = inner.get("contexts") or []
    citeable = inner.get("citeable_context_ids") or []
    used_contexts = inner.get("used_contexts") or []
    seen_keys: set[str] = set()
    for ctx in contexts:
        if isinstance(ctx, dict):
            ck = _context_citation_key(ctx)
            if ck:
                seen_keys.add(ck)
    return {
        "paper_count": len(seen_keys) or len(contexts),
        "relevant_papers": len(citeable),
        "clinical_trial_count": 0,
        "relevant_clinical_trials": 0,
        "current_evidence": len(used_contexts),
        "disease_target_evidence": 0,
    }


_TOOL_LABELS: dict[str, tuple[str, str]] = {
    "create_plan": ("Planning research", "Creating a structured plan for the research query."),
    "paper_search": ("Searching literature", "Querying scientific databases for relevant papers."),
    "gather_evidence": ("Gathering evidence", "Collecting key excerpts from retrieved papers."),
    "read_text": ("Reading sources", "Reviewing and evaluating paper content in detail."),
    "view_images": ("Reviewing figures", "Examining figures, tables, and diagrams from sources."),
    "create_artifact": ("Synthesising findings", "Structuring retrieved evidence into a coherent summary."),
    "answer": ("Writing answer", "Composing the final cited, evidence-grounded response."),
}


def _parse_messages_content(
    messages: list[Any],
) -> tuple[dict[str, str], dict[str, dict[str, Any]]]:
    """Extract chain-of-thought content per tool — both flat text (legacy) and
    structured payloads (tagged-union, consumed by the frontend's
    ReasoningStepData types).

    Returns (content_by_tool, data_by_tool) where `data_by_tool[tool_name]`
    is a dict with a `kind` discriminator matching the frontend's union.
    """
    # Pair tool calls with their results by tool_call_id
    pending: dict[str, dict[str, Any]] = {}
    results: dict[str, str] = {}

    for msg in messages:
        if not isinstance(msg, dict):
            continue
        role = msg.get("role", "")
        if role == "assistant":
            for tc in msg.get("tool_calls", []):
                tc_id = tc.get("id", "")
                fn = tc.get("function", {})
                name = fn.get("name", "")
                args_raw = fn.get("arguments", "{}")
                try:
                    args = json.loads(args_raw) if isinstance(args_raw, str) else args_raw
                except Exception:
                    args = {}
                pending[tc_id] = {"name": name, "args": args}
        elif role == "tool":
            tc_id = msg.get("tool_call_id", "")
            content = msg.get("content", "")
            if isinstance(content, list):
                content = " ".join(
                    c.get("text", "") for c in content if isinstance(c, dict)
                )
            results[tc_id] = str(content)

    # Group calls+results by tool name, preserving call order
    by_tool: dict[str, list[dict[str, Any]]] = {}
    for tc_id, call in pending.items():
        name = call["name"]
        by_tool.setdefault(name, []).append({"args": call["args"], "result": results.get(tc_id, "")})

    formatted: dict[str, str] = {}
    structured: dict[str, dict[str, Any]] = {}

    # ── Planning research (use the *last* update_plan with a result — that's
    # the final plan state, columns: objective × rationale × status × result
    # × evaluation).
    plan_calls = [c for c in by_tool.get("update_plan", []) if c["result"]]
    final_plan = plan_calls[-1] if plan_calls else None
    if final_plan:
        try:
            raw = final_plan["result"]
            plan_data = json.loads(raw[raw.index("{"): raw.rindex("}") + 1])
            rows: list[dict[str, Any]] = []
            lines: list[str] = []
            for i, obj in enumerate(plan_data.get("objectives", []), start=1):
                status_raw = (obj.get("status") or "").lower()
                if status_raw in {"completed", "complete", "done"}:
                    status = "COMPLETED"
                elif status_raw in {"in-progress", "in_progress", "active"}:
                    status = "IN-PROGRESS"
                else:
                    status = "PENDING"
                rows.append({
                    "id": i,
                    "objective": obj.get("objective", "") or "",
                    "rationale": obj.get("rationale", "") or "",
                    "status": status,
                    "result": obj.get("result", "") or "",
                    "evaluation": obj.get("evaluation", "") or "",
                })
                icon = "✓" if status == "COMPLETED" else "→" if status == "IN-PROGRESS" else "○"
                lines.append(f"{icon} {obj.get('objective', '')}")
            if rows:
                structured["create_plan"] = {"kind": "plan", "rows": rows}
            if lines:
                formatted["create_plan"] = "\n".join(lines)
        except Exception:
            pass

    # ── paper_search: per-query, per-paper records.
    # Edison's RESULT is a sequence of blocks separated by `---`. Each block:
    #   ## N. <title>
    #   Valid Text Names:
    #   'key pages 1-2', 'key pages 2-4', ...
    #   BibTex:
    #   @article{key, author="...", year="2018", journal="Journal name", ... }
    #   Abstract: ...
    #   Relevant Snippet: ...
    search_queries: list[dict[str, Any]] = []
    search_lines: list[str] = []
    for call in by_tool.get("paper_search", []):
        query = call["args"].get("query", "")
        result_text = call["result"] or ""
        papers = _parse_paper_search_result(result_text)
        if not query:
            continue
        # Trim per-paper detail; UI only shows top ~8.
        search_queries.append({
            "query": query,
            "papers": [
                {k: v for k, v in p.items() if v not in (None, "")}
                for p in papers[:8]
            ],
            "count": len(papers),
        })
        preview = ", ".join((p.get("title") or "") for p in papers[:3]) or "searching…"
        search_lines.append(f'"{query}" → {preview}')
    if search_queries:
        structured["paper_search"] = {"kind": "search", "queries": search_queries}
    if search_lines:
        formatted["paper_search"] = "\n".join(search_lines)

    # ── gather_evidence: every round's question + structured per-context
    # excerpts. Each result starts with "Most relevant evidence (with ids):"
    # then blocks per context, separated by `---`. Block format:
    #   ## pqac-XXXXXXXX
    #   From text 'citation_key pages X-Y'.
    #   <full formatted citation incl. "N citations" + "<tier> peer-reviewed journal">
    #   <excerpt summary>
    gather_rounds: list[dict[str, Any]] = []
    first_question_text: str | None = None
    for call in by_tool.get("gather_evidence", []):
        question = call["args"].get("question", "")
        focus = call["args"].get("text_name_focus_list", []) or []
        excerpts = _parse_gather_evidence_result(call["result"] or "")
        if not question and not excerpts:
            continue
        gather_rounds.append({
            "question": question,
            "focus_papers": [_text_name_to_key(t) for t in focus if isinstance(t, str)],
            "excerpts_count": len(excerpts),
            "top_excerpts": excerpts[:5],
        })
        if first_question_text is None and question:
            first_question_text = question
    if gather_rounds:
        structured["gather_evidence"] = {
            "kind": "gather",
            # Back-compat: keep the original fields the UI expects in
            # ReasoningEvidenceQuotes — populated from the first round.
            "question": gather_rounds[0]["question"],
            "excerpts_count": gather_rounds[0]["excerpts_count"],
            "top_excerpts": gather_rounds[0]["top_excerpts"],
            # New: every round, so the UI can scroll through all sub-questions.
            "rounds": gather_rounds,
        }
    if first_question_text:
        formatted["gather_evidence"] = first_question_text[:600]

    # ── view_images: per-call paper + figure-count + description.
    image_rounds: list[dict[str, Any]] = []
    for call in by_tool.get("view_images", []):
        result_text = call["result"] or ""
        # "Retrieved N image(s) from <paper_key>"
        m = re.search(r"Retrieved\s+(\d+)\s+image\(s\)\s+from\s+([A-Za-z0-9_]+)", result_text)
        count = int(m.group(1)) if m else 0
        ck = m.group(2) if m else ""
        # First narrative sentence after the header — Edison's prose
        # describing what was extracted.
        post_header = result_text[m.end() :] if m else result_text
        # Strip context-id headers; take the first 400 chars of prose.
        prose = re.sub(r"##\s+Context ID:\s*pqac-\w+\s*", "", post_header).strip()
        description = " ".join(prose.split())[:400]
        image_rounds.append({
            "citation_key": ck,
            "image_count": count,
            "query": call["args"].get("query", ""),
            "description": description,
            "text_name": call["args"].get("text_name", ""),
        })
    if image_rounds:
        structured["view_images"] = {"kind": "figures", "rounds": image_rounds}
        formatted["view_images"] = "\n".join(
            f"{r['image_count']} from {r['citation_key']}: {r['query'][:80]}"
            for r in image_rounds
        )

    # ── read_text: per-paper takeaway. (Most accounts skip read_text; gather_
    # evidence carries the heavy lifting.)
    read_papers: list[dict[str, str]] = []
    for call in by_tool.get("read_text", []):
        ck = (
            call["args"].get("docname")
            or call["args"].get("paper_key")
            or call["args"].get("dockey")
            or ""
        )
        result_text = (call["result"] or "").strip()
        first_line = result_text.splitlines()[0][:140] if result_text else ck
        takeaway = result_text[:240].strip()
        if takeaway:
            read_papers.append({
                "citation_key": ck,
                "title": first_line or ck,
                "takeaway": takeaway,
            })
    if read_papers:
        structured["read_text"] = {"kind": "read", "papers": read_papers[:10]}

    # ── create_artifact: the markdown table from the latest result.
    artifact_calls = [c for c in by_tool.get("create_artifact", []) if c["result"]]
    if artifact_calls:
        result = artifact_calls[-1]["result"]
        table_start = result.find("|")
        if table_start >= 0:
            table_md = result[table_start: table_start + 8000]
            formatted["create_artifact"] = table_md[:1200]
            structured["create_artifact"] = {"kind": "artifact", "table_markdown": table_md}

    return formatted, structured


# ── paper_search / gather_evidence parsers ───────────────────────────────────

_BIBTEX_FIELD_RE = re.compile(r'(\w+)\s*=\s*"((?:[^"\\]|\\.)*)"', re.DOTALL)
_PAPER_BLOCK_RE = re.compile(
    r"^##\s+\d+\.\s+(?P<title>[^\n]+)\n"
    r"(?P<body>.*?)(?=\n##\s+\d+\.\s+|\Z)",
    re.MULTILINE | re.DOTALL,
)


def _text_name_to_key(text_name: str) -> str:
    return text_name.split(" pages ", 1)[0].strip()


def _parse_paper_search_result(text: str) -> list[dict[str, Any]]:
    """Extract per-paper metadata from a paper_search tool result."""
    papers: list[dict[str, Any]] = []
    for m in _PAPER_BLOCK_RE.finditer(text):
        title = m.group("title").strip()
        body = m.group("body")
        # Valid Text Names → page chunk count.
        chunk_match = re.search(r"Valid Text Names:\s*(.+?)\n\n", body, re.DOTALL)
        chunks: list[str] = []
        if chunk_match:
            chunks = re.findall(r"'([^']+)'", chunk_match.group(1))
        # BibTex block.
        bibtex_match = re.search(r"BibTex:\s*\n@\w+\{[^,]+,(.+?)\n\}", body, re.DOTALL)
        bib_fields: dict[str, str] = {}
        if bibtex_match:
            for fm in _BIBTEX_FIELD_RE.finditer(bibtex_match.group(1)):
                bib_fields[fm.group(1).lower()] = fm.group(2)
        # Citation key from the first chunk name.
        ck = _text_name_to_key(chunks[0]) if chunks else ""
        papers.append({
            "title": title,
            "citation_key": ck,
            "authors": bib_fields.get("author", ""),
            "year": bib_fields.get("year", ""),
            "journal": bib_fields.get("journal", ""),
            "doi": bib_fields.get("doi", ""),
            "url": bib_fields.get("url", ""),
            "chunk_count": len(chunks),
        })
    return papers


_EVIDENCE_BLOCK_RE = re.compile(
    r"^##\s+(?P<id>pqac-\w+)\n"
    r"(?P<body>.*?)(?=\n##\s+pqac-\w+|\Z)",
    re.MULTILINE | re.DOTALL,
)
_FROM_TEXT_RE = re.compile(r"From text\s+'([^']+)'", re.IGNORECASE)
_CITATIONS_RE = re.compile(r"This article has\s+(\d+)\s+citations", re.IGNORECASE)


def _parse_gather_evidence_result(text: str) -> list[dict[str, Any]]:
    """Extract per-context excerpts from a gather_evidence result.

    Each block looks like:
      ## pqac-00000000
      From text 'citation_key pages X-Y'.
      <formatted citation incl. "This article has N citations …">
      <excerpt summary>
    """
    out: list[dict[str, Any]] = []
    for m in _EVIDENCE_BLOCK_RE.finditer(text):
        cid = m.group("id")
        body = m.group("body").strip()
        if not body:
            continue
        # First line: "From text '<key> pages X-Y'"
        from_match = _FROM_TEXT_RE.search(body)
        source_key = ""
        if from_match:
            source_key = _text_name_to_key(from_match.group(1))
        cite_match = _CITATIONS_RE.search(body)
        citation_count = int(cite_match.group(1)) if cite_match else None
        # The summary excerpt is the last paragraph after the citation sentence.
        # Heuristic: drop the "From text" line and citation sentence; keep the rest.
        lines = [ln for ln in body.splitlines() if ln.strip()]
        # Skip the first line (From text…) and any lines that look like the
        # formatted citation (contain "doi:" or "This article has").
        excerpt_lines: list[str] = []
        for ln in lines:
            if ln.startswith("From text"):
                continue
            if "doi:" in ln or "This article has" in ln:
                continue
            excerpt_lines.append(ln)
        excerpt = " ".join(excerpt_lines).strip()
        out.append({
            "id": cid,
            "source_citation_key": source_key,
            "citation_count": citation_count,
            "excerpt": excerpt[:1200],
        })
    return out


def _tool_history_to_steps(
    tool_history: list[Any], messages: list[Any] | None = None
) -> list[dict[str, Any]]:
    if messages:
        content_by_tool, data_by_tool = _parse_messages_content(messages)
    else:
        content_by_tool, data_by_tool = {}, {}
    seen: set[str] = set()
    steps: list[dict[str, Any]] = []
    for entry in tool_history:
        if isinstance(entry, list):
            for tool in entry:
                if tool not in seen and tool in _TOOL_LABELS:
                    seen.add(tool)
                    label, detail = _TOOL_LABELS[tool]
                    step: dict[str, Any] = {"label": label, "detail": detail}
                    if tool in content_by_tool:
                        step["content"] = content_by_tool[tool]
                    if tool in data_by_tool:
                        step["data"] = data_by_tool[tool]
                    steps.append(step)
    return steps


def _extract_evidence(
    contexts: list[Any],
    used_ids: set[str],
    references: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Return used evidence excerpts sorted by relevance score, enriched with
    the source reference number / title / url when resolvable.
    """
    key_to_ref: dict[str, dict[str, Any]] = {}
    if references:
        for r in references:
            key_to_ref[r["citation_key"]] = r

    evidence: list[dict[str, Any]] = []
    for ctx in contexts:
        if not isinstance(ctx, dict):
            continue
        cid = ctx.get("id", "")
        if not cid or cid not in used_ids:
            continue
        item: dict[str, Any] = {
            "id": cid,
            "excerpt": ctx.get("context", ""),
            "question": ctx.get("question", ""),
            "score": ctx.get("score", 0),
        }
        ck = _context_citation_key(ctx)
        ref = key_to_ref.get(ck) if ck else None
        if ref:
            item["source_ref_number"] = ref["number"]
            item["source_title"] = ref.get("title", "")
            if ref.get("url"):
                item["source_url"] = ref["url"]
        evidence.append(item)
    evidence.sort(key=lambda x: x["score"], reverse=True)
    return evidence


def _extract_inner(verbose_result: Any) -> dict[str, Any] | None:
    """Safely extract the inner answer dict from a verbose Edison response."""
    try:
        return verbose_result.environment_frame["state"]["state"]["response"]["answer"]
    except (KeyError, TypeError, AttributeError):
        return None


def _extract_messages(verbose_result: Any) -> list[Any]:
    """Extract the full message history from agent_state."""
    try:
        agent_state = verbose_result.agent_state or []
        if not agent_state:
            return []
        last = agent_state[-1]
        return last["state"]["transition"]["agent_state"]["messages"]
    except (KeyError, TypeError, IndexError, AttributeError):
        return []


def _extract_literature_payload(verbose_result: Any) -> dict[str, Any]:
    """Build the complete payload from a finished Edison TaskResponseVerbose.

    The shape of this return is the SSE `complete` event's `data` field — also
    persisted to `research_sessions.result_data`. Treat the keys here as a
    contract; the snapshot test in `test_research_router.py` locks them in.
    See plan "Internal DX guardrails" for context.
    """
    references: list[dict[str, Any]] = []
    reasoning_steps: list[dict[str, Any]] = []
    evidence: list[dict[str, Any]] = []
    artifact: str = ""
    raw_answer: str = ""
    stats: dict[str, int] | None = None

    inner = _extract_inner(verbose_result)
    if inner:
        raw_answer = inner.get("answer", "") or ""

        refs_str: str = inner.get("references", "") or ""
        references = _parse_references_string(refs_str)

        contexts: list[Any] = inner.get("contexts", []) or []
        doc_meta = _extract_doc_metadata(contexts)

        # Enrich each reference with structured doc metadata + resolved strength.
        for ref in references:
            ck = ref.get("citation_key", "")
            meta = doc_meta.get(ck, {})
            if meta.get("paper_type"):
                ref["paper_type"] = meta["paper_type"]
            # Citation count: prefer the structured doc.citation_count when the
            # references-string regex missed it.
            if ref.get("citation_count") is None and meta.get("citation_count") is not None:
                ref["citation_count"] = meta["citation_count"]
            # Strength resolution (D3): Edison's phrase wins; otherwise thresholds.
            ref["strength"] = _strength_tag_for(
                edison_tag=ref.get("strength"),
                citation_count=ref.get("citation_count"),
                source_quality=meta.get("source_quality"),
                paper_type=ref.get("paper_type"),
                year=ref.get("year", ""),
            )
            if ref["strength"] is None:
                ref.pop("strength")

        # Per-reference context usage (Used X.Y X.Y  Unused X.Z).
        used_ids = set(inner.get("used_contexts", []))
        usage = _compute_context_usage(contexts, used_ids, references)
        for ref in references:
            entry = usage.get(ref["number"], {"used": [], "unused": []})
            ref["contexts_used"] = entry["used"]
            ref["contexts_unused"] = entry["unused"]

        tool_history: list[Any] = inner.get("tool_history", [])
        messages = _extract_messages(verbose_result)
        reasoning_steps = _tool_history_to_steps(tool_history, messages)

        evidence = _extract_evidence(contexts, used_ids, references)

        artifacts: dict[str, Any] = inner.get("artifacts", {}) or {}
        artifact = artifacts.get("artifact-00", "") or ""

        # Edison appends its own Status: trailer to several tool results.
        # Concatenate every tool result so _extract_analysis_stats can pick
        # up the LATEST trailer — the authoritative final tally.
        tool_results_concat = "\n".join(
            (m.get("content") if isinstance(m.get("content"), str)
             else " ".join(c.get("text", "") for c in (m.get("content") or []) if isinstance(c, dict)))
            for m in messages
            if isinstance(m, dict) and m.get("role") == "tool"
        )
        stats = _extract_analysis_stats(inner, tool_results_concat)

        # Attach stats footer to the create_artifact step's structured data so
        # the Reasoning tab can render the analysis-status alongside the table.
        if stats is not None:
            for step in reasoning_steps:
                data = step.get("data")
                if isinstance(data, dict) and data.get("kind") == "artifact":
                    data["stats"] = stats
                    break
    else:
        raw_answer = getattr(verbose_result, "answer", "") or ""

    key_to_num = {r["citation_key"]: r["number"] for r in references}
    answer = _replace_inline_citations(raw_answer, key_to_num) if key_to_num else raw_answer

    payload: dict[str, Any] = {
        "answer": answer,
        "reasoning_steps": reasoning_steps,
        "references": references,
        "evidence": evidence,
        "artifact": artifact,
    }
    if stats is not None:
        payload["stats"] = stats
    return payload


def _partial_steps(verbose_result: Any) -> list[dict[str, str]]:
    """Extract whatever reasoning steps are available from an in-progress verbose result."""
    inner = _extract_inner(verbose_result)
    if not inner:
        return []
    messages = _extract_messages(verbose_result)
    return _tool_history_to_steps(inner.get("tool_history", []), messages)


# ── SSE generators ────────────────────────────────────────────────────────────

def _polling_message(elapsed: int) -> str:
    if elapsed < 20:
        return "Planning research query…"
    if elapsed < 45:
        return "Searching scientific databases…"
    if elapsed < 75:
        return "Gathering and reading evidence…"
    if elapsed < 105:
        return "Synthesising findings…"
    return "Writing cited answer…"


async def _run_literature_sse(
    session_id: str | None,
    query: str,
    industry_ctx: str | None,
) -> AsyncIterator[ResearchEvent]:
    """Stream research progress to the client.

    Coordinator model: the background worker owns Edison submission and writes
    task_id to the DB. This generator waits for that task_id, then polls
    Edison directly — one Edison call per query, no dual submission.

    Stub path (no Edison key): session_id is ignored; fake events are emitted.
    """
    from core.config import settings

    if not settings.edison_api_key:
        async for event in _stub_research_events("literature"):
            yield event
        return

    if not session_id:
        yield {"type": "error", "data": {"message": "session_id required for live research"}}
        return

    from edison_client import EdisonClient  # type: ignore[import]

    engine = _get_db_engine()
    task_id = await _fetch_task_id(engine, session_id)
    if not task_id:
        yield {"type": "error", "data": {"message": "Research task did not start — worker may be down"}}
        return

    yield {"type": "submitted", "data": {"task_id": task_id}}

    client = EdisonClient(api_key=settings.edison_api_key)
    start = asyncio.get_event_loop().time()

    while True:
        elapsed = int(asyncio.get_event_loop().time() - start)
        if elapsed >= SSE_MAX_POLL_SECONDS:
            yield {"type": "error", "data": {"message": "Research timed out"}}
            return

        await asyncio.sleep(5)

        try:
            # Single verbose call: gives status + partial tool_history + contexts
            verbose_poll = await asyncio.wait_for(
                client.aget_task(task_id, verbose=True),
                timeout=60.0,
            )
        except asyncio.TimeoutError:
            continue
        except Exception as exc:
            yield {"type": "error", "data": {"message": f"Polling error: {exc}"}}
            return

        elapsed = int(asyncio.get_event_loop().time() - start)

        if verbose_poll.status == "success":
            payload = _extract_literature_payload(verbose_poll)
            yield {"type": "complete", "data": payload}
            return
        elif verbose_poll.status in {"fail", "cancelled", "truncated"}:
            yield {
                "type": "error",
                "data": {"message": f"Edison task ended with status: {verbose_poll.status}"},
            }
            return
        else:
            steps = _partial_steps(verbose_poll)
            yield {
                "type": "polling",
                "data": {
                    "elapsed_seconds": elapsed,
                    "message": _polling_message(elapsed),
                    "reasoning_steps": steps,
                },
            }


def _stub_literature_payload() -> dict[str, Any]:
    """Return a stub literature result dict for use when Edison API key is absent."""
    return {
        "stub": True,
        "answer": (
            "Social science consulting relies on evidence-based methods. [1]\n\n"
            "## Structured interviews\n\n"
            "Structured interviews are a core tool for gathering qualitative data in consulting contexts. [2]\n\n"
            "## Thematic analysis\n\n"
            "Thematic analysis enables systematic interpretation of interview findings, "
            "producing actionable insights from complex data. [1, 2]"
        ),
        "reasoning_steps": [
            {"label": "Planning research", "detail": "Creating a structured plan for the research query."},
            {"label": "Searching literature", "detail": "Querying scientific databases for relevant papers."},
            {"label": "Gathering evidence", "detail": "Collecting key excerpts from retrieved papers."},
            {"label": "Synthesising findings", "detail": "Structuring retrieved evidence into a coherent summary."},
            {"label": "Writing answer", "detail": "Composing the final cited, evidence-grounded response."},
        ],
        "references": [
            {
                "number": 1,
                "citation_key": "braun2006",
                "title": "Using thematic analysis in psychology",
                "authors": "Virginia Braun and Victoria Clarke",
                "year": "2006",
                "journal": "Qualitative Research in Psychology",
                "url": "https://doi.org/10.1191/1478088706qp063oa",
            },
            {
                "number": 2,
                "citation_key": "smith2023",
                "title": "Evidence-based practice in social science consulting",
                "authors": "Smith, J. & Jones, A.",
                "year": "2023",
                "journal": "Journal of Consulting Research",
                "url": "",
            },
        ],
        "evidence": [
            {
                "id": "pqac-00000001",
                "excerpt": "Braun & Clarke describe thematic analysis as a method for identifying patterns of meaning across qualitative datasets, applicable to a wide range of research questions.",
                "question": "What is thematic analysis?",
                "score": 9,
            },
            {
                "id": "pqac-00000002",
                "excerpt": "Smith & Jones argue that evidence-based consulting requires systematic review of relevant literature before advising clients on psychosocial interventions.",
                "question": "How is evidence used in consulting?",
                "score": 8,
            },
        ],
        "artifact": (
            "| Method | Description | Application |\n"
            "|---|---|---|\n"
            "| Thematic analysis | Identifies patterns across qualitative data | Interview coding |\n"
            "| Structured interviews | Standardised question format | Data collection |"
        ),
    }


async def _stub_research_events(
    session_type: Literal["literature", "analysis"],
) -> AsyncIterator[ResearchEvent]:
    yield {
        "type": "submitted",
        "data": {"session_type": session_type, "stub": True},
    }
    await asyncio.sleep(0)
    yield {
        "type": "polling",
        "data": {"session_type": session_type, "stub": True, "elapsed_seconds": 5},
    }
    await asyncio.sleep(0)
    yield {
        "type": "complete",
        "data": {
            "session_type": session_type,
            "stub": True,
            "answer": (
                "Social science consulting relies on evidence-based methods. [1]\n\n"
                "## Structured interviews\n\n"
                "Structured interviews are a core tool for gathering qualitative data in consulting contexts. [2]\n\n"
                "## Thematic analysis\n\n"
                "Thematic analysis enables systematic interpretation of interview findings, "
                "producing actionable insights from complex data. [1, 2]"
            ),
            "reasoning_steps": [
                {"label": "Planning research", "detail": "Creating a structured plan for the research query."},
                {"label": "Searching literature", "detail": "Querying scientific databases for relevant papers."},
                {"label": "Gathering evidence", "detail": "Collecting key excerpts from retrieved papers."},
                {"label": "Synthesising findings", "detail": "Structuring retrieved evidence into a coherent summary."},
                {"label": "Writing answer", "detail": "Composing the final cited, evidence-grounded response."},
            ],
            "references": [
                {
                    "number": 1,
                    "citation_key": "braun2006",
                    "title": "Using thematic analysis in psychology",
                    "authors": "Virginia Braun and Victoria Clarke",
                    "year": "2006",
                    "journal": "Qualitative Research in Psychology",
                    "url": "https://doi.org/10.1191/1478088706qp063oa",
                },
                {
                    "number": 2,
                    "citation_key": "smith2023",
                    "title": "Evidence-based practice in social science consulting",
                    "authors": "Smith, J. & Jones, A.",
                    "year": "2023",
                    "journal": "Journal of Consulting Research",
                    "url": "",
                },
            ],
            "evidence": [
                {
                    "id": "pqac-00000001",
                    "excerpt": "Braun & Clarke describe thematic analysis as a method for identifying patterns of meaning across qualitative datasets, applicable to a wide range of research questions.",
                    "question": "What is thematic analysis?",
                    "score": 9,
                },
                {
                    "id": "pqac-00000002",
                    "excerpt": "Smith & Jones argue that evidence-based consulting requires systematic review of relevant literature before advising clients on psychosocial interventions.",
                    "question": "How is evidence used in consulting?",
                    "score": 8,
                },
            ],
            "artifact": (
                "| Method | Description | Application |\n"
                "|---|---|---|\n"
                "| Thematic analysis | Identifies patterns across qualitative data | Interview coding |\n"
                "| Structured interviews | Standardised question format | Data collection |"
            ),
        },
    }


@router.post("/literature")
async def literature_search(
    payload: dict[str, Any] = Body(default_factory=dict),
) -> StreamingResponse:
    query: str = payload.get("query", "")
    industry_ctx: str | None = payload.get("industry_ctx") or None
    session_id: str | None = payload.get("session_id") or None
    return await research_event_stream(_run_literature_sse(session_id, query, industry_ctx))


@router.post("/analysis")
async def data_analysis(
    _payload: dict[str, Any] = Body(default_factory=dict),
) -> StreamingResponse:
    return await research_event_stream(_stub_research_events("analysis"))
