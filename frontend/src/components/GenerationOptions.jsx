import React from "react";

const TEST_TYPES = ["contract", "schema", "negative", "auth"];

function TogglePill({ checked, label, onChange }) {
  return (
    <label
      style={{
        ...styles.pill,
        ...(checked ? styles.pillChecked : {}),
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={styles.hiddenCheckbox}
      />
      <span
        style={{
          ...styles.checkDot,
          ...(checked ? styles.checkDotChecked : {}),
        }}
      >
        {checked ? "✓" : ""}
      </span>
      <span style={styles.pillText}>{label}</span>
    </label>
  );
}

export default function GenerationOptions({ options, onChange }) {
  function toggleInclude(key) {
    const set = new Set(options.include || []);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    onChange({ ...options, include: Array.from(set) });
  }

  function selectRecommended() {
    onChange({
      ...options,
      include: ["contract", "schema"],
      generation_mode: "balanced",
    });
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.topGrid}>
        <section style={styles.sectionCard}>
          <div style={styles.sectionTitle}>Test Types</div>

          <div style={styles.pillGrid}>
            {TEST_TYPES.map((k) => (
              <TogglePill
                key={k}
                label={k}
                checked={(options.include || []).includes(k)}
                onChange={() => toggleInclude(k)}
              />
            ))}
          </div>

          <div style={styles.inlineRow}>
            <label style={styles.aiToggle}>
              <input
                type="checkbox"
                checked={!!options.ai}
                onChange={(e) => onChange({ ...options, ai: e.target.checked })}
              />
              <span>Use AI enrichment</span>
            </label>

            <button
              type="button"
              onClick={selectRecommended}
              style={styles.smallBtn}
            >
              Use Recommended
            </button>
          </div>

          <div style={styles.help}>
            Recommended for fast manual QA coverage: contract + schema.
          </div>
        </section>

        <section style={styles.sectionCard}>
          <div style={styles.twoCol}>
            <div>
              <div style={styles.label}>Environment</div>
              <input
                value={options.env || ""}
                onChange={(e) => onChange({ ...options, env: e.target.value })}
                placeholder="staging"
                style={styles.input}
              />
            </div>

            <div>
              <div style={styles.label}>Auth Profile</div>
              <input
                value={options.auth_profile || ""}
                onChange={(e) =>
                  onChange({ ...options, auth_profile: e.target.value })
                }
                placeholder="device"
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.modeHeaderRow}>
            <div style={styles.label}>Generation Mode</div>
          </div>

          <div style={styles.modeRow}>
            <label
              style={{
                ...styles.radioCard,
                ...((options.generation_mode || "balanced") === "balanced"
                  ? styles.radioCardChecked
                  : {}),
              }}
            >
              <input
                type="radio"
                name="generation_mode"
                checked={(options.generation_mode || "balanced") === "balanced"}
                onChange={() =>
                  onChange({ ...options, generation_mode: "balanced" })
                }
              />
              <div>
                <div style={styles.radioTitle}>Balanced</div>
                <div style={styles.radioHelp}>
                  Generate for ready + partial endpoints.
                </div>
              </div>
            </label>

            <label
              style={{
                ...styles.radioCard,
                ...(options.generation_mode === "strict"
                  ? styles.radioCardChecked
                  : {}),
              }}
            >
              <input
                type="radio"
                name="generation_mode"
                checked={options.generation_mode === "strict"}
                onChange={() =>
                  onChange({ ...options, generation_mode: "strict" })
                }
              />
              <div>
                <div style={styles.radioTitle}>Strict</div>
                <div style={styles.radioHelp}>
                  Generate only for spec-complete endpoints.
                </div>
              </div>
            </label>
          </div>
        </section>
      </div>

      <section style={styles.section}>
        <div style={styles.label}>Spec Source (Swagger / OpenAPI URL)</div>
        <input
          value={options.spec_source || ""}
          onChange={(e) =>
            onChange({ ...options, spec_source: e.target.value })
          }
          placeholder="https://app.example.com/openapi.json"
          style={styles.input}
        />
      </section>

      <section style={styles.section}>
        <div style={styles.label}>Additional Guidance</div>
        <textarea
          value={options.guidance || ""}
          onChange={(e) => onChange({ ...options, guidance: e.target.value })}
          placeholder="Focus on contract and schema validation. Keep steps clear for manual testers."
          style={styles.textarea}
        />
      </section>
    </div>
  );
}

const styles = {
  wrap: {
    display: "grid",
    gap: 14,
  },
  topGrid: {
    display: "grid",
    gridTemplateColumns: "1.08fr 1fr",
    gap: 14,
    alignItems: "start",
  },
  section: {
    display: "grid",
    gap: 10,
  },
  sectionCard: {
    display: "grid",
    gap: 12,
    border: "1px solid #edf1f7",
    borderRadius: 16,
    background: "#fbfcfe",
    padding: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
  },
  label: {
    fontSize: 13,
    fontWeight: 800,
    color: "#334155",
    marginBottom: 2,
  },
  pillGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  pill: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #dbe3f0",
    background: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    color: "#334155",
    minWidth: 0,
  },
  pillChecked: {
    borderColor: "#c7d2fe",
    background: "#eef2ff",
    color: "#3730a3",
    boxShadow: "inset 0 0 0 1px rgba(99,102,241,0.08)",
  },
  pillText: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  hiddenCheckbox: {
    display: "none",
  },
  checkDot: {
    width: 20,
    height: 20,
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    color: "transparent",
    background: "#fff",
    flexShrink: 0,
  },
  checkDotChecked: {
    background: "#4f46e5",
    borderColor: "#4f46e5",
    color: "#fff",
  },
  inlineRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  aiToggle: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    color: "#334155",
    fontWeight: 600,
  },
  smallBtn: {
    padding: "9px 12px",
    borderRadius: 12,
    border: "1px solid #d6dce8",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    whiteSpace: "nowrap",
    color: "#0f172a",
  },
  help: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.4,
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #dbe3f0",
    background: "#fff",
    fontSize: 14,
    boxSizing: "border-box",
    color: "#0f172a",
    outline: "none",
  },
  textarea: {
    width: "100%",
    minHeight: 78,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #dbe3f0",
    background: "#fff",
    fontSize: 14,
    lineHeight: 1.45,
    resize: "vertical",
    boxSizing: "border-box",
    color: "#0f172a",
    outline: "none",
  },
  modeHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modeRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  radioCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #dbe3f0",
    background: "#fff",
    cursor: "pointer",
    minWidth: 0,
  },
  radioCardChecked: {
    borderColor: "#c7d2fe",
    background: "#eef2ff",
    boxShadow: "inset 0 0 0 1px rgba(99,102,241,0.08)",
  },
  radioTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 4,
  },
  radioHelp: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.4,
  },
};
