# Definition Of Done

## Executive Summary

- The implemented behavior satisfies the issue or confirmed mini-spec.
- Tests and docs change with the behavior.
- `bun run check` is green.
- Handoff names what was validated and any residual risk.

## Done Checklist

A change is done when:

- The requested behavior works through the relevant public surface.
- Unit, command, or layer-specific tests cover meaningful regressions.
- Documentation reflects any changed commands, data shapes, setup, or workflow rules.
- `bun run check` passes.
- `git diff --check` passes before handoff.
- Generated skills under `.agents/skills` are only changed by the skills tool.
