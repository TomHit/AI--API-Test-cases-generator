import React, { useEffect, useState } from "react";
import ProjectCard from "../components/ProjectCard";

export default function DashboardPage({ onOpenProject }) {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/projects", {
        headers: { Accept: "application/json" },
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : [];
      if (!res.ok) throw new Error(data?.message || `Failed: ${res.status}`);
      setProjects(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>API TestOps</div>
          <div style={styles.sub}>Projects Dashboard</div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.btn} onClick={load}>
            Refresh
          </button>
          <button
            style={styles.btnPrimary}
            onClick={() =>
              alert(
                "MVP: Create Project UI can be added next. For now use backend to create projects.",
              )
            }
          >
            + New Project
          </button>
        </div>
      </div>

      {loading && <div style={styles.note}>Loading projects…</div>}
      {!!err && <div style={styles.err}>Error: {err}</div>}

      <div style={styles.grid}>
        {projects.map((p) => (
          <ProjectCard
            key={p.project_id}
            project={p}
            onOpen={() => onOpenProject?.(p.project_id)}
          />
        ))}
      </div>

      {!loading && !err && projects.length === 0 && (
        <div style={styles.note}>No projects found.</div>
      )}
    </div>
  );
}

const styles = {
  page: { padding: 18, fontFamily: "system-ui, Arial", color: "#111" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: { fontSize: 22, fontWeight: 800 },
  sub: { fontSize: 13, opacity: 0.7 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 12,
  },
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
  note: { padding: 12, borderRadius: 12, background: "#f6f6f6" },
  err: {
    padding: 12,
    borderRadius: 12,
    background: "#ffe6e6",
    border: "1px solid #ffb3b3",
  },
};
