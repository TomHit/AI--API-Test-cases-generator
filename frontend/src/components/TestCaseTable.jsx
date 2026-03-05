import React from "react";

function statusBadge(status) {
  if (status === "needs_review")
    return { text: "⚠️ Review", bg: "#fff7d6", border: "#ffe08a" };
  if (status === "invalid")
    return { text: "❌ Invalid", bg: "#ffe6e6", border: "#ffb3b3" };
  return { text: "✅ Valid", bg: "#eaffea", border: "#b8f0b8" };
}

export default function TestCaseTable({ rows, onRowClick }) {
  return (
    <div style={styles.wrap}>
      <div style={styles.table}>
        <div style={styles.head}>
          <div>ID</div>
          <div>Title</div>
          <div>Type</div>
          <div>Pri</div>
          <div>Method</div>
          <div>Endpoint</div>
          <div>Status</div>
        </div>

        {(rows || []).map((r) => {
          const b = statusBadge(r.status);
          return (
            <div
              key={`${r.suite_id}:${r.case_id}`}
              style={styles.row}
              onClick={() => onRowClick?.(r)}
              role="button"
              tabIndex={0}
            >
              <div style={styles.mono}>{r.case_id}</div>
              <div style={styles.title}>{r.title}</div>
              <div>{r.type}</div>
              <div>{r.priority}</div>
              <div style={styles.mono}>{r.method}</div>
              <div style={styles.mono}>{r.path}</div>
              <div>
                <span
                  style={{
                    ...styles.badge,
                    background: b.bg,
                    borderColor: b.border,
                  }}
                >
                  {b.text}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {(!rows || rows.length === 0) && (
        <div style={styles.empty}>
          No test cases yet. Generate to see results.
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { width: "100%" },
  table: {
    border: "1px solid #eee",
    borderRadius: 12,
    overflow: "hidden",
  },
  head: {
    display: "grid",
    gridTemplateColumns: "120px 1.6fr 0.7fr 60px 80px 1.2fr 120px",
    gap: 8,
    padding: "10px 12px",
    background: "#f6f6f6",
    fontWeight: 800,
    fontSize: 12,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "120px 1.6fr 0.7fr 60px 80px 1.2fr 120px",
    gap: 8,
    padding: "10px 12px",
    borderTop: "1px solid #eee",
    cursor: "pointer",
    alignItems: "center",
    fontSize: 13,
  },
  mono: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
  },
  title: { fontWeight: 700 },
  badge: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 999,
    border: "1px solid #ddd",
    fontSize: 12,
  },
  empty: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    background: "#f6f6f6",
  },
};
