# Code Style

## Executive Summary

- Keep TypeScript strict and intention-revealing.
- Keep CLI, domain, storage, and scripts in separate ownership folders.
- Co-locate unit tests beside the public module they exercise.
- Prefer shared domain/application functions over duplicated agent and command behavior.

## TypeScript

Use named exports and clear type names. Avoid adding abstractions until two call sites need the same
shape for the same reason.

## File Layout

- `src/cli/` owns command routing, terminal output, and the interactive agent entrypoint (`agent-repl.ts`).
- `src/domain/` owns todo/category types and validation.
- `src/storage/` owns persistence contracts and implementations.
- `scripts/` owns project checks and one-off automation.

## Tests

Unit tests live beside the module they exercise and use the `*.test.ts` suffix. Broader CLI or
end-to-end tests may use a top-level suite once the command surface is implemented.

## Imports

Biome organizes imports. Do not manually fight its order.
