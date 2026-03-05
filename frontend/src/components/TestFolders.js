import React, { useState } from "react";

function TestFolders() {
  const [folders, setFolders] = useState([
    {
      name: "Contract",
      tests: ["Schema Validation", "Field Presence", "Error Codes"],
      expanded: true,
    },
    {
      name: "Smoke",
      tests: ["Login API", "Basic User Fetch"],
      expanded: false,
    },
    {
      name: "Integration",
      tests: ["User Creation + Login", "Order Flow"],
      expanded: false,
    },
    {
      name: "Regression",
      tests: ["Legacy Endpoints", "Edge Cases"],
      expanded: false,
    },
  ]);

  const toggleFolder = (index) => {
    const updated = [...folders];
    updated[index].expanded = !updated[index].expanded;
    setFolders(updated);
  };

  return (
    <div>
      <h2>Test Folders</h2>
      <ul style={{ listStyleType: "none", paddingLeft: "0" }}>
        {folders.map((folder, idx) => (
          <li key={idx}>
            <button onClick={() => toggleFolder(idx)}>
              {folder.expanded ? "📂" : "📁"} {folder.name}
            </button>
            {folder.expanded && (
              <ul style={{ marginLeft: "20px" }}>
                {folder.tests.map((test, tIdx) => (
                  <li key={tIdx}>🧪 {test}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default TestFolders;
