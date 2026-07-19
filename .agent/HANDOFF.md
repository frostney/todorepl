# Handoff

## Current task

Scope/vision re-grill completed 2026-07-19 on branch `claude/todo-db-scope-vision-28cb62`. VISION.md
rewritten, ADR 0001 added, AGENTS.md hard constraints updated. Check gate passes. Nothing committed
yet.

## Decisions made (see docs/adr/0001-mcp-primary-push-architecture.md and VISION.md)

- Cross-project, push-not-pull system; user never picks a skill to run.
- Primary interface: globally registered MCP server over the existing SQLite store; push channels
  are the MCP server plus a locally scheduled morning re-alignment session. Session-start injection
  and OS notifications rejected.
- CLI/REPL kept as secondary transport (inspection, scripting, export/import); no new CLI features
  by default.
- OKF (Google Open Knowledge Format) bundle records living context per todo/theme; grilling updates
  those docs; SQLite stays state of record.
- Priority = existing date+order (position is priority). Add an `effort` field; effort above a
  threshold triggers a breakdown suggestion during grilling.
- Calendar: configurable multiple read-only iCal feeds (PlanStack model), fetched at planning time,
  nothing stored.
- Rename to `todomcp` decided (pre-publication, so cheap). Not yet executed.

## Open questions

- None product-shaping. Scheduler mechanics per harness (launchd vs harness-native) resolve inside
  the installer implementation.

## Next steps

1. PR #13 opened for the vision/ADR/AGENTS.md changes.
2. Issues created for the build-out: #14 rename + data migration (lands first), #15 MCP server
   transport, #16 effort field + 120-minute breakdown flag, #17 OKF bundle, #18 iCal feeds +
   free-time computation, #19 installer (MCP registration + scheduler per selected harness),
   #20 workflow skills (intake, grilling, prioritisation, morning re-alignment, velocity
   nudging). Follow-up grill settled: full rename including GitHub repo and data-dir migration.
3. Implement in dependency order: #14 first; #15 unlocks #17/#18/#20; #19 installs #20.
