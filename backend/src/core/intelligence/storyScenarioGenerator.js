function uniqueBy(items = [], getKey = (x) => x?.id) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    const key = getKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function normalizeText(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function makeScenario(id, category, title, objective, priority = "medium") {
  return {
    id,
    category,
    title,
    objective,
    priority,
  };
}

function buildFunctionalScenarios(summary = {}, signals = {}) {
  const items = [
    ...(summary?.qa_planning_summary?.functional?.flows || []),
    ...(summary?.qa_planning_summary?.functional?.scope || []),
    ...(signals?.qa_signals?.functional || []),
  ]
    .map(normalizeText)
    .filter(Boolean);

  return items.map((item, index) =>
    makeScenario(
      `STORY-FUNC-${String(index + 1).padStart(3, "0")}`,
      "functional",
      `Validate functional behavior: ${item}`,
      `Verify the story supports the functional behavior '${item}' correctly under expected business flow conditions.`,
      "high",
    ),
  );
}

function buildIntegrationScenarios(summary = {}, signals = {}) {
  const items = [
    ...(summary?.qa_planning_summary?.integration?.interactions || []),
    ...(summary?.qa_planning_summary?.integration?.dependencies || []),
    ...(signals?.qa_signals?.integration || []),
  ]
    .map(normalizeText)
    .filter(Boolean);

  return items.map((item, index) =>
    makeScenario(
      `STORY-INT-${String(index + 1).padStart(3, "0")}`,
      "integration",
      `Validate integration behavior: ${item}`,
      `Verify the system interaction '${item}' works correctly across connected services and boundaries.`,
      "high",
    ),
  );
}

function buildDatabaseScenarios(summary = {}, signals = {}) {
  const items = [
    ...(summary?.qa_planning_summary?.database?.persistence_rules || []),
    ...(summary?.qa_planning_summary?.database?.consistency_rules || []),
    ...(signals?.qa_signals?.database || []),
  ]
    .map(normalizeText)
    .filter(Boolean);

  return items.map((item, index) =>
    makeScenario(
      `STORY-DB-${String(index + 1).padStart(3, "0")}`,
      "database",
      `Validate database behavior: ${item}`,
      `Verify the persistence or consistency rule '${item}' is enforced correctly in storage and state transitions.`,
      "high",
    ),
  );
}

function buildReliabilityScenarios(summary = {}, signals = {}) {
  const items = [
    ...(summary?.qa_planning_summary?.reliability?.failure_modes || []),
    ...(summary?.qa_planning_summary?.reliability?.retry_behaviors || []),
    ...(summary?.qa_planning_summary?.reliability?.async_behaviors || []),
    ...(signals?.qa_signals?.reliability || []),
  ]
    .map(normalizeText)
    .filter(Boolean);

  return items.map((item, index) =>
    makeScenario(
      `STORY-REL-${String(index + 1).padStart(3, "0")}`,
      "reliability",
      `Validate reliability behavior: ${item}`,
      `Verify the system handles '${item}' safely under retries, delays, partial failures, or unstable conditions.`,
      "high",
    ),
  );
}

function buildSecurityScenarios(summary = {}, signals = {}) {
  const items = [
    ...(summary?.qa_planning_summary?.security?.auth_controls || []),
    ...(summary?.qa_planning_summary?.security?.sensitive_data || []),
    ...(summary?.qa_planning_summary?.security?.abuse_risks || []),
    ...(signals?.qa_signals?.security || []),
  ]
    .map(normalizeText)
    .filter(Boolean);

  return items.map((item, index) =>
    makeScenario(
      `STORY-SEC-${String(index + 1).padStart(3, "0")}`,
      "security",
      `Validate security behavior: ${item}`,
      `Verify the system protects against the security risk or control area '${item}' appropriately.`,
      "high",
    ),
  );
}

export function generateStoryTestScenarios(summary = {}, signals = {}) {
  const scenarios = [
    ...buildFunctionalScenarios(summary, signals),
    ...buildIntegrationScenarios(summary, signals),
    ...buildDatabaseScenarios(summary, signals),
    ...buildReliabilityScenarios(summary, signals),
    ...buildSecurityScenarios(summary, signals),
  ];

  return uniqueBy(scenarios, (x) => x.id);
}
