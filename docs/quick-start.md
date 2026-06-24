# Quick Start

## Executive Summary

- Install dependencies with `bun install`.
- Run the CLI with `bun run todorepl -- --help`.
- Start REPL mode with `bun run todorepl`.
- Run the full local gate with `bun run check`.

## Install

```sh
bun install
```

## Run

Print command help:

```sh
bun run todorepl -- --help
```

Start the interactive shell:

```sh
bun run todorepl
```

Run one command:

```sh
bun run todorepl -- list
```

Resolve a specific local data file path:

```sh
bun run todorepl -- add "Draft launch notes" --data ./local.todos.db
```

The package binary exposes the same command surface after local linking or package install:

```sh
todorepl --help
```

## Data Location

By default, todorepl resolves its local data file to:

- macOS: `~/Library/Application Support/todorepl/todos.db`
- Linux and other XDG platforms: `$XDG_DATA_HOME/todorepl/todos.db`, or
  `~/.local/share/todorepl/todos.db` when `XDG_DATA_HOME` is unset
- Windows: `%LOCALAPPDATA%\todorepl\todos.db`, or
  `~/AppData/Local/todorepl/todos.db` when `LOCALAPPDATA` is unset

Use `--data path` to override the local file path for commands that accept data. Todos and categories
are stored in a local SQLite database with a versioned schema and transactional writes, and
`--data <path>` selects an alternate database file.

## Command Reference

```text
todorepl add [--data path] [--json] <name>
todorepl list [--data path] [--json]
todorepl --help
todorepl --version
```

## Validate

```sh
bun run check
```
