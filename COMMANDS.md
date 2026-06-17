# Commands

## Workspace

- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm typecheck`
- `pnpm package:tutti`

## App behavior

- `GET /api/health`: liveness probe (also reports whether the skill is bundled)
- `GET /api/bootstrap`: list sessions, the active session, and detected local agent providers
- `POST /api/sessions`: create a research conversation
- `PATCH /api/sessions/:id`: activate or rename a session
- `DELETE /api/sessions/:id`: delete a session and its artifacts
- `GET /api/sessions/:id/messages`: load a session's messages and artifacts
- `GET /api/sessions/:id/artifacts/:artifactId/content`: read a captured artifact (report.md etc.)
- `GET /api/agent/stream` (WebSocket): run a research turn; `{type:"start", sessionId, prompt, provider, model}` / `{type:"cancel", runId}`
- `POST /tutti/references/list`: list captured research artifacts as Tutti references
