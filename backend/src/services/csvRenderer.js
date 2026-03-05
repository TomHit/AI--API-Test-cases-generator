function q(v) {
  const s = String(v ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

export function renderCsvFromTestPlan(testplan) {
  const header = [
    "suite_id",
    "case_id",
    "title",
    "type",
    "priority",
    "method",
    "path",
    "needs_review",
    "steps",
    "expected",
  ];

  const lines = [header.join(",")];

  for (const s of testplan?.suites || []) {
    for (const tc of s?.cases || []) {
      lines.push(
        [
          q(s.suite_id),
          q(tc.id),
          q(tc.title),
          q(tc.type),
          q(tc.priority),
          q(tc.method),
          q(tc.path),
          q(tc.needs_review ? "true" : "false"),
          q((tc.steps || []).join(" | ")),
          q((tc.expected || []).join(" | ")),
        ].join(","),
      );
    }
  }

  return lines.join("\n");
}
