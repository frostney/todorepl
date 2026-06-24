# Deployment

## Executive Summary

- todorepl is not deployed as a service.
- Release readiness means the package binary works as `todorepl`.
- GitHub Actions should run the same validation surfaces as local development.
- Publication should wait until the command surface is implemented beyond the scaffold.

## Package Readiness

The package exposes the `todorepl` binary from `package.json`. Before publication, verify the binary
works through a package install or link flow, not only through `bun run`.

## CI

CI should install with Bun and run:

```sh
bun run check
```

## Rollback

Until package publication exists, rollback is just a Git revert. Once releases exist, document the
package-manager-specific rollback path here.
