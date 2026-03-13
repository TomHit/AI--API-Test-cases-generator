import React, { useMemo } from "react";

function uniqueTags(endpoints) {
  const s = new Set();
  for (const e of endpoints || []) {
    (e.tags || []).forEach((t) => s.add(t));
  }
  return ["ALL", ...Array.from(s).sort()];
}

function methodTone(method) {
  const m = String(method || "").toUpperCase();

  if (m === "GET") return { bg: "#ecfdf5", color: "#166534" };
  if (m === "POST") return { bg: "#eef2ff", color: "#4338ca" };
  if (m === "PUT") return { bg: "#eff6ff", color: "#1d4ed8" };
  if (m === "PATCH") return { bg: "#fff7ed", color: "#c2410c" };
  if (m === "DELETE") return { bg: "#fef2f2", color: "#b91c1c" };

  return { bg: "#f1f5f9", color: "#334155" };
}

export default function EndpointSelector({ endpoints, selection, onChange }) {
  const tags = useMemo(() => uniqueTags(endpoints), [endpoints]);

  const filtered = useMemo(() => {
    const q = (selection?.filter?.q || "").toLowerCase().trim();
    const method = selection?.filter?.method || "ALL";
    const authOnly = !!selection?.filter?.authOnly;
    const tag = selection?.filter?.tag || "ALL";

    return (endpoints || []).filter((e) => {
      const matchQ =
        !q ||
        `${e.method} ${e.path}`.toLowerCase().includes(q) ||
        (e.summary || "").toLowerCase().includes(q);

      const matchMethod = method === "ALL" ? true : e.method === method;
      const matchAuth = authOnly ? !!e.requires_auth : true;
      const matchTag = tag === "ALL" ? true : (e.tags || []).includes(tag);

      return matchQ && matchMethod && matchAuth && matchTag;
    });
  }, [endpoints, selection]);

  function toggle(id) {
    const sel = new Set(selection.selected_endpoint_ids || []);
    if (sel.has(id)) sel.delete(id);
    else sel.add(id);
    onChange({ ...selection, selected_endpoint_ids: Array.from(sel) });
  }

  function setFilter(patch) {
    onChange({ ...selection, filter: { ...selection.filter, ...patch } });
  }

  function selectAllVisible() {
    const sel = new Set(selection.selected_endpoint_ids || []);
    filtered.forEach((e) => sel.add(e.id));
    onChange({ ...selection, selected_endpoint_ids: Array.from(sel) });
  }

  function clearAll() {
    onChange({ ...selection, selected_endpoint_ids: [] });
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.filters}>
        <input
          style={styles.input}
          placeholder="Search endpoints..."
          value={selection.filter.q}
          onChange={(e) => setFilter({ q: e.target.value })}
        />

        <div style={styles.filterRow}>
          <select
            style={styles.select}
            value={selection.filter.method}
            onChange={(e) => setFilter({ method: e.target.value })}
          >
            <option value="ALL">All methods</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>

          <select
            style={styles.select}
            value={selection.filter.tag}
            onChange={(e) => setFilter({ tag: e.target.value })}
          >
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.actionRow}>
          <label style={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={!!selection.filter.authOnly}
              onChange={(e) => setFilter({ authOnly: e.target.checked })}
            />
            <span>Auth only</span>
          </label>

          <div style={styles.inlineBtns}>
            <button type="button" style={styles.btn} onClick={selectAllVisible}>
              Select visible
            </button>
            <button type="button" style={styles.btn} onClick={clearAll}>
              Clear
            </button>
          </div>
        </div>
      </div>

      <div style={styles.list}>
        {filtered.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyTitle}>No endpoints found</div>
            <div style={styles.emptySubtle}>
              Try changing the search text or filters.
            </div>
          </div>
        )}

        {filtered.map((e) => {
          const checked = (selection.selected_endpoint_ids || []).includes(
            e.id,
          );
          const tone = methodTone(e.method);

          return (
            <label
              key={e.id}
              style={{
                ...styles.row,
                ...(checked ? styles.rowChecked : {}),
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(e.id)}
              />

              <span
                style={{
                  ...styles.method,
                  background: tone.bg,
                  color: tone.color,
                }}
              >
                {e.method}
              </span>

              <div style={styles.pathWrap}>
                <div style={styles.path}>{e.path}</div>
                {!!e.summary && <div style={styles.summary}>{e.summary}</div>}
              </div>

              <div style={styles.badges}>
                {e.requires_auth && <span style={styles.authPill}>auth</span>}
                {(e.tags || []).slice(0, 1).map((tag) => (
                  <span key={tag} style={styles.tagPill}>
                    {tag}
                  </span>
                ))}
              </div>
            </label>
          );
        })}
      </div>

      <div style={styles.footer}>
        <span>
          Selected:{" "}
          <strong>{(selection.selected_endpoint_ids || []).length}</strong>
        </span>
        <span>
          Visible: <strong>{filtered.length}</strong>
        </span>
        <span>
          Total: <strong>{endpoints.length}</strong>
        </span>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    display: "grid",
    gap: 12,
    minWidth: 0,
  },

  filters: {
    display: "grid",
    gap: 10,
  },

  filterRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },

  actionRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },

  inlineBtns: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  input: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #dbe3f0",
    width: "100%",
    boxSizing: "border-box",
    background: "#fff",
    fontSize: 14,
    color: "#0f172a",
    outline: "none",
  },

  select: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #dbe3f0",
    background: "#fff",
    fontSize: 14,
    color: "#0f172a",
    outline: "none",
  },

  checkboxRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontSize: 13,
    color: "#334155",
    fontWeight: 600,
  },

  btn: {
    padding: "8px 10px",
    border: "1px solid #d6dce8",
    borderRadius: 10,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    color: "#0f172a",
    whiteSpace: "nowrap",
  },

  list: {
    border: "1px solid #e6eaf2",
    borderRadius: 14,
    padding: 8,
    maxHeight: 560,
    overflow: "auto",
    background: "#fcfdff",
    minWidth: 0,
  },

  row: {
    display: "grid",
    gridTemplateColumns: "18px 64px minmax(0, 1fr) auto",
    gap: 10,
    alignItems: "center",
    padding: "10px 10px",
    borderRadius: 12,
    cursor: "pointer",
    border: "1px solid transparent",
    minWidth: 0,
  },

  rowChecked: {
    background: "#f8faff",
    borderColor: "#dbe7ff",
  },

  method: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 52,
    padding: "5px 8px",
    borderRadius: 999,
    fontWeight: 800,
    fontSize: 11,
    letterSpacing: 0.2,
    whiteSpace: "nowrap",
  },

  pathWrap: {
    minWidth: 0,
  },

  path: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  summary: {
    marginTop: 3,
    fontSize: 12,
    color: "#64748b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  badges: {
    display: "flex",
    gap: 6,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  authPill: {
    fontSize: 11,
    padding: "4px 8px",
    borderRadius: 999,
    background: "#fff7ed",
    color: "#c2410c",
    border: "1px solid #fed7aa",
    whiteSpace: "nowrap",
    fontWeight: 700,
  },

  tagPill: {
    fontSize: 11,
    padding: "4px 8px",
    borderRadius: 999,
    background: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
    fontWeight: 700,
  },

  footer: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748b",
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },

  emptyState: {
    padding: 20,
    borderRadius: 12,
    textAlign: "center",
    color: "#64748b",
  },

  emptyTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 6,
  },

  emptySubtle: {
    fontSize: 13,
    color: "#64748b",
  },
};
