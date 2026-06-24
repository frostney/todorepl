# todorepl

A local-first command-line todo app with REPL and subcommand modes for human and agent workflows.
See [docs](docs/README.md) for architecture, setup, and project guidance.

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

Start the interactive shell:

```sh
bun run todorepl
```

Run one command:

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

- macOS: `~/Library/Application Support/todorepl/todos.json`
- Linux and other XDG platforms: `$XDG_DATA_HOME/todorepl/todos.json`, or
  `~/.local/share/todorepl/todos.json` when `XDG_DATA_HOME` is unset
- Windows: `%LOCALAPPDATA%\todorepl\todos.json`, or
  `~/AppData/Local/todorepl/todos.json` when `LOCALAPPDATA` is unset

Use `--data path` on supported commands to point at a different local file. The current scaffold
resolves and reports the data path, but persistent todo storage is not implemented yet.

## Command Reference

Print root help:

```sh
todorepl --help
```

Add a todo scaffold record:

```sh
todorepl add [--data path] [--json] <name>
```

List todo scaffold records:

```sh
todorepl list [--data path] [--json]
```

## Contribution

Install with Bun and run `bun run check` before handoff. The same check gate runs in GitHub Actions.
See [CONTRIBUTING.md](CONTRIBUTING.md).

## References

- [Agent instructions](AGENTS.md)
- [License](LICENSE)
