# Architecture

## Why this shape

This repo follows the `group-chat`-style Tutti workspace app layout described by the provided `SKILL.md`:

- `apps/web` owns the browser-first research workspace
- `apps/server` owns persistence, report generation, and Tutti runtime integration
- `packages/shared` owns the domain types and HTTP contracts

## First-version product slice

The current implementation focuses on a strong vertical slice instead of premature platform breadth:

1. Research brief editing
2. Competitor roster management
3. Report generation with markdown output
4. Tutti references for generated files
5. Local agent provider detection via `@tutti-os/agent-acp-kit`

## Storage

- Dev default: `generated/data/workspace.json`
- Packaged runtime: `TUTTI_APP_DATA_DIR`
- Generated report files: `reports/<project-slug>/<date>-<title>.md`

## Next steps

- Add agent-run orchestration for assisted synthesis or evidence expansion
- Add richer project switching and report history exploration
- Expand the reference endpoint to support evidence snippets and grouped artifacts
