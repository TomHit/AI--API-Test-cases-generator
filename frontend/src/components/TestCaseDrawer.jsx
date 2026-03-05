import React from "react";

export default function TestCaseDrawer({ open, row, onClose }) {
  if (!open) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>{row?.case_id || "Test Case"}</div>
            <div style={styles.sub}>{row?.title || ""}</div>
          </div>
          <button style={styles.btn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.section}>
          <div style={styles.h}>Request</div>
          <div style={styles.mono}>
            {row?.method} {row?.path}
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.h}>Steps</div>
          <ol style={styles.list}>
            {(row?.steps || []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>

        <div style={styles.section}>
          <div style={styles.h}>Expected</div>
          <ul style={styles.list}>
            {(row?.expected || []).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>

        <div style={styles.section}>
          <div style={styles.h}>Assertions (for automation)</div>
          <pre style={styles.code}>
            {JSON.stringify(row?.assertions || [], null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    justifyContent: "flex-end",
    zIndex: 50,
  },
  drawer: {
    width: 520,
    maxWidth: "92vw",
    height: "100%",
    background: "#fff",
    padding: 14,
    borderLeft: "1px solid #eee",
    overflow: "auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
  },
  title: { fontSize: 16, fontWeight: 900 },
  sub: { fontSize: 13, opacity: 0.75, marginTop: 2 },
  btn: {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "#fff",
    cursor: "pointer",
  },
  section: { marginTop: 12 },
  h: { fontWeight: 900, marginBottom: 6 },
  mono: {
    fontFamily: "ui-monospace, Menlo, monospace",
    fontSize: 12,
    opacity: 0.85,
  },
  list: { marginTop: 6 },
  code: {
    background: "#0b1020",
    color: "#e5e7eb",
    padding: 10,
    borderRadius: 12,
    overflow: "auto",
    fontSize: 12,
  },
};
