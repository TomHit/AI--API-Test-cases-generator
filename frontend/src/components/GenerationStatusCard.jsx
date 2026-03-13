import React, { useEffect, useMemo, useState } from "react";

const RUNNING_STEPS = [
  "Reading selected endpoints",
  "Analyzing OpenAPI structure",
  "Building contract coverage",
  "Building schema coverage",
  "Generating negative scenarios",
  "Preparing preview output",
];

function niceTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function StatPill({ label, value }) {
  return (
    <div style={styles.statPill}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

export default function GenerationStatusCard({
  status,
  selectedCount = 0,
  report = null,
  error = null,
  specQuality = null,
  generationMode = "balanced",
}) {
  const [elapsed, setElapsed] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (status !== "running") {
      setElapsed(0);
      setStepIndex(0);
      return;
    }

    const timer = setInterval(() => {
      setElapsed((v) => v + 1);
    }, 1000);

    const stepTimer = setInterval(() => {
      setStepIndex((v) => (v + 1) % RUNNING_STEPS.length);
    }, 1400);

    return () => {
      clearInterval(timer);
      clearInterval(stepTimer);
    };
  }, [status]);

  const summary = useMemo(() => {
    return specQuality?.summary || null;
  }, [specQuality]);

  if (status === "running") {
    const progressPct = Math.min(92, 18 + stepIndex * 14);

    return (
      <div style={{ ...styles.card, ...styles.runningCard }}>
        <div style={styles.headerRow}>
          <div>
            <div style={styles.eyebrow}>AI generation in progress</div>
            <div style={styles.title}>Building your test plan</div>
            <div style={styles.subtle}>
              Processing {selectedCount} selected endpoint
              {selectedCount === 1 ? "" : "s"} in {generationMode} mode
            </div>
          </div>

          <div style={styles.elapsedBox}>
            <div style={styles.elapsedLabel}>Elapsed</div>
            <div style={styles.elapsedValue}>{niceTime(elapsed)}</div>
          </div>
        </div>

        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressBar,
              width: `${progressPct}%`,
            }}
          />
        </div>

        <div style={styles.stepList}>
          {RUNNING_STEPS.map((step, idx) => {
            const isDone = idx < stepIndex;
            const isActive = idx === stepIndex;
            return (
              <div
                key={step}
                style={{
                  ...styles.stepItem,
                  ...(isActive ? styles.stepItemActive : {}),
                }}
              >
                <span style={styles.stepIcon}>
                  {isDone ? "✓" : isActive ? "●" : "○"}
                </span>
                <span>{step}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div style={{ ...styles.card, ...styles.successCard }}>
        <div style={styles.headerRow}>
          <div>
            <div style={styles.eyebrow}>Generation complete</div>
            <div style={styles.title}>Your AI test plan is ready</div>
            <div style={styles.subtle}>
              Review cases below, open any row for full details, then export.
            </div>
          </div>
        </div>

        <div style={styles.statsGrid}>
          <StatPill label="Selected endpoints" value={selectedCount} />
          <StatPill label="Generated cases" value={report?.total_cases ?? 0} />
          <StatPill label="Needs review" value={report?.needs_review ?? 0} />
          <StatPill
            label="Mode"
            value={String(generationMode || "balanced").toUpperCase()}
          />
        </div>

        {!!summary && (
          <div style={styles.summaryRow}>
            <span>Spec health: {specQuality?.spec_health_score ?? "—"}</span>
            <span>Ready: {summary.ready ?? "—"}</span>
            <span>Partial: {summary.partial ?? "—"}</span>
            <span>Blocked: {summary.blocked ?? "—"}</span>
          </div>
        )}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{ ...styles.card, ...styles.errorCard }}>
        <div style={styles.eyebrow}>Generation failed</div>
        <div style={styles.title}>Unable to build the test plan</div>
        <div style={styles.errorText}>
          {error?.message || "Something went wrong during generation."}
        </div>

        {!!specQuality && (
          <div style={styles.summaryRow}>
            <span>Mode: {generationMode}</span>
            <span>Spec health: {specQuality?.spec_health_score ?? "—"}</span>
            <span>Blocked: {specQuality?.summary?.blocked ?? "—"}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <div style={styles.eyebrow}>Ready</div>
      <div style={styles.title}>Configure generation and run</div>
      <div style={styles.subtle}>
        Select one or more endpoints, choose your test types, then click
        Generate Tests.
      </div>

      <div style={styles.statsGrid}>
        <StatPill label="Selected endpoints" value={selectedCount} />
        <StatPill label="Mode" value={String(generationMode).toUpperCase()} />
      </div>
    </div>
  );
}

const styles = {
  card: {
    border: "1px solid #e6eaf2",
    borderRadius: 18,
    padding: 20,
    background: "#ffffff",
    boxShadow: "0 8px 30px rgba(15, 23, 42, 0.05)",
  },
  runningCard: {
    borderColor: "#c7d2fe",
    background:
      "linear-gradient(180deg, rgba(238,242,255,0.95) 0%, rgba(255,255,255,1) 100%)",
  },
  successCard: {
    borderColor: "#bbf7d0",
    background:
      "linear-gradient(180deg, rgba(240,253,244,0.95) 0%, rgba(255,255,255,1) 100%)",
  },
  errorCard: {
    borderColor: "#fecaca",
    background:
      "linear-gradient(180deg, rgba(254,242,242,0.95) 0%, rgba(255,255,255,1) 100%)",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#4f46e5",
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 6,
  },
  subtle: {
    fontSize: 14,
    lineHeight: 1.5,
    color: "#64748b",
  },
  elapsedBox: {
    minWidth: 92,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #dbe3f0",
    background: "#fff",
    textAlign: "center",
  },
  elapsedLabel: {
    fontSize: 11,
    color: "#64748b",
    marginBottom: 4,
  },
  elapsedValue: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    background: "#e8edf7",
    marginTop: 18,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #7c3aed 0%, #2563eb 100%)",
    transition: "width 0.5s ease",
  },
  stepList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
    marginTop: 18,
  },
  stepItem: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e6eaf2",
    background: "rgba(255,255,255,0.85)",
    fontSize: 14,
    color: "#475569",
  },
  stepItemActive: {
    borderColor: "#c7d2fe",
    background: "#eef2ff",
    color: "#1e293b",
    fontWeight: 700,
  },
  stepIcon: {
    width: 18,
    textAlign: "center",
    fontWeight: 800,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 12,
    marginTop: 18,
  },
  statPill: {
    border: "1px solid #e6eaf2",
    borderRadius: 14,
    padding: "12px 14px",
    background: "#fff",
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 800,
    color: "#0f172a",
  },
  summaryRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 16,
    fontSize: 13,
    color: "#475569",
  },
  errorText: {
    fontSize: 14,
    color: "#991b1b",
    lineHeight: 1.5,
  },
};
