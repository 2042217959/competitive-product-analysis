import { FileText, Search, X } from "lucide-react";

import type { ResearchSession } from "@product-competition/shared";

import { useTranslation } from "../i18n/index.js";

export function LibraryOverlay(props: {
  sessions: ResearchSession[];
  onSelect: (sessionId: string) => void;
  onClose: () => void;
}) {
  const { t, locale } = useTranslation();
  const withArtifacts = props.sessions.filter((session) => session.artifactCount > 0);

  return (
    <div className="artifact-modal" onClick={props.onClose}>
      <div className="library-panel" onClick={(event) => event.stopPropagation()}>
        <header className="artifact-modal-header">
          <div className="library-head-title">
            <Search size={16} />
            <strong>{t("library.title")}</strong>
          </div>
          <button className="icon-button" onClick={props.onClose}>
            <X size={16} />
          </button>
        </header>
        <div className="library-body">
          {withArtifacts.length === 0 ? (
            <p className="artifact-empty">{t("library.globalEmpty")}</p>
          ) : (
            withArtifacts.map((session) => (
              <button
                key={session.id}
                className="library-row"
                onClick={() => {
                  props.onSelect(session.id);
                  props.onClose();
                }}
              >
                <FileText size={16} />
                <span className="library-row-meta">
                  <span className="library-row-title">{session.title}</span>
                  <span className="library-row-sub">
                    {session.productName ? `${session.productName} · ` : ""}
                    {t("session.artifacts", { count: session.artifactCount })} ·{" "}
                    {formatDate(session.updatedAt, locale)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string, locale: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}
