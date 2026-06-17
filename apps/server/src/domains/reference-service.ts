import type {
  ReferenceListRequest,
  ReferenceListResponse,
  ResearchArtifact,
} from "@product-competition/shared";

import type { SessionStore } from "../local/session-store.js";

const GROUP_PREFIX = "session:";

/**
 * Surface captured research artifacts to Tutti: top level lists sessions as
 * groups, and drilling into a session lists its Markdown/JSON artifacts as
 * app-data-relative file references.
 */
export async function buildReferenceList(
  request: ReferenceListRequest,
  store: SessionStore,
): Promise<ReferenceListResponse> {
  if (!request.parentGroupId) {
    const sessions = await store.listSessions();
    const filtered = sessions.filter((session) => {
      if (!request.filterText) return true;
      return session.title.toLowerCase().includes(request.filterText.toLowerCase());
    });

    const groups = [];
    for (const session of filtered.slice(0, request.limit ?? 20)) {
      const artifacts = await store.getArtifacts(session.id);
      if (artifacts.length === 0) continue;
      groups.push({
        type: "group" as const,
        id: `${GROUP_PREFIX}${session.id}`,
        displayName: session.title,
        description: session.productName
          ? `Research on ${session.productName}`
          : `${artifacts.length} artifact(s)`,
        referenceCount: artifacts.length,
      });
    }

    return { items: groups, nextCursor: null };
  }

  const sessionId = request.parentGroupId.startsWith(GROUP_PREFIX)
    ? request.parentGroupId.slice(GROUP_PREFIX.length)
    : null;
  if (!sessionId) {
    return { items: [], nextCursor: null };
  }

  const artifacts = (await store.getArtifacts(sessionId))
    .filter((artifact) => {
      if (!request.filterText) return true;
      const filterText = request.filterText.toLowerCase();
      return (
        artifact.title.toLowerCase().includes(filterText) ||
        (artifact.summary?.toLowerCase().includes(filterText) ?? false)
      );
    })
    .filter((artifact) => {
      if (!request.timeRange) return true;
      const createdAtMs = Date.parse(artifact.createdAt);
      const fromMs = request.timeRange.fromMs ?? Number.MIN_SAFE_INTEGER;
      const toMs = request.timeRange.toMs ?? Number.MAX_SAFE_INTEGER;
      return createdAtMs >= fromMs && createdAtMs <= toMs;
    })
    .slice(0, request.limit ?? 50);

  const items = artifacts.map((artifact) => ({
    type: "reference" as const,
    reference: {
      kind: "file" as const,
      displayName: displayName(artifact),
      ...(artifact.summary ? { description: artifact.summary } : {}),
      location: {
        type: "app-data-relative" as const,
        path: artifact.relativePath,
      },
      mimeType: mimeFor(artifact.relativePath),
      sizeBytes: artifact.sizeBytes,
      mtimeMs: Date.parse(artifact.createdAt),
      ...(request.filterText ? { score: 1 } : {}),
    },
  }));

  return { items, nextCursor: null };
}

function displayName(artifact: ResearchArtifact): string {
  const filename = artifact.relativePath.split("/").pop() ?? artifact.title;
  if (artifact.kind === "report") return `${artifact.title} (${filename})`;
  return `${artifact.title} (${filename})`;
}

function mimeFor(relativePath: string): string {
  if (relativePath.endsWith(".md")) return "text/markdown";
  if (relativePath.endsWith(".json")) return "application/json";
  return "text/plain";
}
