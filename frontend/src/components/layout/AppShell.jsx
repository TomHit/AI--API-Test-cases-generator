import React from "react";
import Sidebar from "./Sidebar";
import HeaderBar from "./HeaderBar";
import RightAiPanel from "./RightAiPanel";

const PAGES_WITH_AI_PANEL = ["overview", "testCases", "reports"];

export default function AppShell({ activeNav, onChangeNav, children }) {
  const showAiPanel = PAGES_WITH_AI_PANEL.includes(activeNav);

  return (
    <div className={`app-shell ${showAiPanel ? "" : "no-ai-panel"}`}>
      <Sidebar activeNav={activeNav} onChange={onChangeNav} />

      <div className="app-main">
        <HeaderBar activeNav={activeNav} />
        <main className="app-content">{children}</main>
      </div>

      {showAiPanel ? <RightAiPanel activeNav={activeNav} /> : null}
    </div>
  );
}
