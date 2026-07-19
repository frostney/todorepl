# MCP Server as Primary Interface with Push-Based Delivery

## Context

The original vision framed todorepl as a project-local, pull-based CLI: a human or agent runs
`todorepl <command>` when they want something. A `grill-with-docs` session on 2026-07-19 re-examined
the scope against the intended workflow (loose dictation intake, grilling, prioritisation with
calendar and effort awareness, OKF context recording, velocity nudging) and surfaced a requirement
the CLI shape cannot satisfy: the system must work across all projects without the user deciding
which skill or command to invoke, and it must initiate contact (push) rather than wait to be asked
(pull).

Evidence checked: current `src/` layout (Stricli CLI, shared `src/app/` services, SQLite store in
`src/storage/`), the existing `--json` agent surface documented in `docs/architecture.md`, the OKF
v0.1 specification (GoogleCloudPlatform/knowledge-catalog), and PlanStack's read-only iCal feed
configuration (`CalendarCard` + `calendarFeeds`).

## Decision

The primary interface becomes a globally registered MCP server over the same `src/app/` services and
SQLite store the CLI uses today. Push arrives through two channels: the MCP server available in
every harness session across all projects, and a locally scheduled morning session that initiates
re-alignment grilling. The Stricli CLI and REPL are kept as a secondary transport for human
inspection, scripting, and export/import, with no new feature investment by default. Session-start
context injection and OS-level notification daemons were considered as push channels and rejected to
keep app surface minimal. The project will be renamed `todomcp` to match this identity, decided
before first package publication while the rename is still cheap.

## Consequences

Easier: any MCP-capable harness (Claude, Codex, future clients) shares one todo store and one
protocol; the intelligence layer ships as user-level skills instead of per-project configuration;
the existing domain, app, and storage layers are reused unchanged as the substrate.

Harder: the repo now maintains two thin transports (MCP and CLI) over one core, and the scheduled
morning session depends on a local scheduler that must be reliable; because the data is local, the
session cannot run as a cloud agent.

Revisit: whether the CLI keeps earning its place once MCP covers all workflows. The scheduler
question is settled: a setup command ships with the project, registering the MCP server and
installing the morning-session scheduler into the harness the user selects.
