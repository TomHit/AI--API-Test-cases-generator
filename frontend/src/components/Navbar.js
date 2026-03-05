import React from "react";

function Navbar({ activeTab, setActiveTab }) {
  const tabs = [
    { id: "endpoints", label: "Endpoints" },
    { id: "bulk", label: "Bulk Upload" },
    { id: "suites", label: "Test Suites" },
    { id: "folders", label: "Test Folders" },
  ];

  return (
    <nav>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          style={{
            fontWeight: activeTab === tab.id ? "bold" : "normal",
            marginRight: "10px",
          }}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export default Navbar;
