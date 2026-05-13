from __future__ import annotations

import asyncio
import json
import re
from collections.abc import AsyncIterator
from typing import Any, Literal, TypedDict

from fastapi import APIRouter, Body
from starlette.responses import StreamingResponse


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


def _extract_analysis_stats(inner: dict[str, Any]) -> dict[str, int]:
    """Derive the Evidence-tab stats strip.

    Edison's `analysis_status` / top-level `stats` are absent in this account,
    so we derive everything from list lengths. Clinical-trial buckets are 0
    until/unless Edison surfaces structured paper-type metadata that flags
    trials — `bibtex_type=article` alone is not sufficient to claim a trial.
    """
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

    # ── paper_search: per-query list of papers found with counts.
    search_queries: list[dict[str, Any]] = []
    search_lines: list[str] = []
    paper_md = re.compile(r"^## \d+\. (.+)$", re.MULTILINE)
    for call in by_tool.get("paper_search", []):
        query = call["args"].get("query", "")
        titles = paper_md.findall(call["result"])
        if not query:
            continue
        papers = [{"title": t} for t in titles[:8]]
        search_queries.append({
            "query": query,
            "papers": papers,
            "count": len(titles),
        })
        preview = ", ".join(titles[:3]) if titles else "searching…"
        search_lines.append(f'"{query}" → {preview}')
    if search_queries:
        structured["paper_search"] = {"kind": "search", "queries": search_queries}
    if search_lines:
        formatted["paper_search"] = "\n".join(search_lines)

    # ── gather_evidence: question + count + top excerpts (extracted from the
    # tool result text, which Edison formats as numbered blocks).
    gather_calls = by_tool.get("gather_evidence", [])
    if gather_calls:
        first = gather_calls[0]
        question = first["args"].get("question", "")
        # Heuristic: count occurrences of "context" lines in the result.
        excerpt_blocks = re.findall(
            r"(?:^|\n)(?:\d+\.\s+|##\s+)([^\n]{40,500})",
            first["result"],
        )
        top = [{"excerpt": e.strip()} for e in excerpt_blocks[:3]]
        excerpts_count = len(excerpt_blocks)
        if question:
            formatted["gather_evidence"] = question[:600]
            structured["gather_evidence"] = {
                "kind": "gather",
                "question": question,
                "excerpts_count": excerpts_count,
                "top_excerpts": top,
            }

    # ── read_text: per-paper takeaway (first ~200 chars of the tool result).
    read_papers: list[dict[str, str]] = []
    for call in by_tool.get("read_text", []):
        ck = (
            call["args"].get("docname")
            or call["args"].get("paper_key")
            or call["args"].get("dockey")
            or ""
        )
        result_text = (call["result"] or "").strip()
        # Title line typically appears first; fall back to citation key.
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
            table_md = result[table_start: table_start + 4000]
            formatted["create_artifact"] = table_md[:1200]
            structured["create_artifact"] = {"kind": "artifact", "table_markdown": table_md}

    return formatted, structured


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

        stats = _extract_analysis_stats(inner)

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


async def _run_literature_sse(query: str, industry_ctx: str | None) -> AsyncIterator[ResearchEvent]:
    from core.config import settings

    if not settings.edison_api_key:
        async for event in _stub_research_events("literature"):
            yield event
        return

    from edison_client import EdisonClient, JobNames  # type: ignore[import]

    client = EdisonClient(api_key=settings.edison_api_key)
    full_query = f"[Industry context: {industry_ctx}]\n\n{query}" if industry_ctx else query

    try:
        task_id: str = await client.acreate_task({"name": JobNames.LITERATURE, "query": full_query})
    except Exception as exc:
        yield {"type": "error", "data": {"message": f"Failed to submit Edison task: {exc}"}}
        return

    yield {"type": "submitted", "data": {"task_id": task_id}}

    start = asyncio.get_event_loop().time()

    while True:
        await asyncio.sleep(5)

        try:
            # Single verbose call: gives status + partial tool_history + contexts
            verbose_poll = await client.aget_task(task_id, verbose=True)
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
    return await research_event_stream(_run_literature_sse(query, industry_ctx))


@router.post("/analysis")
async def data_analysis(
    _payload: dict[str, Any] = Body(default_factory=dict),
) -> StreamingResponse:
    return await research_event_stream(_stub_research_events("analysis"))
