import React, { useEffect, useMemo, useState } from "react";
import EndpointSelector from "../components/EndpointSelector";
import ResultsSummary from "../components/ResultsSummary";
import { TEST_CASE_CSV_COLUMNS } from "../utils/testCaseColumns";

const RUNNING_STEPS = [
  "Reading API specification",
  "Analyzing selected endpoints",
  "Building contract test cases",
  "Building schema validation",
  "Generating negative scenarios",
  "Preparing final preview",
];

function safeJsonParse(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function summarizeTestData(testData) {
  if (!testData || typeof testData !== "object") return "-";
  const pathCount = Object.keys(testData.path_params || {}).length;
  const queryCount = Object.keys(testData.query_params || {}).length;
  const headerCount = Object.keys(testData.headers || {}).length;
  const cookieCount = Object.keys(testData.cookies || {}).length;
  const hasBody =
    testData.request_body !== undefined && testData.request_body !== null;

  return `path:${pathCount} query:${queryCount} headers:${headerCount} cookies:${cookieCount} body:${hasBody ? "yes" : "no"}`;
}

function deriveTableRows(testplan) {
  const rows = [];
  if (!testplan?.suites) return rows;

  testplan.suites.forEach((s, si) => {
    (s.cases || []).forEach((tc, ci) => {
      rows.push({
        suite_id: s.suite_id || "",
        id: tc.id || "",
        title: tc.title || "",
        module: tc.module || "",
        test_type: tc.test_type || "",
        priority: tc.priority || "",
        objective: tc.objective || "",
        preconditions: Array.isArray(tc.preconditions) ? tc.preconditions : [],
        test_data: tc.test_data || {},
        test_data_summary: summarizeTestData(tc.test_data),
        steps: Array.isArray(tc.steps) ? tc.steps : [],
        expected_results: Array.isArray(tc.expected_results)
          ? tc.expected_results
          : [],
        api_details: tc.api_details || {},
        validation_focus: Array.isArray(tc.validation_focus)
          ? tc.validation_focus
          : [],
        references: Array.isArray(tc.references) ? tc.references : [],
        needs_review: !!tc.needs_review,
        review_notes: tc.review_notes || "",
        ref: { suiteIndex: si, caseIndex: ci },
      });
    });
  });

  return rows;
}

function downloadText(filename, text, mime = "application/octet-stream") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCsvValue(v) {
  const s = String(v ?? "");
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

function buildCsvFromTable(rows) {
  const header = TEST_CASE_CSV_COLUMNS.map((c) => c.label);
  const lines = [header.join(",")];

  for (const r of rows) {
    const values = TEST_CASE_CSV_COLUMNS.map((c) => toCsvValue(c.getValue(r)));
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

export default function GeneratorPage({
  projectId,
  onBack,
  onViewTestCases,
  onSaveGeneratedRun,
  generatedRun,
  options,
}) {
  const [endpointsLoading, setEndpointsLoading] = useState(true);
  const [endpointsErr, setEndpointsErr] = useState("");
  const [endpoints, setEndpoints] = useState([]);

  const [selection, setSelection] = useState({
    selected_endpoint_ids: [],
    filter: { q: "", method: "ALL", authOnly: false, tag: "ALL" },
  });

  const [run, setRun] = useState(
    generatedRun || {
      run_id: "",
      status: "idle",
      error: null,
      generation_mode: "balanced",
      spec_quality: null,
      blocked_endpoints: [],
      partial_endpoints: [],
      eligible_endpoints: [],
      testplan: null,
      report: null,
    },
  );

  const [runningStepIndex, setRunningStepIndex] = useState(0);

  const tableRows = useMemo(
    () => deriveTableRows(run.testplan),
    [run.testplan],
  );

  const selectedCount = (selection.selected_endpoint_ids || []).length;
  const runningStepLabel =
    run.status === "running"
      ? RUNNING_STEPS[runningStepIndex % RUNNING_STEPS.length]
      : null;

  useEffect(() => {
    if (generatedRun?.testplan) {
      setRun(generatedRun);
    }
  }, [generatedRun]);

  useEffect(() => {
    if (run.status !== "running") {
      setRunningStepIndex(0);
      return;
    }

    const id = window.setInterval(() => {
      setRunningStepIndex((prev) => (prev + 1) % RUNNING_STEPS.length);
    }, 1100);

    return () => window.clearInterval(id);
  }, [run.status]);

  async function loadEndpoints(specSource = "") {
    if (!projectId) {
      setEndpoints([]);
      setEndpointsLoading(false);
      return;
    }

    setEndpointsLoading(true);
    setEndpointsErr("");

    try {
      let url = `/api/projects/${encodeURIComponent(projectId)}/endpoints`;
      if (specSource) {
        url += `?spec_source=${encodeURIComponent(specSource)}`;
      }

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      const text = await res.text();
      const data = safeJsonParse(text);

      if (!res.ok) {
        throw new Error(
          data?.message || `Failed to load endpoints (${res.status})`,
        );
      }

      setEndpoints(Array.isArray(data) ? data : []);
    } catch (e) {
      setEndpointsErr(e.message || String(e));
      setEndpoints([]);
    } finally {
      setEndpointsLoading(false);
    }
  }

  useEffect(() => {
    loadEndpoints(options?.spec_source || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, options?.spec_source]);

  async function generate() {
    const selected = selection.selected_endpoint_ids;

    if (!projectId) {
      alert("Select a project first.");
      return;
    }

    if (!selected.length) {
      alert("Select at least 1 endpoint.");
      return;
    }

    setRun((r) => ({
      ...r,
      status: "running",
      error: null,
      spec_quality: null,
      blocked_endpoints: [],
      partial_endpoints: [],
      eligible_endpoints: [],
      testplan: null,
      report: null,
    }));

    const endpointRefs = endpoints
      .filter((e) => selected.includes(e.id))
      .map((e) => ({
        method: e.method,
        path: e.path,
        id: e.id,
      }));

    const payload = {
      project_id: projectId,
      env: options.env,
      auth_profile: options.auth_profile,
      include: options.include,
      guidance: options.guidance,
      endpoints: endpointRefs,
      ai: !!options.ai,
      spec_source: options.spec_source || "",
      generation_mode: options.generation_mode || "balanced",
    };

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      const data = safeJsonParse(text);

      if (!res.ok) {
        const err = new Error(
          data?.message || `Generate failed: ${res.status}`,
        );
        err.details = data?.details || null;
        throw err;
      }

      const nextRun = {
        run_id: data.run_id || "",
        status: "done",
        error: null,
        generation_mode:
          data.generation_mode || data.details?.generation_mode || "balanced",
        spec_quality: data.spec_quality || data.details?.spec_quality || null,
        blocked_endpoints: Array.isArray(data.blocked_endpoints)
          ? data.blocked_endpoints
          : Array.isArray(data.details?.blocked_endpoints)
            ? data.details.blocked_endpoints
            : [],
        partial_endpoints: Array.isArray(data.partial_endpoints)
          ? data.partial_endpoints
          : Array.isArray(data.details?.partial_endpoints)
            ? data.details.partial_endpoints
            : [],
        eligible_endpoints: Array.isArray(data.eligible_endpoints)
          ? data.eligible_endpoints
          : Array.isArray(data.details?.eligible_endpoints)
            ? data.details.eligible_endpoints
            : [],
        testplan: data.testplan || null,
        report: data.report || null,
      };
      setRun(nextRun);

      if (onSaveGeneratedRun) {
        onSaveGeneratedRun(nextRun);
      }
    } catch (e) {
      setRun((r) => ({
        ...r,
        status: "error",
        error: {
          message: e.message || String(e),
          details: e.details || null,
        },
        generation_mode:
          e.details?.generation_mode || r.generation_mode || "balanced",
        spec_quality: e.details?.spec_quality || null,
        blocked_endpoints: Array.isArray(e.details?.blocked_endpoints)
          ? e.details.blocked_endpoints
          : [],
        partial_endpoints: Array.isArray(e.details?.partial_endpoints)
          ? e.details.partial_endpoints
          : [],
        eligible_endpoints: Array.isArray(e.details?.eligible_endpoints)
          ? e.details.eligible_endpoints
          : [],
        testplan: null,
        report: null,
      }));
    }
  }

  function exportJson() {
    if (!run.testplan) return;
    downloadText(
      "test_cases.json",
      JSON.stringify(run.testplan, null, 2),
      "application/json",
    );
  }

  function exportCsv() {
    if (!tableRows.length) return;
    const csv = buildCsvFromTable(tableRows);
    downloadText("test_cases.csv", csv, "text/csv");
  }

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes buttonSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 860px) {
          .strict-summary-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }

        @media (max-width: 560px) {
          .strict-summary-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @keyframes dotPulse {
          0%, 100% { opacity: 0.35; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1); }
        }

        .gen-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #ffffff;
          border-radius: 999px;
          display: inline-block;
          animation: buttonSpin 0.8s linear infinite;
          flex-shrink: 0;
        }

        .gen-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #60a5fa;
          animation: dotPulse 1.1s ease-in-out infinite;
        }

        .gen-dot:nth-child(2) { animation-delay: 0.12s; }
        .gen-dot:nth-child(3) { animation-delay: 0.24s; }
        .gen-dot:nth-child(4) { animation-delay: 0.36s; }
        .gen-dot:nth-child(5) { animation-delay: 0.48s; }

        @media (max-width: 1220px) {
          .generator-main-grid {
            grid-template-columns: 1fr !important;
          }

          .generator-left-pane {
            position: relative !important;
            top: 0 !important;
            max-height: none !important;
          }

          .generator-left-body {
            max-height: none !important;
          }

          
        }

        @media (max-width: 860px) {
          .results-header {
            flex-direction: column !important;
            align-items: stretch !important;
          }

          .results-top-actions {
            width: 100%;
            justify-content: flex-start !important;
          }

          .explorer-footer-top {
            flex-direction: column !important;
            align-items: stretch !important;
          }

          .explorer-footer-actions {
            width: 100%;
            justify-content: stretch !important;
          }

          .explorer-footer-actions > button {
            flex: 1 1 auto;
          }

         

          .success-actions {
            flex-direction: column !important;
          }

          .success-actions > button {
            width: 100%;
          }
        }
      `}</style>

      {!projectId && (
        <div style={styles.notice}>
          Select a project first from the Projects page to load endpoints and
          generate AI test cases.
        </div>
      )}

      <section className="generator-main-grid" style={styles.mainGrid}>
        <aside className="generator-left-pane" style={styles.leftPane}>
          <div style={styles.leftPaneHeader}>
            <div style={styles.leftTitle}>APIs</div>
            <div style={styles.leftSubtle}>Endpoint Explorer</div>
          </div>

          <div className="generator-left-body" style={styles.explorerBody}>
            {endpointsLoading && (
              <div style={styles.infoBox}>Loading endpoints...</div>
            )}

            {!!endpointsErr && (
              <div style={{ ...styles.infoBox, ...styles.errorInfo }}>
                Error: {endpointsErr}
              </div>
            )}

            {!endpointsLoading && !endpointsErr && projectId && (
              <EndpointSelector
                endpoints={endpoints}
                selection={selection}
                onChange={setSelection}
              />
            )}
          </div>

          <div style={styles.explorerFooter}>
            <div
              className="explorer-footer-top"
              style={styles.explorerFooterTop}
            >
              <div style={styles.countBadge}>
                {selectedCount} endpoint{selectedCount === 1 ? "" : "s"}{" "}
                selected
              </div>

              <div
                className="explorer-footer-actions"
                style={styles.explorerFooterActions}
              >
                <button
                  type="button"
                  onClick={() => onBack?.()}
                  style={styles.secondaryBtn}
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={() => loadEndpoints(options.spec_source || "")}
                  disabled={endpointsLoading || !projectId}
                  style={styles.secondaryBtn}
                >
                  Reload
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={generate}
              disabled={
                !projectId || run.status === "running" || selectedCount === 0
              }
              style={{
                ...styles.primaryBtn,
                opacity:
                  !projectId || run.status === "running" || selectedCount === 0
                    ? 0.7
                    : 1,
              }}
            >
              {run.status === "running" ? (
                <>
                  <span className="gen-spinner" />
                  <span>Generating...</span>
                </>
              ) : (
                "Generate Tests"
              )}
            </button>
          </div>
        </aside>

        <section style={styles.rightPane}>
          <div className="results-header" style={styles.resultsHeader}>
            <div>
              <div style={styles.panelTitle}>Results</div>
              <div style={styles.panelSubtle}>
                Generate tests here, then open the dedicated Test Cases tab for
                full review.
              </div>
            </div>

            <div
              className="results-top-actions"
              style={styles.resultsTopActions}
            >
              <div style={styles.modeBadge}>
                {String(
                  run.generation_mode || options.generation_mode || "balanced",
                ).toUpperCase()}
              </div>

              <button
                type="button"
                onClick={exportJson}
                disabled={!run.testplan}
                style={styles.secondaryBtn}
              >
                Export JSON
              </button>

              <button
                type="button"
                onClick={exportCsv}
                disabled={!tableRows.length}
                style={styles.secondaryBtn}
              >
                CSV
              </button>
            </div>
          </div>

          <div style={styles.resultsInner}>
            {run.status === "running" && (
              <div style={styles.resultsProgress}>
                <div style={styles.resultsProgressTop}>
                  <span>
                    {runningStepLabel || "Building test cases now..."}
                  </span>
                  <div style={styles.dotGroup}>
                    <span className="gen-dot" />
                    <span className="gen-dot" />
                    <span className="gen-dot" />
                    <span className="gen-dot" />
                    <span className="gen-dot" />
                  </div>
                </div>
                <div style={styles.resultsProgressBarTrack}>
                  <div style={styles.resultsProgressBarFill} />
                </div>
              </div>
            )}

            {run.status === "error" && (
              <div
                style={{
                  ...styles.infoBox,
                  ...styles.errorInfo,
                  marginBottom: 16,
                }}
              >
                {run.error?.message ||
                  "Something went wrong during generation."}
              </div>
            )}
            {run.status === "error" &&
              (run.spec_quality ||
                run.blocked_endpoints.length ||
                run.partial_endpoints.length) && (
                <div style={styles.diagnosticsBox}>
                  <div style={styles.diagnosticsTitle}>
                    Spec improvement suggestions
                  </div>

                  {run.spec_quality?.summary && (
                    <div
                      className="strict-summary-grid"
                      style={styles.summaryMiniGrid}
                    >
                      <div style={styles.summaryMiniCard}>
                        <div style={styles.summaryMiniLabel}>Spec health</div>
                        <div style={styles.summaryMiniValue}>
                          {run.spec_quality.spec_health_score ?? "-"}
                        </div>
                      </div>

                      <div style={styles.summaryMiniCard}>
                        <div style={styles.summaryMiniLabel}>Warnings</div>
                        <div style={styles.summaryMiniValue}>
                          {run.spec_quality.summary.warnings ?? 0}
                        </div>
                      </div>

                      <div style={styles.summaryMiniCard}>
                        <div style={styles.summaryMiniLabel}>Partial</div>
                        <div style={styles.summaryMiniValue}>
                          {run.spec_quality.summary.partial ?? 0}
                        </div>
                      </div>

                      <div style={styles.summaryMiniCard}>
                        <div style={styles.summaryMiniLabel}>Blocked</div>
                        <div style={styles.summaryMiniValue}>
                          {run.spec_quality.summary.blocked ?? 0}
                        </div>
                      </div>
                    </div>
                  )}

                  {run.blocked_endpoints.length > 0 && (
                    <div style={styles.diagnosticsSection}>
                      <div style={styles.diagnosticsLabel}>
                        Affected Endpoints
                      </div>

                      <div style={styles.issueList}>
                        {run.blocked_endpoints.map((item, idx) => (
                          <div key={idx} style={styles.issueCard}>
                            <div style={styles.issueTitle}>
                              {(item.method || "").toUpperCase()}{" "}
                              {item.path || ""}
                            </div>

                            <div style={styles.issueMeta}>
                              Status: {item.status || "-"} • Issues:{" "}
                              {item.issues_count ?? 0}
                            </div>

                            {Array.isArray(item.issues) &&
                              item.issues.map((issue, issueIdx) => (
                                <div
                                  key={issueIdx}
                                  style={styles.issueSubBlock}
                                >
                                  <div style={styles.issueText}>
                                    {issue.message}
                                  </div>

                                  {issue.suggested_fix?.content && (
                                    <div style={styles.fixBox}>
                                      <div style={styles.fixTitle}>
                                        Suggested patch (
                                        {issue.suggested_fix.format || "text"})
                                      </div>
                                      <pre style={styles.fixCode}>
                                        {issue.suggested_fix.content}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            {run.status === "done" && run.testplan && (
              <>
                <div style={{ marginBottom: 18 }}>
                  <ResultsSummary
                    rows={tableRows}
                    report={run.report}
                    testplan={run.testplan}
                  />
                </div>

                <div style={styles.successBox}>
                  <div style={styles.successTitle}>
                    Test generation completed
                  </div>
                  <div style={styles.successText}>
                    {tableRows.length} test case
                    {tableRows.length === 1 ? "" : "s"} generated successfully.
                    Open the dedicated Test Cases tab for readable review and
                    case details.
                  </div>

                  <div
                    className="success-actions"
                    style={styles.successActions}
                  >
                    <button
                      type="button"
                      onClick={onViewTestCases}
                      style={styles.primaryBtnCompact}
                    >
                      View Test Cases
                    </button>
                  </div>
                </div>
              </>
            )}

            {run.status === "idle" && (
              <div style={styles.emptyState}>
                <div style={styles.emptyStateTitle}>No generation yet</div>
                <div style={styles.emptyStateText}>
                  Select one or more endpoints from the explorer and click
                  Generate Tests.
                </div>
              </div>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}

const styles = {
  page: {
    display: "grid",
    gap: 2,
    padding: "0",
    width: "100%",
    minWidth: 0,
    margin: 0,
    background: "#f8fafc",
  },

  notice: {
    padding: 12,
    borderRadius: 12,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "420px minmax(0, 1fr)",
    gap: 10,
    alignItems: "start",
    width: "100%",
    minWidth: 0,
  },

  leftPane: {
    minWidth: 0,
    width: "100%",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    background: "#fff",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
    overflow: "hidden",
    position: "sticky",
    top: 0,
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr) auto",
    maxHeight: "100vh",
  },

  leftPaneHeader: {
    padding: "8px 12px 6px",
    borderBottom: "1px solid #eef2f7",
    background: "#ffffff",
  },

  leftTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#111827",
    letterSpacing: "-0.01em",
    lineHeight: 1.1,
    marginBottom: 2,
  },

  leftSubtle: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 1.4,
  },

  explorerBody: {
    padding: 4,
    minWidth: 0,
    overflow: "auto",
  },

  explorerFooter: {
    padding: 8,
    borderTop: "1px solid #eef2f7",
    background: "#ffffff",
    display: "grid",
    gap: 8,
  },

  explorerFooterTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  explorerFooterActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  countBadge: {
    padding: "5px 10px",
    borderRadius: 999,
    background: "#f3f4f6",
    color: "#374151",
    fontWeight: 700,
    fontSize: 11,
    whiteSpace: "nowrap",
  },
  summaryMiniGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
  },

  summaryMiniCard: {
    border: "1px solid #fdba74",
    background: "#fff7ed",
    borderRadius: 12,
    padding: 12,
  },

  summaryMiniLabel: {
    fontSize: 12,
    color: "#9a3412",
    marginBottom: 6,
    fontWeight: 700,
  },

  summaryMiniValue: {
    fontSize: 22,
    fontWeight: 800,
    color: "#7c2d12",
    lineHeight: 1,
  },

  diagnosticsBox: {
    marginTop: 12,
    border: "1px solid #fed7aa",
    background: "#fffaf5",
    borderRadius: 16,
    padding: 16,
    display: "grid",
    gap: 16,
  },

  diagnosticsTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#9a3412",
  },

  diagnosticsSection: {
    display: "grid",
    gap: 10,
  },

  diagnosticsLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: "#7c2d12",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  issueList: {
    display: "grid",
    gap: 10,
  },

  issueCard: {
    border: "1px solid #fdba74",
    background: "#fff7ed",
    borderRadius: 12,
    padding: 12,
    display: "grid",
    gap: 8,
  },

  issueTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#111827",
  },

  issueMeta: {
    fontSize: 12,
    color: "#7c2d12",
  },

  issueText: {
    fontSize: 13,
    color: "#44403c",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
  },

  issueSubBlock: {
    display: "grid",
    gap: 8,
    paddingTop: 6,
  },

  fixBox: {
    border: "1px solid #fcd34d",
    background: "#fffbeb",
    borderRadius: 12,
    padding: 10,
  },

  fixTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: "#92400e",
    marginBottom: 6,
  },

  fixCode: {
    margin: 0,
    padding: 12,
    borderRadius: 10,
    background: "#111827",
    color: "#e5e7eb",
    fontSize: 12,
    overflow: "auto",
    whiteSpace: "pre-wrap",
  },

  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    padding: "12px 16px",
    borderRadius: 12,
    border: "none",
    background: "#8b5cf6",
    color: "#fff",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: "none",
    whiteSpace: "nowrap",
  },

  primaryBtnCompact: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "12px 16px",
    borderRadius: 12,
    border: "none",
    background: "#8b5cf6",
    color: "#fff",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: "none",
    whiteSpace: "nowrap",
  },

  secondaryBtn: {
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    color: "#111827",
    whiteSpace: "nowrap",
  },

  infoBox: {
    padding: 12,
    borderRadius: 10,
    background: "#f8fafc",
    border: "1px solid #e6eaf2",
    color: "#475569",
  },

  errorInfo: {
    background: "#fef2f2",
    borderColor: "#fecaca",
    color: "#991b1b",
  },

  rightPane: {
    minWidth: 0,
    width: "100%",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    background: "#fff",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
    overflow: "hidden",
  },

  resultsHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: "14px 16px 12px",
    borderBottom: "1px solid #eef2f7",
    flexWrap: "wrap",
  },

  resultsTopActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },

  panelTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#111827",
    marginBottom: 4,
    lineHeight: 1.15,
  },

  panelSubtle: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 1.4,
    maxWidth: 620,
  },

  modeBadge: {
    padding: "8px 12px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid #dbe3f0",
    color: "#334155",
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  resultsInner: {
    padding: 16,
    minWidth: 0,
  },

  resultsProgress: {
    marginBottom: 14,
    padding: "6px 0 2px",
  },

  resultsProgressTop: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    color: "#475569",
    fontSize: 13,
    marginBottom: 8,
  },

  dotGroup: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },

  resultsProgressBarTrack: {
    height: 6,
    borderRadius: 999,
    background: "#e8edf7",
    overflow: "hidden",
  },

  resultsProgressBarFill: {
    width: "65%",
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #8b5cf6 0%, #60a5fa 100%)",
  },

  successBox: {
    marginTop: 8,
    padding: 18,
    borderRadius: 16,
    border: "1px solid #dbeafe",
    background: "#f8fbff",
    display: "grid",
    gap: 12,
  },

  successTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
  },

  successText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 1.5,
  },

  successActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },

  emptyState: {
    border: "1px dashed #dbe3ef",
    borderRadius: 16,
    padding: "28px 20px",
    textAlign: "center",
    background: "#fcfdff",
  },

  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#111827",
    marginBottom: 8,
  },

  emptyStateText: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 1.5,
  },
};
