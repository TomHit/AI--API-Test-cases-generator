import React from "react";

function ResultsDashboard({ endpoints = [] }) {
  // Defensive: ensure endpoints is always an array
  const folderStats = endpoints.reduce((acc, ep) => {
    const folder = ep.folder || "Smoke";
    if (!acc[folder]) {
      acc[folder] = { total: 0, passed: 0, failed: 0 };
    }
    acc[folder].total++;
    if (ep.status === "Passed") acc[folder].passed++;
    else if (ep.status === "Failed") acc[folder].failed++;
    return acc;
  }, {});

  const overall = Object.values(folderStats).reduce(
    (sum, r) => ({
      total: sum.total + r.total,
      passed: sum.passed + r.passed,
      failed: sum.failed + r.failed,
    }),
    { total: 0, passed: 0, failed: 0 },
  );

  return (
    <div>
      <h2>Results Dashboard</h2>
      <p>Total Tests: {overall.total}</p>
      <p>✅ Passed: {overall.passed}</p>
      <p>❌ Failed: {overall.failed}</p>

      <h3>By Folder</h3>
      <table border="1" cellPadding="5">
        <thead>
          <tr>
            <th>Folder</th>
            <th>Total</th>
            <th>✅ Passed</th>
            <th>❌ Failed</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(folderStats).map(([folder, data], idx) => (
            <tr key={idx}>
              <td>{folder}</td>
              <td>{data.total}</td>
              <td>{data.passed}</td>
              <td>{data.failed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ResultsDashboard;
