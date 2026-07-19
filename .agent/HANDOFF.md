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

1. PR opened via /create-pr for the vision/ADR/AGENTS.md changes.
2. Create issues: rename to todomcp; MCP server transport over src/app services; effort field +
   breakdown rule (>120 min threshold); OKF bundle read/write; iCal feed config + free-time
   computation; morning session skill + installer (MCP registration + scheduler per selected
   harness); velocity/nudging behavior; user-level skills packaging.
