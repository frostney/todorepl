# Architecture

## Executive Summary

- todorepl is a Bun-first TypeScript CLI with no UI layer.
- Stricli owns command routing and generated help.
- The interactive AI agent and command mode share the same domain and application behavior.
- Todos are date-centric and follow the PlanStack-inspired data shape.
- Local file-backed storage is the first durable persistence target.

## Product Shape

todorepl is a local-first command-line todo app for humans and agents. It has two entry modes:

- `todorepl` starts an interactive AI agent that reads natural language.
- `todorepl <command>` runs a single automation-friendly command.

Both modes drive the SAME `src/app/` application services, so there is no duplicated logic and no
behavior drift between them. Command mode adapts those services to Stricli commands; the agent
exposes them as tools an LLM can call (see [Interactive Agent](#interactive-agent)).

Todos are date-centric, following the PlanStack model where every todo belongs to a `YYYY-MM-DD`
date and may also have a scheduled minute-of-day, duration, category, and emoji.

## Interactive Agent

Running `todorepl` with no arguments starts a terminal UI agent built on the AI SDK
(`@ai-sdk/tui` running a `ToolLoopAgent`). The agent:

- Exposes the todo and category services as tools (`src/cli/agent/tools.ts`). Read tools
  (`list_todos`, `get_todo`, `list_categories`) run automatically; mutating tools set
  `needsApproval`, so the terminal UI asks the user to confirm before anything changes.
- Resolves its model from `TODOREPL_*` environment variables (`src/cli/agent/model.ts`). The todo
  database stays on the machine for every provider; the default local Ollama-compatible model keeps
  everything on-device. The `anthropic`, `openai`, and `gateway` (Vercel AI Gateway, with namespaced
  model ids like `anthropic/claude-sonnet-4.6`) providers are an explicit opt-in that transmits the
  conversation — the user's messages and the todos the agent reads — to that provider for inference,
  never the database. The banner (`src/cli/agent/privacy.ts`) states this split at startup.
- Anchors its instructions to the current local date (`src/cli/agent/instructions.ts`) so relative
  dates like "tomorrow" resolve correctly.

Before launching a local provider, the agent checks the model server is reachable and, if not, prints
setup guidance and exits non-zero. Tool failures (such as validation errors) are returned to the model
as a recoverable `{ error }` value rather than crashing the session.

## Runtime Shape

- Bun runs the CLI directly from TypeScript.
- Stricli owns command routing and generated help.
- Domain validation lives outside the CLI so the agent and command mode share behavior.
- Command mode and the agent call the same application services in `src/app/`, so both entry modes
  share one behavior path over the domain and storage layers.
- Storage will be local-first and file-backed before any sync concept exists.

## Source Boundaries

- `src/cli/` handles Stricli routing, output, and the interactive agent entrypoint (`agent-repl.ts`).
- `src/cli/agent/` holds the AI agent: model/provider resolution, the todo/category tool surface, and
  the system instructions.
- `src/app/` holds UI-agnostic application services (for example `todo-service.ts`) shared by command
  mode and the agent; they orchestrate domain validation and storage so both entry modes share one
  code path. It sits between `src/domain/` and `src/storage/`, and `src/cli/` adapts it to Stricli
  and the agent's tools.
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
  the agent and command mode; it is defined in `src/storage/repository.ts` and implemented in
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

Every command that returns data supports `--json`. Human output can be pleasant, but machine-readable
output is part of the product surface, not a debug option. With `--json`, single-record commands
(`add`, `show`, `done`, `edit`, `move`, `delete`) print one Todo object; `list` prints a Todo array;
the `category` subcommands print a Category object (or, for `category list`, a Category array);
`export` prints the snapshot object; and `import --json` prints an import summary.

### Todo JSON shape

A Todo object always carries these fields:

- `id` (string): stable unique id.
- `name` (string): todo text.
- `date` (string): `YYYY-MM-DD` the todo belongs to.
- `status` (string): `"open"` or `"done"`.
- `order` (number): position within its date.
- `createdAt`, `updatedAt` (string): ISO-8601 timestamps.

Optional fields are present only when set:

- `categoryId` (string): id of the referenced category.
- `emoji` (string).
- `scheduledTime` (number): minute of day (`0`-`1439`, divisible by 15).
- `duration` (number): one of `15`, `30`, `60`.
- `completedAt` (string): ISO-8601 timestamp set when the todo is completed.
- `deletedAt` (string): ISO-8601 timestamp set when the todo is soft-deleted.

### Category JSON shape

A Category object always carries `id`, `name`, `createdAt`, and `updatedAt`, plus optional `color`
and `emoji` when set.

### Export and import

`export` writes all active (non-soft-deleted) todos and categories as a JSON snapshot to stdout. The snapshot is
`{ version, todos, categories }`, where `version` is the current schema version (`1`), `todos` is a
Todo array, and `categories` is a Category array. Output is deterministic: todos are ordered by
`date`, then `order`, then `id`, and categories by `name`, then `id`.

`import` reads a snapshot from `--file <path>` or, when no file is given, from stdin. It validates the
ENTIRE payload before mutating anything: malformed JSON, a missing or wrong-typed `version` / `todos`
/ `categories`, or any invalid record is rejected as a validation error, and existing data is left
unchanged. A valid import replaces the data set inside a single transaction. With `--json`, `import`
prints `{ "imported": { "todos": N, "categories": M } }`; otherwise it prints a human-readable count.

### Exit codes

Commands signal outcomes through process exit codes so scripts can branch without parsing output:

- `0`: Success.
- `1`: Other or unexpected error, including an unknown command or bad flags.
- `2`: Validation or invalid input (also an ambiguous id prefix).
- `3`: Record not found.
- `4`: Storage failure (corrupt database or unsupported schema version).

## Drift Check

The project drift check in `scripts/check-drift.ts` compares documented structure claims with the
actual repo shape. It currently checks governance docs, docs template files, symlinks, required
scripts, Bun-only lockfiles, and generated-skill handling.
