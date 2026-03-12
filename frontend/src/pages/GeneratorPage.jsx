import React, { useEffect, useMemo, useState } from "react";
import EndpointSelector from "../components/EndpointSelector";
import GenerationOptions from "../components/GenerationOptions";
import TestCaseTable from "../components/TestCaseTable";
import TestCaseDrawer from "../components/TestCaseDrawer";
import ExportButtons from "../components/ExportButtons";
import { TEST_CASE_CSV_COLUMNS } from "../utils/testCaseColumns";

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

function getSpecSummary(specQuality) {
  return specQuality?.summary || null;
}

export default function GeneratorPage({ projectId, onBack }) {
  const [endpointsLoading, setEndpointsLoading] = useState(true);
  const [endpointsErr, setEndpointsErr] = useState("");
  const [endpoints, setEndpoints] = useState([]);

  const [selection, setSelection] = useState({
    selected_endpoint_ids: [],
    filter: { q: "", method: "ALL", authOnly: false, tag: "ALL" },
  });

  const [options, setOptions] = useState({
    include: ["contract", "schema"],
    env: "staging",
    auth_profile: "device",
    guidance: "",
    ai: false,
    spec_source: "",
    generation_mode: "balanced",
  });

  const [run, setRun] = useState({
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
  });

  const [activeTab, setActiveTab] = useState("table");
  const [drawer, setDrawer] = useState({ open: false, row: null });

  const tableRows = useMemo(
    () => deriveTableRows(run.testplan),
    [run.testplan],
  );

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
    loadEndpoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

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
      .map((e) => ({ method: e.method, path: e.path, id: e.id }));

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

      setRun({
        run_id: data.run_id || "",
        status: "done",
        error: null,
        generation_mode: data.generation_mode || "balanced",
        spec_quality: data.spec_quality || null,
        blocked_endpoints: Array.isArray(data.blocked_endpoints)
          ? data.blocked_endpoints
          : [],
        partial_endpoints: Array.isArray(data.partial_endpoints)
          ? data.partial_endpoints
          : [],
        eligible_endpoints: Array.isArray(data.eligible_endpoints)
          ? data.eligible_endpoints
          : [],
        testplan: data.testplan || null,
        report: data.report || null,
      });

      setActiveTab("table");
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
    <div className="generator-workspace">
      <section className="page-card">
        <div className="section-head generator-topbar">
          <div>
            <h3 style={{ margin: 0 }}>Generate Test Cases</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              Project: {projectId || "No project selected"}
            </p>
          </div>

          <div className="generator-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => onBack?.()}
            >
              ← Back
            </button>

            <button
              type="button"
              className="secondary-btn"
              onClick={() => loadEndpoints()}
              disabled={endpointsLoading || !projectId}
            >
              Reload Endpoints
            </button>

            <button
              type="button"
              className="secondary-btn"
              onClick={() => loadEndpoints(options.spec_source || "")}
              disabled={!projectId}
            >
              Load from Spec URL
            </button>

            <button
              type="button"
              className="primary-btn"
              onClick={generate}
              disabled={run.status === "running" || !projectId}
            >
              {run.status === "running" ? "Generating…" : "Generate Test Cases"}
            </button>
          </div>
        </div>

        {!projectId && (
          <div className="info-box" style={{ marginTop: 14 }}>
            Select a project first from the Projects page to load endpoints and
            generate AI test cases.
          </div>
        )}
      </section>

      <div className="generator-grid">
        <section className="page-card generator-left">
          <div className="generator-panel-title">Endpoints</div>

          {endpointsLoading && (
            <div className="info-box">Loading endpoints…</div>
          )}

          {!!endpointsErr && (
            <div className="error-box">Error: {endpointsErr}</div>
          )}

          {!endpointsLoading && !endpointsErr && projectId && (
            <EndpointSelector
              endpoints={endpoints}
              selection={selection}
              onChange={setSelection}
            />
          )}
        </section>

        <div className="generator-right">
          <section className="page-card">
            <div className="generator-panel-title">Options</div>

            <GenerationOptions options={options} onChange={setOptions} />

            {run.spec_quality && (
              <div className="info-box" style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>
                  Spec Analysis
                </div>

                <div className="generator-kpi-row">
                  <div className="generator-kpi-box">
                    <div className="generator-kpi-label">Mode</div>
                    <div className="generator-kpi-value">
                      {run.generation_mode}
                    </div>
                  </div>

                  <div className="generator-kpi-box">
                    <div className="generator-kpi-label">Health</div>
                    <div className="generator-kpi-value">
                      {run.spec_quality?.spec_health_score ?? "—"}
                    </div>
                  </div>

                  <div className="generator-kpi-box">
                    <div className="generator-kpi-label">Ready</div>
                    <div className="generator-kpi-value">
                      {getSpecSummary(run.spec_quality)?.ready ?? "—"}
                    </div>
                  </div>

                  <div className="generator-kpi-box">
                    <div className="generator-kpi-label">Partial</div>
                    <div className="generator-kpi-value">
                      {getSpecSummary(run.spec_quality)?.partial ?? "—"}
                    </div>
                  </div>

                  <div className="generator-kpi-box">
                    <div className="generator-kpi-label">Blocked</div>
                    <div className="generator-kpi-value">
                      {getSpecSummary(run.spec_quality)?.blocked ?? "—"}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12, fontSize: 13 }}>
                  <b>Total endpoints:</b>{" "}
                  {getSpecSummary(run.spec_quality)?.total_endpoints ?? "—"}
                  {" · "}
                  <b>Eligible:</b> {run.eligible_endpoints?.length ?? 0}
                  {" · "}
                  <b>Partial shown:</b> {run.partial_endpoints?.length ?? 0}
                  {" · "}
                  <b>Blocked for mode:</b> {run.blocked_endpoints?.length ?? 0}
                </div>

                {run.partial_endpoints?.length > 0 && (
                  <div className="generator-warning-text">
                    Some selected endpoints are usable, but have partial schema
                    quality issues. Suggested fixes are shown below.
                  </div>
                )}

                {run.blocked_endpoints?.length > 0 && (
                  <div className="generator-warning-text">
                    Some selected endpoints were excluded for the current
                    generation mode due to spec issues.
                  </div>
                )}

                {run.partial_endpoints?.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>
                      Partial Endpoints / Suggestions
                    </div>

                    <div className="generator-issue-list">
                      {run.partial_endpoints.map((ep, i) => (
                        <div
                          key={`${ep.endpoint_id || i}-partial-${i}`}
                          className="generator-issue-card"
                        >
                          <div className="generator-issue-title">
                            {ep.method || ep.endpoint_id?.split(" ")[0] || "—"}{" "}
                            {ep.path ||
                              ep.endpoint_id?.split(" ").slice(1).join(" ") ||
                              ""}
                          </div>

                          <div className="generator-issue-meta">
                            status: {ep.status || "partial"} · issues:{" "}
                            {ep.issues_count ?? ep.issues?.length ?? 0}
                          </div>

                          <div style={{ marginTop: 6 }}>
                            {(ep.issues || []).map((issue, idx) => (
                              <div key={idx} style={{ marginBottom: 12 }}>
                                <div className="generator-issue-text">
                                  {issue?.message || issue?.code || "-"}
                                </div>

                                {issue?.suggested_fix && (
                                  <div className="generator-fix-box">
                                    <div className="generator-fix-title">
                                      Suggested Fix
                                    </div>

                                    <div className="generator-fix-meta">
                                      {issue.code || "ISSUE"}
                                      {issue.severity
                                        ? ` · ${issue.severity}`
                                        : ""}
                                      {issue.suggested_fix?.type
                                        ? ` · Type: ${issue.suggested_fix.type}`
                                        : ""}
                                      {issue.suggested_fix?.format
                                        ? ` · Format: ${issue.suggested_fix.format}`
                                        : ""}
                                    </div>

                                    <pre className="generator-fix-code">
                                      {issue.suggested_fix?.content || ""}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {run.blocked_endpoints?.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>
                      Blocked / Excluded Endpoints
                    </div>

                    <div className="generator-issue-list">
                      {run.blocked_endpoints.map((ep, i) => (
                        <div
                          key={`${ep.endpoint_id || i}-blocked-${i}`}
                          className="generator-issue-card"
                        >
                          <div className="generator-issue-title">
                            {ep.method || ep.endpoint_id?.split(" ")[0] || "—"}{" "}
                            {ep.path ||
                              ep.endpoint_id?.split(" ").slice(1).join(" ") ||
                              ""}
                          </div>

                          <div className="generator-issue-meta">
                            status: {ep.status || "blocked"} · issues:{" "}
                            {ep.issues_count ?? ep.issues?.length ?? 0}
                          </div>

                          <div style={{ marginTop: 6 }}>
                            {(ep.issues || []).map((issue, idx) => (
                              <div key={idx} style={{ marginBottom: 12 }}>
                                <div className="generator-issue-text">
                                  {issue?.message || issue?.code || "-"}
                                </div>

                                {issue?.suggested_fix && (
                                  <div className="generator-fix-box">
                                    <div className="generator-fix-title">
                                      Suggested Fix
                                    </div>

                                    <div className="generator-fix-meta">
                                      {issue.code || "ISSUE"}
                                      {issue.severity
                                        ? ` · ${issue.severity}`
                                        : ""}
                                      {issue.suggested_fix?.type
                                        ? ` · Type: ${issue.suggested_fix.type}`
                                        : ""}
                                      {issue.suggested_fix?.format
                                        ? ` · Format: ${issue.suggested_fix.format}`
                                        : ""}
                                    </div>

                                    <pre className="generator-fix-code">
                                      {issue.suggested_fix?.content || ""}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <ExportButtons
                disabled={!run.testplan}
                onExportJson={exportJson}
                onExportCsv={exportCsv}
              />
            </div>

            {run.report && (
              <div className="info-box" style={{ marginTop: 14 }}>
                <b>Report:</b> total={run.report.total_cases ?? "—"},{" "}
                needs_review={run.report.needs_review ?? "—"}
                {Array.isArray(run.report.warnings) &&
                  run.report.warnings.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <b>Warnings:</b>
                      <ul style={{ marginTop: 6 }}>
                        {run.report.warnings.slice(0, 5).map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            )}

            {run.status === "error" && (
              <div className="error-box" style={{ marginTop: 14 }}>
                <div>Error: {run.error?.message || "Unknown error"}</div>
                {run.blocked_endpoints?.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 13 }}>
                    See Spec Analysis below for the exact endpoint issue.
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="page-card generator-preview-card">
            <div className="generator-preview-header">
              <div className="generator-panel-title">Preview</div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className={
                    activeTab === "table"
                      ? "generator-tab active"
                      : "generator-tab"
                  }
                  onClick={() => setActiveTab("table")}
                >
                  Table View
                </button>

                <button
                  type="button"
                  className={
                    activeTab === "json"
                      ? "generator-tab active"
                      : "generator-tab"
                  }
                  onClick={() => setActiveTab("json")}
                  disabled={!run.testplan}
                >
                  JSON View
                </button>
              </div>
            </div>

            {activeTab === "table" ? (
              <TestCaseTable
                rows={tableRows}
                onRowClick={(row) => setDrawer({ open: true, row })}
              />
            ) : (
              <pre className="generator-json-box">
                {run.testplan
                  ? JSON.stringify(run.testplan, null, 2)
                  : "No output yet."}
              </pre>
            )}
          </section>
        </div>
      </div>

      <TestCaseDrawer
        open={drawer.open}
        row={drawer.row}
        onClose={() => setDrawer({ open: false, row: null })}
      />
    </div>
  );
}
