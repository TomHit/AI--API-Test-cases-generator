import React, { useMemo } from "react";

function uniqueTags(endpoints) {
  const s = new Set();
  for (const e of endpoints || []) {
    (e.tags || []).forEach((t) => s.add(t));
  }
  return ["ALL", ...Array.from(s).sort()];
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
    <div>
      <div style={styles.filters}>
        <input
          style={styles.input}
          placeholder="Search…"
          value={selection.filter.q}
          onChange={(e) => setFilter({ q: e.target.value })}
        />

        <div style={{ display: "flex", gap: 8 }}>
          <select
            style={styles.select}
            value={selection.filter.method}
            onChange={(e) => setFilter({ method: e.target.value })}
          >
            <option value="ALL">All</option>
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

        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={!!selection.filter.authOnly}
            onChange={(e) => setFilter({ authOnly: e.target.checked })}
          />
          Auth only
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.btn} onClick={selectAllVisible}>
            Select visible
          </button>
          <button style={styles.btn} onClick={clearAll}>
            Clear
          </button>
        </div>
      </div>

      <div style={styles.list}>
        {filtered.map((e) => {
          const checked = (selection.selected_endpoint_ids || []).includes(
            e.id,
          );
          return (
            <label key={e.id} style={styles.row}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(e.id)}
              />
              <span style={styles.method}>{e.method}</span>
              <span style={styles.path}>{e.path}</span>
              {e.requires_auth && <span style={styles.pill}>auth</span>}
            </label>
          );
        })}
      </div>

      <div style={styles.footer}>
        Selected: {(selection.selected_endpoint_ids || []).length} /{" "}
        {endpoints.length}
      </div>
    </div>
  );
}

const styles = {
  filters: { display: "grid", gap: 8, marginBottom: 10 },
  input: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #ddd",
    width: "100%",
  },
  select: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "white",
  },
  checkboxRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontSize: 13,
    opacity: 0.9,
  },
  btn: {
    padding: "8px 10px",
    border: "1px solid #ccc",
    borderRadius: 10,
    background: "white",
    cursor: "pointer",
  },
  list: {
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 8,
    maxHeight: 520,
    overflow: "auto",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "18px 52px 1fr auto",
    gap: 8,
    alignItems: "center",
    padding: "6px 8px",
    borderRadius: 10,
    cursor: "pointer",
  },
  method: { fontWeight: 800, fontSize: 12 },
  path: { fontSize: 13 },
  pill: {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #ddd",
    opacity: 0.8,
  },
  footer: { marginTop: 8, fontSize: 12, opacity: 0.75 },
};
