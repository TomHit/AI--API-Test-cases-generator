import React, { useState } from "react";

function EndpointTable({ endpoints, setEndpoints }) {
  const [filter, setFilter] = useState("All");
  const [runFolderName, setRunFolderName] = useState("Smoke");

  const runEndpoint = (index) => {
    setEndpoints((prev) => {
      const updated = [...prev];
      updated[index].status = "Running...";
      return updated;
    });

    setTimeout(() => {
      setEndpoints((prev) => {
        const updated = [...prev];
        const outcome = Math.random() > 0.5 ? "Passed" : "Failed";
        updated[index].status = outcome;
        updated[index].lastRun = "Just now";
        return updated;
      });
    }, 2000);
  };

  const runAllEndpoints = () => {
    setEndpoints((prev) => prev.map((ep) => ({ ...ep, status: "Running..." })));

    setTimeout(() => {
      setEndpoints((prev) =>
        prev.map((ep) => {
          const outcome = Math.random() > 0.5 ? "Passed" : "Failed";
          return { ...ep, status: outcome, lastRun: "Just now" };
        }),
      );
    }, 2000);
  };

  const runFolder = (folderName) => {
    // Mark only endpoints in the selected folder as "Running..."
    setEndpoints((prev) =>
      prev.map((ep) =>
        ep.folder === folderName ? { ...ep, status: "Running..." } : ep,
      ),
    );

    setTimeout(() => {
      setEndpoints((prev) =>
        prev.map((ep) => {
          if (ep.folder === folderName) {
            const outcome = Math.random() > 0.5 ? "Passed" : "Failed";
            return { ...ep, status: outcome, lastRun: "Just now" };
          }
          return ep; // ✅ preserve other folders untouched
        }),
      );
    }, 2000);
  };

  const displayedEndpoints =
    filter === "All"
      ? endpoints
      : endpoints.filter((ep) => ep.folder === filter);

  return (
    <div>
      <h2>Endpoints</h2>

      {/* Folder filter dropdown */}
      <label>
        Filter by Folder:{" "}
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="All">All</option>
          <option value="Contract">Contract</option>
          <option value="Smoke">Smoke</option>
          <option value="Integration">Integration</option>
          <option value="Regression">Regression</option>
        </select>
      </label>

      <table border="1" cellPadding="5">
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Method</th>
            <th>Folder</th>
            <th>Status</th>
            <th>Last Run</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {displayedEndpoints.map((ep, idx) => (
            <tr key={idx}>
              <td>{ep.url}</td>
              <td>{ep.method}</td>
              <td>{ep.folder}</td>
              <td>
                {ep.status === "Running..." ? (
                  <span style={{ color: "orange" }}>⏳ Running...</span>
                ) : (
                  ep.status || "Not Run"
                )}
              </td>
              <td>{ep.lastRun || "-"}</td>
              <td>
                <button onClick={() => runEndpoint(idx)}>Run</button>
                <button>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: "10px" }}>
        <button onClick={runAllEndpoints}>Run All</button>{" "}
        <label>
          Run Folder:{" "}
          <select
            value={runFolderName}
            onChange={(e) => setRunFolderName(e.target.value)}
          >
            <option value="Contract">Contract</option>
            <option value="Smoke">Smoke</option>
            <option value="Integration">Integration</option>
            <option value="Regression">Regression</option>
          </select>
        </label>
        <button onClick={() => runFolder(runFolderName)}>
          Run Selected Folder
        </button>
      </div>
    </div>
  );
}

export default EndpointTable;
