# Vision

## Executive Summary

- todorepl is a local-first todo tool for terminals and agent workflows.
- The product has two equal entry modes: REPL mode and one-shot command mode.
- Todos are date-centric and may include optional time, duration, category, and emoji metadata.
- The first durable store is local file-backed storage; sync is not part of the initial vision.
- The project intentionally avoids web, desktop, and mobile UI layers.

## Product Direction

todorepl helps people and agents create, inspect, and update dated todos without leaving the command
line. It should feel predictable in scripts and comfortable in an interactive terminal.

The command surface must stay automation-friendly. Human output can be concise and pleasant, but
structured JSON output is a first-class product surface for workflows that need to read or mutate
todo state.

## Non-Goals

- No web, desktop, or mobile UI.
- No remote sync until a future `grill-with-docs` pass decides the storage and privacy model.
- No calendar, recurrence, or category schedule expansion until the MVP command surface is stable.
