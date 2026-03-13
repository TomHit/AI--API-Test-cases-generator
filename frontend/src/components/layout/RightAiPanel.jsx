import React from "react";

const PANEL_CONTENT = {
  overview: {
    cards: [
      {
        title: "AI Insights",
        body: "AI is continuously organizing your workspace around teams, projects, and test coverage.",
      },
      {
        title: "Coverage Snapshot",
        metrics: [
          ["Projects", "4"],
          ["Endpoints", "107"],
          ["Generated tests", "1,240"],
        ],
      },
      {
        title: "Suggestions",
        list: [
          "Add team-level invites instead of user-by-user access.",
          "Map projects to one or more teams for automatic visibility.",
          "Highlight high-risk endpoints on the Generate Tests page.",
        ],
      },
    ],
  },

  testCases: {
    cards: [
      {
        title: "Review Tips",
        list: [
          "Inspect contract cases first.",
          "Check AI reasoning before export.",
          "Review negative tests for missing validation.",
        ],
      },
    ],
  },

  reports: {
    cards: [
      {
        title: "Report Guidance",
        list: [
          "Review total generated cases.",
          "Track endpoint risk summary.",
          "Export JSON or CSV for sharing.",
        ],
      },
    ],
  },
};

export default function RightAiPanel({ activeNav }) {
  const content = PANEL_CONTENT[activeNav];

  if (!content) return null;

  return (
    <aside className="ai-panel">
      {content.cards.map((card, index) => (
        <div className="ai-panel-card" key={`${activeNav}-${index}`}>
          <div className="ai-panel-title">{card.title}</div>

          {card.body ? <div className="ai-panel-text">{card.body}</div> : null}

          {card.metrics
            ? card.metrics.map(([label, value]) => (
                <div className="metric-row" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))
            : null}

          {card.list ? (
            <ul className="ai-list">
              {card.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </aside>
  );
}
