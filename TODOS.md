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
