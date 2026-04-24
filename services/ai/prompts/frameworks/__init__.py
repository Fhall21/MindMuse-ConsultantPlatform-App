from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

PromptFrameworkKey = Literal[
    "care",
    "alec",
    "notice_open_listen_support",
    "grow",
    "clear",
    "oscar",
    "motivational_interviewing",
    "solution_focused_micro_frameworks",
    "stay",
    "dear",
    "lead",
    "appreciative_inquiry",
    "bridge",
    "trauma_informed_leadership_principles",
    "hop_4ds",
    "just_culture_approach",
    "orid",
    "what_so_what_now_what",
    "plus_delta",
    "team_support_loops",
    "restorative_workplace_practices",
    "abc",
    "psychological_safety",
    "smart_work_design_framework",
    "event_analysis",
]

_FRAMEWORK_FILES: dict[PromptFrameworkKey, str] = {
    "care": "care.md",
    "alec": "alec.md",
    "notice_open_listen_support": "notice-open-listen-support.md",
    "grow": "grow.md",
    "clear": "clear.md",
    "oscar": "oscar.md",
    "motivational_interviewing": "motivational-interviewing.md",
    "solution_focused_micro_frameworks": "solution-focused-micro-frameworks.md",
    "stay": "stay.md",
    "dear": "dear.md",
    "lead": "lead.md",
    "appreciative_inquiry": "appreciative_inquiry.md",
    "bridge": "bridge.md",
    "trauma_informed_leadership_principles": "trauma-informed-leadership-principles.md",
    "hop_4ds": "hop-4ds.md",
    "just_culture_approach": "just-culture-approach.md",
    "orid": "orid.md",
    "what_so_what_now_what": "what-so-what-now-what.md",
    "plus_delta": "plus-delta.md",
    "team_support_loops": "team-support-loops.md",
    "restorative_workplace_practices": "restorative-workplace-practices.md",
    "abc": "abc.md",
    "psychological_safety": "psychological_safety.md",
    "smart_work_design_framework": "smart.md",
    "event_analysis": "event-analysis.md",
}

_FRAMEWORK_LABELS: dict[PromptFrameworkKey, str] = {
    "care": "CARE (Check in, Actively listen, Reassure, Encourage help)",
    "alec": "ALEC (Ask, Listen, Encourage action, Check in)",
    "notice_open_listen_support": '"Notice-Open-Listen-Support" (Empathic Leadership)',
    "grow": "GROW (Goal, Reality, Options, Will)",
    "clear": "CLEAR (Clarify, Listen, Explore, Action, Review)",
    "oscar": "OSCAR (Outcome, Situation, Choices, Actions, Review)",
    "motivational_interviewing": "Motivational Interviewing (OARS & Change Talk)",
    "solution_focused_micro_frameworks": "Solution-Focused Micro-frameworks",
    "stay": "STAY (Stay present, Talk gently, Acknowledge pain, Yield judgement)",
    "dear": "DEAR (Describe, Express, Assert, Reinforce)",
    "lead": "LEAD (Listen, Example, Awareness, Discover)",
    "appreciative_inquiry": "Appreciative Inquiry (AI) 4-D Cycle",
    "bridge": "BRIDGE",
    "trauma_informed_leadership_principles": "Trauma-Informed Leadership Principles",
    "hop_4ds": "HOP 4Ds (Dangerous, Difficult, Dumb, Different)",
    "just_culture_approach": "Just Culture Approach",
    "orid": "ORID (Objective, Reflective, Interpretive, Decisional)",
    "what_so_what_now_what": '"What? So what? Now what?" Reflection',
    "plus_delta": "Plus / Delta (Start-Stop-Continue)",
    "team_support_loops": "Team Support Loops",
    "restorative_workplace_practices": "Restorative Workplace Practices",
    "abc": "ABC (Antecedent, Behaviour, Consequence)",
    "psychological_safety": "Psychological Safety Ladder",
    "smart_work_design_framework": "SMART Work Design Framework",
    "event_analysis": "Event Analysis (Before, During, After, Learning)",
}


@lru_cache(maxsize=None)
def load_framework_prompt(framework: PromptFrameworkKey) -> str:
    file_name = _FRAMEWORK_FILES[framework]
    return (Path(__file__).resolve().parent / file_name).read_text(encoding="utf-8")


def get_framework_prompt_label(framework: PromptFrameworkKey) -> str:
    return _FRAMEWORK_LABELS[framework]