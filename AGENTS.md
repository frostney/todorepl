# Agent Instructions

## Hard Constraints

- Always validate. If source code is available, validate with source code.
- Bun is the only package manager and runtime for this repository; do not add npm, pnpm, or yarn lockfiles.
- The CLI is built with TypeScript and Stricli. Do not replace Stricli without a documented product reason. Stricli powers every `todorepl <subcommand>` invocation.
- This is a command-line todo app. Do not add a web, desktop, or mobile UI. A terminal UI (TUI) is in scope.
- The no-argument interactive mode is an AI agent terminal UI (`@ai-sdk/tui` running a `ToolLoopAgent`), backed by the todo/category services exposed as tools. Keep the model provider configurable with a local default; never make a cloud model the default.

## Runtime / Commands

Run the real gate before handing off:

```sh
bun install
bun run check
```

Useful focused commands:

```sh
bun run todorepl -- --help
bun test
bun run lint
bunx tsc --noEmit
```

The no-argument `bun run todorepl` launches the interactive agent. By default it
expects a local Ollama-compatible server (`http://localhost:11434/v1`). Configure the
model with `TODOREPL_PROVIDER` (`ollama` | `openai-compatible` | `anthropic` | `openai` | `gateway`),
`TODOREPL_MODEL`, `TODOREPL_BASE_URL`, and `TODOREPL_API_KEY` (see `.env.example`). The `gateway`
provider is the Vercel AI Gateway (`AI_GATEWAY_API_KEY` or a Vercel OIDC token), with namespaced
model ids such as `anthropic/claude-sonnet-4.6`.

## Code Organization

- `src/cli/` owns Stricli command routing, terminal output, and the interactive agent entrypoint (`agent-repl.ts`).
- `src/cli/agent/` owns the AI agent: model/provider resolution (`model.ts`), the todo/category tool surface (`tools.ts`), and system instructions (`instructions.ts`).
- `src/app/` owns application services (todo/category) shared by command mode and the agent.
- `src/domain/` owns todo, category, date, and time domain types and validation.
- `src/storage/` owns local persistence contracts and implementations.
- `docs/` owns architecture, tooling, and project documentation.
- `.agents/skills/` contains generated or project-local skills used by agents.

## Testing

- Use `bun test`.
- Co-locate unit tests beside the public module they exercise, using `*.test.ts`.
- Reserve top-level test folders for future end-to-end or layer-specific suites.
- Prefer testing the domain parser/validation and CLI command behavior over implementation details.

## Safety / Boundaries

- Local todo data must stay on the local machine unless an explicit export or sync feature is implemented. The interactive agent never uploads the todo database, and defaults to a local model so nothing leaves the machine. Selecting a cloud provider (`TODOREPL_PROVIDER=anthropic|openai|gateway`) is an explicit, user-initiated choice that transmits the live conversation — the user's messages and the todos the agent reads to answer — to that provider for inference; it does not change where todos are stored. The startup banner (`src/cli/agent/privacy.ts`) must keep these two facts (storage vs. transmission) separate.
- Do not write secrets or private task content into logs, docs, examples, or test snapshots.
- Agent-facing output should support automation: stable text for humans, JSON for tools where commands return structured data.
