# todorepl

A local-first command-line todo app with REPL and subcommand modes for human and agent workflows.
See [docs](docs/README.md) for architecture, setup, and project guidance.

## Install

```sh
bun install
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

## Contribution

Install with Bun and run `bun run check` before handoff. See [CONTRIBUTING.md](CONTRIBUTING.md).

## References

- [Agent instructions](AGENTS.md)
- [License](LICENSE)
