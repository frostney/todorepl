# Architecture

## Executive Summary

- todorepl is a Bun-first TypeScript CLI with no UI layer.
- Stricli owns command routing and generated help.
- REPL mode and command mode share the same domain and application behavior.
- Todos are date-centric and follow the PlanStack-inspired data shape.
- Local file-backed storage is the first durable persistence target.

## Product Shape

todorepl is a local-first command-line todo app for humans and agents. It has two entry modes:

- `todorepl` starts an interactive shell that reads commands from a `todo>` prompt.
- `todorepl <command>` runs a single automation-friendly command.

The interactive shell is a thin layer: it tokenizes each input line (honoring quotes so values with
spaces stay intact) and dispatches the tokens through the SAME Stricli app and `src/app/` application
services as command mode, so there is no duplicated command logic and no behavior drift between the
two modes. `help` shows command help and `exit` or `quit` ends the session. Command errors are
non-fatal in the shell: an unknown or invalid command prints an error and the prompt stays open.

Todos are date-centric, following the PlanStack model where every todo belongs to a `YYYY-MM-DD`
date and may also have a scheduled minute-of-day, duration, category, and emoji.

## Runtime Shape

- Bun runs the CLI directly from TypeScript.
- Stricli owns command routing and generated help.
- Domain validation lives outside the CLI so the REPL and command mode share behavior.
- Command mode and the REPL call the same application services in `src/app/`, so both entry modes
  share one behavior path over the domain and storage layers.
- Storage will be local-first and file-backed before any sync concept exists.

## Source Boundaries

- `src/cli/` handles Stricli routing, output, and the REPL shell.
- `src/app/` holds UI-agnostic application services (for example `todo-service.ts`) shared by command
  mode and the REPL; they orchestrate domain validation and storage so both entry modes share one
  code path. It sits between `src/domain/` and `src/storage/`, and `src/cli/` adapts it to Stricli
  and the REPL.
- `src/domain/` owns domain types and validation.
- `src/storage/` owns persistence contracts and implementations.
- `scripts/` owns project checks and one-off automation.

## Persistence

- All todos and categories live in a single local SQLite database file (`todos.db`), opened through
  Bun's built-in `bun:sqlite` so no extra dependency is required.
- Data is split across a `todos` table and a `categories` table, with indexes on `(date, status)`
  and `category_id` so date, status, and category filters run as indexed SQL rather than scanning
  every row in memory.
- The schema is versioned through SQLite's `PRAGMA user_version`; opening a database with an
  unsupported or newer version fails with an actionable error.
- Writes that touch many rows (for example, import) run inside an ACID transaction, so an
  interrupted write never leaves a half-applied state behind.
- A missing database bootstraps cleanly: the file and schema are created on first open.
- Corrupt or unreadable files fail with an actionable error that points the user at the file to
  inspect or remove.
- The repository exposes a query-shaped contract (`listTodos(filter)`, `getTodo` / `putTodo`,
  `listCategories` / `getCategory` / `putCategory`, `exportSnapshot` / `importSnapshot`) shared by
  REPL and command mode; it is defined in `src/storage/repository.ts` and implemented in
  `src/storage/sqlite-store.ts`.

## Categories

- Categories are first-class records with a name and optional color and emoji; they have no schedules
  in the MVP.
- Todos reference a category through `categoryId`, and category arguments resolve by exact id or
  exact (unique) name, so `--category <name-or-id>` on todo commands must point at an existing
  category or the command fails.
- Deleting a category that is referenced by todos is refused unless `--force` is given; with `--force`
  the category is removed and un-assigned from those todos, clearing their category.

## Agent Workflow Shape

Every command that returns data should eventually support `--json`. Human output can be pleasant, but
machine-readable output is part of the product surface, not a debug option.

## Drift Check

The project drift check in `scripts/check-drift.ts` compares documented structure claims with the
actual repo shape. It currently checks governance docs, docs template files, symlinks, required
scripts, Bun-only lockfiles, and generated-skill handling.
