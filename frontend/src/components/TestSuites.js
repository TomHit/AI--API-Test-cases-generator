import React from "react";

function TestSuites() {
  const suites = [
    { name: "Smoke Tests", count: 5 },
    { name: "Regression Tests", count: 20 },
    { name: "Integration Tests", count: 12 },
  ];

  return (
    <div>
      <h2>Test Suites</h2>
      <ul>
        {suites.map((suite, idx) => (
          <li key={idx}>
            🧾 {suite.name} ({suite.count} tests)
          </li>
        ))}
      </ul>
    </div>
  );
}

export default TestSuites;
