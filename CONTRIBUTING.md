# Contributing

## Executive Summary

- Use Bun for every local command.
- Keep changes scoped to the area named by the issue or implementation plan.
- Run `bun run check` before handoff.
- Update docs when commands, data shapes, or workflow rules change.

## Setup

```sh
bun install
```

## Workflow

Work from an issue or a confirmed mini-spec. The root `VISION.md`, `DEFINITION_OF_READY.md`, and
`DEFINITION_OF_DONE.md` define the product direction, start gate, and handoff gate.

Before handing off, run:

```sh
bun run check
```

## Commit Style

Use conventional commit prefixes such as `feat`, `fix`, `docs`, `test`, `build`, `ci`, `chore`,
`refactor`, `perf`, `style`, and `revert`.
