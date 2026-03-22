# TODOS

Items explicitly deferred during engineering review. Each entry includes the motivation and where to start.

---

## AI Eval Suite for Consultation Group Suggestions

**What:** Build an evaluation suite for the `POST /rounds/suggest-consultation-groups` prompt.

**Why:** The AI grouping prompt has no golden dataset or regression baseline. Changes to the prompt or model are invisible — there is no way to know if suggestion quality has improved or degraded.

**How to start:**
- Create `services/ai/tests/evals/consultation_grouping/`
- Build 5+ fixture rounds with anonymised (or synthetic) consultation data and known-good groupings
- Run the endpoint against each fixture and compare output to the expected cluster shape
- Pin a model version in the fixture config so regressions are detectable

**Depends on:** Having real (or credible synthetic) consultation data to build fixtures from. Do not build this with made-up data that doesn't reflect real consultation theme patterns.

**Blocked by:** Nothing technical — blocked by availability of good fixture data.

---

## Phase 2: AI Inference on Transcript Upload

**What:** When a user uploads a transcript to a meeting, automatically infer:
- Meeting type (match against user's `meeting_types`)
- Meeting date (extracted from transcript header or content)
- People present (match against user's `people` list)

**Why:** Deferred from the structured meeting creation work (Stage 9). The seam exists — `TranscriptIntakePanel` fires after upload — but the inference logic and confirmation UX are not built.

**How to start:**
- Add a `POST /api/client/meetings/:id/infer-from-transcript` route
- The AI service extracts date, type hint, and speaker names from `transcript_raw`
- Return a structured diff: `{ suggestedTypeCode, suggestedDate, suggestedPeople[] }`
- Show the user a confirmation dialog before applying changes
- Apply via `updateMeetingFields` and `linkPersonToMeeting`

**Depends on:** `meeting_types` and `meetings.meeting_type_id` being populated (done). Transcript ingestion pipeline (done).

**Blocked by:** Nothing — ready to build. Phase 2 scope.

