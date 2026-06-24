# Architecture

## Executive Summary

- todorepl is a Bun-first TypeScript CLI with no UI layer.
- Stricli owns command routing and generated help.
- REPL mode and command mode share the same domain and application behavior.
- Todos are date-centric and follow the PlanStack-inspired data shape.
- Local file-backed storage is the first durable persistence target.

## Product Shape

todorepl is a local-first command-line todo app for humans and agents. It has two entry modes:

- `todorepl` starts an interactive shell.
- `todorepl <command>` runs a single automation-friendly command.

Todos are date-centric, following the PlanStack model where every todo belongs to a `YYYY-MM-DD`
date and may also have a scheduled minute-of-day, duration, category, and emoji.

## Runtime Shape

- Bun runs the CLI directly from TypeScript.
- Stricli owns command routing and generated help.
- Domain validation lives outside the CLI so the REPL and command mode share behavior.
- Storage will be local-first and file-backed before any sync concept exists.

## Source Boundaries

- `src/cli/` handles Stricli routing, output, and the REPL shell.
- `src/domain/` owns domain types and validation.
- `src/storage/` owns persistence contracts and implementations.
- `scripts/` owns project checks and one-off automation.

## Agent Workflow Shape

Every command that returns data should eventually support `--json`. Human output can be pleasant, but
machine-readable output is part of the product surface, not a debug option.

## Drift Check

The project drift check in `scripts/check-drift.ts` compares documented structure claims with the
actual repo shape. It currently checks governance docs, docs template files, symlinks, required
scripts, Bun-only lockfiles, and generated-skill handling.
