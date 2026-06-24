---
name: grill-with-docs
description: >-
  Runs a documentation-backed decision loop before implementation planning or
  issue drafting, using current source, docs, and ADR evidence to ask one sharp
  question at a time, record resolved terms in CONTEXT.md when present, and
  create ADRs only for hard-to-reverse decisions with real trade-offs. Use when
  the user invokes /grill-with-docs or when another workflow requires the grill
  gate before implementation planning or issue creation.
license: Unlicense OR MIT
---

# Grill with docs

## Instructions

Run a real interrogation loop, not a generic documentation pass.

### Steps

1. Read the current repository docs, source, and nearest agent instructions relevant to the request.
2. Identify fuzzy terms, irreversible choices, data model boundaries, and workflow assumptions.
3. Ask one decision question at a time. Include a recommended answer and the trade-off.
4. Wait for the user answer before asking the next question.
5. When the answer settles project vocabulary, update `CONTEXT.md` if it exists.
6. Create an ADR only when the decision is hard to reverse and has a real alternative.
7. Stop when no product-shaping questions remain, then summarize the settled decisions and remaining implementation-time checks.

### Rules

- Do not treat this as "write docs carefully."
- Do not ask a bundle of unrelated questions at once.
- Do not implement product code during the grill unless the user explicitly asks.
- Prefer source evidence over memory.
- If source evidence conflicts with memory or prior docs, call out the conflict before recommending.
