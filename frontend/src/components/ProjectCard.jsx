import React from "react";

export default function ProjectCard({ project, onOpen }) {
  const hasSpecSource = !!String(project?.spec_source || "").trim();

  const derivedStatus =
    project?.docs_status || (hasSpecSource ? "ok" : "missing");

  const statusLabel =
    derivedStatus === "ok"
      ? "Docs Ready"
      : derivedStatus === "error"
        ? "Docs Error"
        : "Docs Missing";

  const statusClass =
    derivedStatus === "ok"
      ? "status-pill success"
      : derivedStatus === "error"
        ? "status-pill danger"
        : "status-pill warning";

  return (
    <div className="project-card">
      <div className="project-card-top">
        <div>
          <div className="project-card-title">
            {project?.project_name || "Untitled Project"}
          </div>
          <div className="project-card-subtitle">
            Project ID: {project?.project_id || "—"}
          </div>
        </div>

        <div className={statusClass}>{statusLabel}</div>
      </div>

      <div className="project-card-meta">
        <div className="project-meta-item">
          <span>Environments</span>
          <strong>{project?.env_count ?? "—"}</strong>
        </div>

        <div className="project-meta-item">
          <span>Last Generated</span>
          <strong>
            {project?.last_generated_at
              ? new Date(project.last_generated_at).toLocaleString()
              : "—"}
          </strong>
        </div>
      </div>

      <div className="project-card-ai-note">
        AI workspace will use this project to organize API specs, generated test
        cases, and future reporting.
      </div>

      <div className="project-card-actions">
        <button type="button" className="primary-btn" onClick={onOpen}>
          Open Project
        </button>

        <button
          type="button"
          className="secondary-btn"
          onClick={() => alert("MVP: Project settings page can be added next.")}
        >
          Settings
        </button>
      </div>
    </div>
  );
}
