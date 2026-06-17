export const API_ROUTES = {
  health: "/api/health",
  bootstrap: "/api/bootstrap",
  sessions: "/api/sessions",
  session(sessionId: string) {
    return `/api/sessions/${sessionId}`;
  },
  sessionMessages(sessionId: string) {
    return `/api/sessions/${sessionId}/messages`;
  },
  sessionArtifacts(sessionId: string) {
    return `/api/sessions/${sessionId}/artifacts`;
  },
  artifactContent(sessionId: string, artifactId: string) {
    return `/api/sessions/${sessionId}/artifacts/${artifactId}/content`;
  },
  agentStream: "/api/agent/stream",
  referencesList: "/tutti/references/list",
} as const;
