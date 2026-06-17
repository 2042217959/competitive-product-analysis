import { MessageSquarePlus, Search, Trash2 } from "lucide-react";

import type { ResearchSession } from "@product-competition/shared";

import { useTranslation } from "../i18n/index.js";

export function SessionSidebar(props: {
  sessions: ResearchSession[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
  onDelete: (sessionId: string) => void;
  onOpenLibrary: () => void;
}) {
  const { t, locale } = useTranslation();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand">
          <span className="brand-mark">CR</span>
          <span className="brand-name">{t("app.title")}</span>
        </div>
        <button className="new-session" onClick={props.onCreate} title={t("session.new")}>
          <MessageSquarePlus size={16} />
        </button>
      </div>

      <button className="library-link" onClick={props.onOpenLibrary}>
        <Search size={15} />
        <span>{t("library.title")}</span>
      </button>

      <div className="session-list">
        {props.sessions.length === 0 ? (
          <p className="session-empty">{t("session.empty")}</p>
        ) : (
          props.sessions.map((session) => (
            <button
              key={session.id}
              className={`session-item ${session.id === props.activeSessionId ? "is-active" : ""}`}
              onClick={() => props.onSelect(session.id)}
            >
              <span className={`session-status status-${session.status}`} />
              <span className="session-meta">
                <span className="session-title">{session.title}</span>
                <span className="session-sub">
                  {session.artifactCount > 0
                    ? t("session.artifacts", { count: session.artifactCount })
                    : formatDate(session.updatedAt, locale)}
                </span>
              </span>
              <span
                className="session-delete"
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  props.onDelete(session.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.stopPropagation();
                    props.onDelete(session.id);
                  }
                }}
              >
                <Trash2 size={14} />
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}

function formatDate(value: string, locale: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
