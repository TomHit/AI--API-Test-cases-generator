import React, { useEffect, useMemo, useState } from "react";
import TestCaseTable from "../components/TestCaseTable";
import TestCaseDrawer from "../components/TestCaseDrawer";
import { TEST_CASE_CSV_COLUMNS } from "../utils/testCaseColumns";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
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

  testplan.suites.forEach((suite, si) => {
    safeArray(suite.cases).forEach((tc, ci) => {
      rows.push({
        suite_id: suite.suite_id || "",
        suite_name: suite.name || suite.suite_id || "Untitled Suite",
        id: tc.id || "",
        title: tc.title || "",
        module: tc.module || "",
        test_type: tc.test_type || "",
        priority: tc.priority || "",
        objective: tc.objective || "",
        preconditions: safeArray(tc.preconditions),
        test_data: tc.test_data || {},
        test_data_summary: summarizeTestData(tc.test_data),
        steps: safeArray(tc.steps),
        expected_results: safeArray(tc.expected_results),
        api_details: tc.api_details || {},
        validation_focus: safeArray(tc.validation_focus),
        references: safeArray(tc.references),
        needs_review: !!tc.needs_review,
        review_notes: tc.review_notes || "",
        ref: { suiteIndex: si, caseIndex: ci },
      });
    });
  });

  return rows;
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

