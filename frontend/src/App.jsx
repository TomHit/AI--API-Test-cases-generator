import React, { useEffect, useState } from "react";
import DashboardPage from "./pages/DashboardPage";
import GeneratorPage from "./pages/GeneratorPage";

export default function App() {
  const [page, setPage] = useState("dashboard"); // "dashboard" | "generator"
  const [projectId, setProjectId] = useState("");

  // restore last project (optional)
  useEffect(() => {
    const last = localStorage.getItem("last_project_id") || "";
    if (last) {
      setProjectId(last);
      setPage("generator");
    }
  }, []);

  function openProject(id) {
    setProjectId(id);
    localStorage.setItem("last_project_id", id);
    setPage("generator");
  }

  function goBack() {
    setPage("dashboard");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa" }}>
      {page === "dashboard" ? (
        <DashboardPage onOpenProject={openProject} />
      ) : (
        <GeneratorPage projectId={projectId} onBack={goBack} />
      )}
    </div>
  );
}
