import React from "react";

export default function ProjectCard({ project, onOpen }) {
  const status = project.docs_status || "missing";
  const badge =
    status === "ok"
      ? "✅ Docs OK"
      : status === "error"
        ? "❌ Docs Error"
        : "⚠️ Docs Missing";

  return (
    <div style={styles.card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div style={styles.name}>{project.project_name}</div>
        <div style={styles.badge}>{badge}</div>
      </div>

      <div style={styles.meta}>
        <div>
          <b>ID:</b> {project.project_id}
        </div>
        <div>
          <b>Envs:</b> {project.env_count ?? "—"}
        </div>
        <div>
          <b>Last:</b>{" "}
          {project.last_generated_at
            ? new Date(project.last_generated_at).toLocaleString()
            : "—"}
        </div>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <button style={styles.btnPrimary} onClick={onOpen}>
          Open
        </button>
        <button
          style={styles.btn}
          onClick={() => alert("MVP: Settings page can be added next.")}
        >
          Settings
        </button>
      </div>
    </div>
  );
}

const styles = {
  card: {
    border: "1px solid #e5e5e5",
    borderRadius: 14,
    padding: 12,
    background: "white",
  },
  name: { fontSize: 16, fontWeight: 800 },
  badge: { fontSize: 12, opacity: 0.85 },
  meta: { marginTop: 10, fontSize: 13, opacity: 0.85, display: "grid", gap: 4 },
  btn: {
    padding: "8px 10px",
    border: "1px solid #ccc",
    borderRadius: 10,
    background: "white",
    cursor: "pointer",
  },
  btnPrimary: {
    padding: "8px 10px",
    border: "1px solid #111",
    borderRadius: 10,
    background: "#111",
    color: "white",
    cursor: "pointer",
  },
};
