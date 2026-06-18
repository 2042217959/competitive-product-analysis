import path from "node:path";
import { readFile } from "node:fs/promises";

import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import {
  agentRunClientMessageSchema,
  createSessionInputSchema,
  referenceListRequestSchema,
  API_ROUTES,
  type AgentRunEvent,
} from "@product-competition/shared";

import { createRuntimeConfig } from "./config.js";
import { detectAgentProviders, pickDefaultProvider } from "./domains/agent-service.js";
import { buildReferenceList } from "./domains/reference-service.js";
import { ResearchRunService } from "./domains/research-run-service.js";
import { SessionStore } from "./local/session-store.js";
import { LocalAgentResearchProvider } from "./runtimes/local-agent-provider.js";

const runtimeConfig = await createRuntimeConfig();
const app = Fastify({ logger: false });
const store = new SessionStore(runtimeConfig.paths);
const provider = new LocalAgentResearchProvider();
const researchRuns = new ResearchRunService(runtimeConfig, store, provider);

// Heal state left behind by a previous process before serving traffic: recover
// sessions missing from the index and demote runs stuck in "running".
await store.reconcileOnStartup().catch(() => undefined);

await app.register(fastifyWebsocket);

if (runtimeConfig.paths.webDistDir) {
  await app.register(fastifyStatic, {
    root: runtimeConfig.paths.webDistDir,
    prefix: "/",
    index: ["index.html"],
  });
}

app.get(API_ROUTES.health, async () => ({
  ok: true,
  name: "product-competition",
  version: "0.1.3",
  skillAvailable: Boolean(runtimeConfig.paths.skillDir),
}));

app.get(API_ROUTES.bootstrap, async () => {
  // Continuously self-heal: surface any on-disk session that fell out of the
  // index (without touching active runs, which only this process knows about).
  await store.recoverOrphanSessions().catch(() => undefined);
  const [sessions, activeSessionId, agentProviders] = await Promise.all([
    store.listSessions(),
    store.getActiveSessionId(),
    detectAgentProviders(),
  ]);
  return {
    sessions,
    activeSessionId,
    agentProviders,
    defaultProvider: pickDefaultProvider(agentProviders),
  };
});

app.post(API_ROUTES.sessions, async (request, reply) => {
  const result = createSessionInputSchema.safeParse(request.body ?? {});
  if (!result.success) {
    return reply.status(400).send({ error: "invalid_session", details: result.error.flatten() });
  }
  return store.createSession(result.data);
});

app.patch("/api/sessions/:sessionId", async (request, reply) => {
  const { sessionId } = request.params as { sessionId: string };
  const body = (request.body ?? {}) as { active?: boolean; title?: string };
  const session = await store.getSession(sessionId);
  if (!session) {
    return reply.status(404).send({ error: "session_not_found" });
  }
  if (body.active) {
    await store.setActiveSessionId(sessionId);
  }
  if (typeof body.title === "string" && body.title.trim()) {
    await store.updateSession(sessionId, { title: body.title.trim() });
  }
  return (await store.getSession(sessionId)) ?? session;
});

app.delete("/api/sessions/:sessionId", async (request) => {
  const { sessionId } = request.params as { sessionId: string };
  // Stop any in-flight run first; otherwise an orphaned run keeps executing and
  // recreates the session's run directory after we remove it.
  await researchRuns.cancelSession(sessionId);
  await store.deleteSession(sessionId);
  const activeSessionId = await store.getActiveSessionId();
  return { ok: true, activeSessionId };
});

app.get("/api/sessions/:sessionId/messages", async (request, reply) => {
  const { sessionId } = request.params as { sessionId: string };
  const session = await store.getSession(sessionId);
  if (!session) {
    return reply.status(404).send({ error: "session_not_found" });
  }
  await store.setActiveSessionId(sessionId);
  const [messages, artifacts] = await Promise.all([
    store.getMessages(sessionId),
    store.getArtifacts(sessionId),
  ]);
  return { session, messages, artifacts };
});

app.get("/api/sessions/:sessionId/artifacts/:artifactId/content", async (request, reply) => {
  const { sessionId, artifactId } = request.params as { sessionId: string; artifactId: string };
  const artifacts = await store.getArtifacts(sessionId);
  const artifact = artifacts.find((item) => item.id === artifactId);
  if (!artifact) {
    return reply.status(404).send({ error: "artifact_not_found" });
  }
  const absolute = path.resolve(runtimeConfig.paths.dataDir, artifact.relativePath);
  const dataRoot = path.resolve(runtimeConfig.paths.dataDir);
  if (!absolute.startsWith(dataRoot + path.sep)) {
    return reply.status(400).send({ error: "invalid_artifact_path" });
  }
  try {
    const content = await readFile(absolute, "utf8");
    return {
      artifact,
      content,
      mimeType: artifact.relativePath.endsWith(".json") ? "application/json" : "text/markdown",
    };
  } catch {
    return reply.status(404).send({ error: "artifact_unreadable" });
  }
});

// Streaming research runs. One run per socket connection.
app.get(API_ROUTES.agentStream, { websocket: true }, (socket) => {
  // Track the run bound to this socket so we can cancel it if the client
  // disconnects (refresh/navigate). Partial output is already persisted, so the
  // cancelled run finalizes cleanly instead of leaking as an orphan.
  let activeRunId: string | null = null;
  let finished = false;

  const emit: (event: AgentRunEvent) => void = (event) => {
    if (event.type === "run_started") activeRunId = event.runId;
    if (event.type === "run_finished") {
      finished = true;
      activeRunId = null;
    }
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(event));
    }
  };

  socket.on("message", (raw: Buffer) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const message = agentRunClientMessageSchema.safeParse(parsed);
    if (!message.success) {
      emit({ type: "run_failed", runId: "unknown", message: "Invalid agent run request" });
      return;
    }
    if (message.data.type === "cancel") {
      void researchRuns.cancel(message.data.runId);
      return;
    }
    void researchRuns.start(message.data, emit);
  });

  socket.on("close", () => {
    if (!finished && activeRunId) {
      void researchRuns.cancel(activeRunId);
    }
  });
});

app.post(API_ROUTES.referencesList, async (request, reply) => {
  const result = referenceListRequestSchema.safeParse(request.body);
  if (!result.success) {
    return reply.status(400).send({ error: "invalid_reference_request", details: result.error.flatten() });
  }
  return buildReferenceList(result.data, store);
});

if (runtimeConfig.paths.webDistDir) {
  app.get("/", async (_request, reply) => {
    const html = await readFile(
      path.join(runtimeConfig.paths.webDistDir as string, "index.html"),
      "utf8",
    );
    reply.type("text/html").send(html);
  });
}

await app.listen({
  host: runtimeConfig.host,
  port: runtimeConfig.port,
});