export default function TestCasesPage({ projectId, generatedRun }) {
  const testplan = generatedRun?.testplan || null;

  const allRows = useMemo(() => deriveTableRows(testplan), [testplan]);

  const suiteOptions = useMemo(() => {
    const map = new Map();
    for (const row of allRows) {
      if (!map.has(row.suite_id)) {
        map.set(row.suite_id, {
          suite_id: row.suite_id,
          suite_name: row.suite_name,
          count: 0,
        });
      }
      map.get(row.suite_id).count += 1;
    }
    return Array.from(map.values());
  }, [allRows]);

  const [selectedSuiteId, setSelectedSuiteId] = useState("ALL");
  const [selectedType, setSelectedType] = useState("ALL");
  const [selectedPriority, setSelectedPriority] = useState("ALL");
  const [reviewFilter, setReviewFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState({ open: false, row: null });

  useEffect(() => {
    setSelectedSuiteId("ALL");
    setSelectedType("ALL");
    setSelectedPriority("ALL");
    setReviewFilter("ALL");
    setQuery("");
    setDrawer({ open: false, row: null });
  }, [generatedRun?.run_id, generatedRun?.testplan]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return allRows.filter((row) => {
      const suiteOk =
        selectedSuiteId === "ALL" ? true : row.suite_id === selectedSuiteId;

      const typeOk =
        selectedType === "ALL" ? true : row.test_type === selectedType;

      const priorityOk =
        selectedPriority === "ALL" ? true : row.priority === selectedPriority;

      const reviewOk =
        reviewFilter === "ALL"
          ? true
          : reviewFilter === "YES"
            ? row.needs_review
            : !row.needs_review;

      const haystack = [
        row.id,
        row.title,
        row.module,
        row.suite_name,
        row.api_details?.method,
        row.api_details?.path,
        row.objective,
        row.review_notes,
      ]
        .join(" ")
        .toLowerCase();

      const queryOk = !q || haystack.includes(q);

      return suiteOk && typeOk && priorityOk && reviewOk && queryOk;
    });
  }, [
    allRows,
    selectedSuiteId,
    selectedType,
    selectedPriority,
    reviewFilter,
    query,
  ]);

  const typeOptions = useMemo(() => {
    return Array.from(
      new Set(allRows.map((r) => r.test_type).filter(Boolean)),
    ).sort();
  }, [allRows]);

  const priorityOptions = useMemo(() => {
    return Array.from(
      new Set(allRows.map((r) => r.priority).filter(Boolean)),
    ).sort();
  }, [allRows]);

  function exportJson() {
    if (!testplan) return;
    downloadText(
      "test_cases.json",
      JSON.stringify(testplan, null, 2),
      "application/json",
    );
  }

  function exportCsv() {
    if (!filteredRows.length) return;
    const csv = buildCsvFromTable(filteredRows);
    downloadText("test_cases.csv", csv, "text/csv");
  }

  if (!testplan) {
    return (
      <div className="page-card">
        <h3>Test Cases</h3>
        <p className="muted">
          No generated test cases yet. Go to Generate Tests, run generation,
          then open them here.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <style>{`
      @media (max-width: 1100px) {
        .tc-toolbar {
          flex-direction: column !important;
          align-items: stretch !important;
        }

        .tc-toolbar-actions {
          justify-content: flex-start !important;
        }
      }

      @media (max-width: 900px) {
        .tc-filter-grid {
          grid-template-columns: 1fr !important;
        }
      }
    `}</style>

      <section style={styles.toolbarCard}>
        <div className="tc-toolbar" style={styles.toolbarRow}>
          <div>
            <div style={styles.panelTitle}>Test Cases</div>
            <div style={styles.panelSubtle}>
              Project: {projectId || "Select a project first"}
            </div>
          </div>

          <div className="tc-toolbar-actions" style={styles.toolbarActions}>
            <button
              type="button"
              className="secondary-btn"
              onClick={exportJson}
            >
              Export JSON
            </button>
            <button type="button" className="secondary-btn" onClick={exportCsv}>
              Export CSV
            </button>
          </div>
        </div>
      </section>

      <section style={styles.filterCard}>
        <div className="tc-filter-grid" style={styles.filterGrid}>
          <div>
            <label style={styles.label}>Search</label>
            <input
              type="text"
              placeholder="Search case ID, title, endpoint..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div>
            <label style={styles.label}>Suite</label>
            <select
              value={selectedSuiteId}
              onChange={(e) => setSelectedSuiteId(e.target.value)}
            >
              <option value="ALL">All suites</option>
              {suiteOptions.map((suite) => (
                <option key={suite.suite_id} value={suite.suite_id}>
                  {suite.suite_name} ({suite.count})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={styles.label}>Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="ALL">All types</option>
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={styles.label}>Priority</label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
            >
              <option value="ALL">All priorities</option>
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={styles.label}>Review</label>
            <select
              value={reviewFilter}
              onChange={(e) => setReviewFilter(e.target.value)}
            >
              <option value="ALL">All</option>
              <option value="YES">Needs review</option>
              <option value="NO">Ready</option>
            </select>
          </div>
        </div>
      </section>

      <section style={styles.tableCard}>
        <div style={styles.tableHeadRow}>
          <div style={styles.tableTitle}>Cases</div>
          <div style={styles.metaText}>Click any row to open full details.</div>
        </div>

        <TestCaseTable
          rows={filteredRows}
          loading={false}
          onRowClick={(row) => setDrawer({ open: true, row })}
        />
      </section>

      <TestCaseDrawer
        open={drawer.open}
        row={drawer.row}
        onClose={() => setDrawer({ open: false, row: null })}
      />
    </div>
  );
}

const styles = {
  page: {
    display: "grid",
    gap: 12,
    width: "100%",
    minWidth: 0,
    padding: 0,
    margin: 0,
  },

  toolbarCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    background: "#fff",
    padding: 16,
  },

  toolbarRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },

  toolbarActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
  },

  panelTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#111827",
    marginBottom: 4,
  },

  panelSubtle: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 1.4,
  },

  filterCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    background: "#fff",
    padding: 16,
  },

  filterGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
    gap: 12,
    alignItems: "end",
  },

  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 700,
    color: "#475569",
    marginBottom: 8,
  },

  tableCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    background: "#fff",
    padding: 16,
    minWidth: 0,
  },

  tableHeadRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 12,
  },

  tableTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#111827",
  },

  metaText: {
    fontSize: 13,
    color: "#6b7280",
  },
};
