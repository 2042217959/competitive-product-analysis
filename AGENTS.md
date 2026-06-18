# Competitive Analysis Agent Guide

## Repo layout

- `apps/web`: chat-first browser UI (session sidebar, chat thread, agent selector, artifact rail, research library)
- `apps/server`: local runtime, session/artifact persistence, agent runtime, Tutti integration endpoints
- `apps/server/skills/product-swipefile`: the vendored research skill that drives every run
- `apps/server/src/runtimes`: local-agent provider, skill loader, prompt envelope
- `packages/shared`: shared types and schemas consumed by both sides
- `scripts/package-tutti-app.mjs`: creates the self-contained Tutti package

## Product shape

The app is a conversation. The user asks to research a product ("调研一下 Notion"),
and a local agent (Claude by default, Codex also supported) runs the bundled
product-swipefile skill to produce an evidence-backed teardown. Artifacts
(`report.md`, `inventory.md`, `meta.json`, `raw/`) are captured into a unified
per-session store and surfaced as Tutti references.

## Agent flow

- `ResearchRunService` (`apps/server/src/domains/research-run-service.ts`) orchestrates one chat turn: persist the user message, run the agent, stream events, capture artifacts, persist the assistant message.
- Real work runs through `LocalAgentResearchProvider`, which calls `@tutti-os/agent-acp-kit`'s `createLocalAgentRuntime().run()`. The product-swipefile skill is injected via `skillManifest`; the kit materializes it into the run cwd before launch.
- The run cwd is `dataDir/sessions/<sessionId>/runs/<runId>`. After the run, `scanRunArtifacts` indexes the Markdown/JSON artifacts the skill wrote there.
- Streaming events use the `AgentRunEvent` contract in `packages/shared` and flow over `/api/agent/stream`. The web client folds them into the assistant message's `contentBlocks`.
- There is no offline rule-engine fallback: a local Claude/Codex agent is required.

## Runtime notes

- Development server API defaults to `http://127.0.0.1:4310`
- Generated app packages must bind `TUTTI_APP_HOST:TUTTI_APP_PORT`
- Durable app data (sessions, messages, artifacts) belongs under `TUTTI_APP_DATA_DIR`
- The agent uses `TUTTI_APP_PYTHON` (falling back to `python3`) to run the skill helpers
- Captured artifacts are exposed through `/tutti/references/list`

## Modification rules

- Keep domain contracts in `packages/shared`
- Keep UI orchestration in `apps/web`, not in server-only modules
- Keep the vendored skill intact; update it by re-vendoring from upstream rather than hand-editing
- Preserve Tutti manifest and `bootstrap.sh` compatibility when changing runtime behavior
