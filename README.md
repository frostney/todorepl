# todorepl

A local-first command-line todo app with an AI agent shell and scriptable subcommands for human and
agent workflows. See [docs](docs/README.md) for architecture, setup, and project guidance.

## Install

Clone the repository and install dependencies with Bun:

```sh
bun install
```

After package publication, the package binary is `todorepl`. For local package-install validation,
install this checkout from another Bun project:

```sh
bun install /path/to/todorepl
./node_modules/.bin/todorepl --help
```

## Usage

Start the interactive AI agent (no arguments):

```sh
bun run todorepl
```

The agent understands natural language ("add buy milk tomorrow", "what's on my list for
Friday?") and calls the same todo and category operations the subcommands expose. Reads run
automatically; changes ask for your confirmation before they are applied.

Your todo database always stays on this machine — todorepl never uploads or syncs it, whatever model
you pick. By default the agent runs a local [Ollama](https://ollama.com)-compatible model, so nothing
leaves your machine at all. Set `TODOREPL_PROVIDER` to `ollama` (default), `openai-compatible`,
`anthropic`, `openai`, or `gateway` (the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway), one
key for many providers), plus `TODOREPL_MODEL`, `TODOREPL_BASE_URL`, and an API key —
`TODOREPL_API_KEY`, or a provider-standard key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or
`AI_GATEWAY_API_KEY` / a Vercel OIDC token for the gateway). See [`.env.example`](.env.example) for
each provider's settings. `openai-compatible` targets any OpenAI-compatible server (local or
self-hosted); `anthropic`, `openai`, and `gateway` are hosted clouds. Choosing a hosted provider does
not change where your todos are stored — it means your messages and the todo details the agent reads
are sent to that provider to generate replies.

Run one command (scriptable, no model required):

```sh
bun run todorepl -- list
bun run todorepl -- add "Draft launch notes"
```

The package binary accepts the same commands:

```sh
todorepl --help
todorepl list
todorepl add "Draft launch notes"
```

## Data Location

todorepl is local-first. The CLI resolves its default data file to the platform data directory:

- macOS: `~/Library/Application Support/todorepl/todos.db`
- Linux and other XDG platforms: `$XDG_DATA_HOME/todorepl/todos.db`, or
  `~/.local/share/todorepl/todos.db` when `XDG_DATA_HOME` is unset
- Windows: `%LOCALAPPDATA%\todorepl\todos.db`, or
  `~/AppData/Local/todorepl/todos.db` when `LOCALAPPDATA` is unset

Todos and categories are stored in a local SQLite database with a versioned schema and transactional
writes. Use `--data path` on supported commands to point at a different database file.

## Command Reference

Print root help:

```sh
todorepl --help
```

Add a todo:

```sh
todorepl add <name> [--date YYYY-MM-DD] [--category name] [--emoji char] [--data path] [--json]
```

List todos:

```sh
todorepl list [--date YYYY-MM-DD] [--status open|done] [--category name] [--data path] [--json]
```

The full command set (`show`, `done`, `edit`, `move`, `delete`, the `category` subcommands, and
`export` / `import`) and every flag are documented in [docs/quick-start.md](docs/quick-start.md).

## Agent workflows

Every data-returning command accepts `--json`, and commands signal outcomes through exit codes, so
todorepl drops into scripts and agents without screen-scraping. The JSON shapes and the full exit-code
table live in [docs/architecture.md](docs/architecture.md).

Create a todo and read its JSON. Each single-record command (`add`, `show`, `done`, `edit`, `move`,
`delete`) prints one Todo object:

```sh
todorepl add "Draft launch notes" --date 2026-06-24 --json
```

```json
{
  "id": "5f1c2e8a-9b3d-4c2a-8e7f-1a2b3c4d5e6f",
  "name": "Draft launch notes",
  "date": "2026-06-24",
  "status": "open",
  "order": 0,
  "createdAt": "2026-06-24T12:00:00.000Z",
  "updatedAt": "2026-06-24T12:00:00.000Z"
}
```

List todos as a JSON array:

```sh
todorepl list --status open --json
```

Back up the full data set to a file and restore it. `export` writes a deterministic
`{ version, todos, categories }` snapshot to stdout, and `import` reads one from `--file path` (or
stdin), validating the whole payload before it touches existing data:

```sh
todorepl export > backup.json
todorepl import --file backup.json
```

Pipe an export straight into another database file via stdin:

```sh
todorepl export | todorepl import --data ./mirror.todos.db
```

Branch on the exit code. A validation error (such as a malformed date) exits with code `2`, while a
successful command exits `0`:

```sh
if todorepl add "Bad date" --date not-a-date --json; then
  echo "added"
else
  status=$?
  if [ "$status" -eq 2 ]; then
    echo "validation error: check the input" >&2
  else
    echo "command failed with exit code $status" >&2
  fi
fi
```

## Contribution

Install with Bun and run `bun run check` before handoff. The same check gate runs in GitHub Actions.
See [CONTRIBUTING.md](CONTRIBUTING.md).

## References

- [Agent instructions](AGENTS.md)
- [License](LICENSE)
