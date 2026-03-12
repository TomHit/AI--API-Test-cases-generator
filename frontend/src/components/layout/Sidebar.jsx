import React from "react";
import { NAV_ITEMS } from "../../utils/navigation";

export default function Sidebar({ activeNav, onChange }) {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">AI</div>
        <div>
          <div className="brand-title">API TestOps</div>
          <div className="brand-subtitle">AI-powered workspace</div>
        </div>
      </div>

      <div className="sidebar-org-card">
        <div className="sidebar-section-label">Organization</div>
        <div className="sidebar-org-name">XauTrendLab</div>
        <div className="sidebar-org-meta">3 teams • 4 projects</div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Workspace</div>

        {NAV_ITEMS.map((item) => {
          const isActive = activeNav === item.key;
          const className = [
            "sidebar-nav-item",
            isActive ? "active" : "",
            item.disabled ? "disabled" : "",
          ]
            .join(" ")
            .trim();

          return (
            <button
              key={item.key}
              type="button"
              className={className}
              onClick={() => !item.disabled && onChange(item.key)}
              disabled={item.disabled}
              title={item.disabled ? "Coming soon" : item.label}
            >
              <span>{item.label}</span>
              {item.badge ? (
                <span className="nav-badge">{item.badge}</span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
