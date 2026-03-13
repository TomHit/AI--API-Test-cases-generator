import React from "react";

function badgeForType(type) {
  const value = String(type || "").toLowerCase();

  if (value === "contract") return { bg: "#eef2ff", color: "#4338ca" };
  if (value === "schema") return { bg: "#ecfeff", color: "#155e75" };
  if (value === "negative") return { bg: "#fff7ed", color: "#c2410c" };
  if (value === "auth") return { bg: "#fdf2f8", color: "#be185d" };

  return { bg: "#f1f5f9", color: "#334155" };
}

function reviewBadge(needsReview) {
  if (needsReview) {
    return {
      text: "Needs review",
      bg: "#fff7d6",
      color: "#92400e",
      border: "#fde68a",
    };
  }

  return {
    text: "Ready",
    bg: "#ecfdf5",
    color: "#166534",
    border: "#bbf7d0",
  };
}

function shortText(value, max = 70) {
  const s = String(value ?? "");
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export default function TestCaseTable({
  rows = [],
  onRowClick,
  loading = false,
}) {
  if (loading) {
    return (
      <div style={styles.skeletonWrap}>
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} style={styles.skeletonRow} />
        ))}
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyTitle}>No test cases yet</div>
        <div style={styles.emptySubtle}>
          Generate tests to preview AI-built cases here.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.tableShell}>
        <div style={styles.tableHead}>
          <div>ID</div>
          <div>Title</div>
          <div>Endpoint</div>
          <div>Type</div>
          <div>Priority</div>
          <div>Review</div>
          <div style={{ textAlign: "right" }}>Action</div>
        </div>

        <div style={styles.bodyWrap}>
          {rows.map((r) => {
            const review = reviewBadge(r.needs_review);
            const typeBadge = badgeForType(r.test_type);
            const endpoint =
              `${r.api_details?.method || ""} ${r.api_details?.path || ""}`.trim();

            return (
              <div
                key={`${r.suite_id}-${r.id}`}
                style={styles.row}
                role="button"
                tabIndex={0}
                onClick={() => onRowClick?.(r)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onRowClick?.(r);
                }}
              >
                <div style={styles.idCell}>{shortText(r.id, 24)}</div>

                <div style={styles.titleCell}>
                  <div style={styles.title}>{shortText(r.title, 80)}</div>
                  <div style={styles.subtle}>{shortText(r.module, 38)}</div>
                </div>

                <div style={styles.endpoint}>{shortText(endpoint, 58)}</div>

                <div>
                  <span
                    style={{
                      ...styles.badge,
                      background: typeBadge.bg,
                      color: typeBadge.color,
                    }}
                  >
                    {r.test_type || "-"}
                  </span>
                </div>

                <div style={styles.priority}>{r.priority || "-"}</div>

                <div>
                  <span
                    style={{
                      ...styles.badge,
                      background: review.bg,
                      color: review.color,
                      border: `1px solid ${review.border}`,
                    }}
                  >
                    {review.text}
                  </span>
                </div>

                <div style={{ textAlign: "right" }}>
                  <button
                    type="button"
                    style={styles.viewBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRowClick?.(r);
                    }}
                  >
                    View
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    display: "grid",
    gap: 10,
    minWidth: 0,
  },

  tableShell: {
    border: "1px solid #e6eaf2",
    borderRadius: 16,
    overflow: "hidden",
    background: "#fff",
    minWidth: 0,
  },

  tableHead: {
    display: "grid",
    gridTemplateColumns: "1.05fr 2.2fr 2fr 0.95fr 0.8fr 1fr 0.85fr",
    gap: 14,
    padding: "14px 16px",
    background: "#f8fafc",
    borderBottom: "1px solid #e6eaf2",
    fontSize: 12,
    fontWeight: 800,
    color: "#334155",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },

  bodyWrap: {
    display: "grid",
  },

  row: {
    display: "grid",
    gridTemplateColumns: "1.05fr 2.2fr 2fr 0.95fr 0.8fr 1fr 0.85fr",
    gap: 14,
    padding: "15px 16px",
    background: "#fff",
    alignItems: "center",
    cursor: "pointer",
    transition: "background 0.15s ease, box-shadow 0.15s ease",
    borderBottom: "1px solid #eef2f7",
  },

  idCell: {
    fontSize: 12,
    fontWeight: 800,
    color: "#475569",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  titleCell: {
    minWidth: 0,
  },

  title: {
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  subtle: {
    fontSize: 12,
    color: "#64748b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  endpoint: {
    fontSize: 13,
    color: "#334155",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  priority: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
    textTransform: "capitalize",
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  viewBtn: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #d6dce8",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    color: "#0f172a",
    whiteSpace: "nowrap",
  },

  empty: {
    padding: 28,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px dashed #d6dce8",
    color: "#475569",
    textAlign: "center",
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 6,
  },

  emptySubtle: {
    fontSize: 14,
    color: "#64748b",
  },

  skeletonWrap: {
    display: "grid",
    gap: 10,
  },

  skeletonRow: {
    height: 66,
    borderRadius: 16,
    background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 37%, #f1f5f9 63%)",
    backgroundSize: "400% 100%",
    animation: "pulseShimmer 1.4s ease infinite",
  },
};
