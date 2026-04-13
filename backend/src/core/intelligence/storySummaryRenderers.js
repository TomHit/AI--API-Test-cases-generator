function normalizeText(value = "") {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/[□]/g, "→")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(items = []) {
  return [
    ...new Set((items || []).map((x) => normalizeText(x)).filter(Boolean)),
  ];
}

function joinList(items = [], conjunction = "and") {
  const clean = unique(items);

  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} ${conjunction} ${clean[1]}`;

  return `${clean.slice(0, -1).join(", ")}, ${conjunction} ${clean[clean.length - 1]}`;
}

function humanizeFlow(items = []) {
  return unique(items).join(" → ");
}

function limit(items = [], count = 5) {
  return unique(items).slice(0, count);
}

function sectionBlock(title, items = []) {
  const clean = limit(items, 8);
  if (!clean.length) return "";

  return `${title}:\n${clean.map((x) => `- ${normalizeText(x)}`).join("\n")}`;
}

function collectFunctional(summary = {}, storySignals = {}) {
  return unique([
    ...(summary?.workflows?.primary || []),
    ...(summary?.workflows?.secondary || []),
    ...(summary?.capabilities || []),
    ...(storySignals?.qa_signals?.functional || []),
  ]);
}

function collectIntegration(summary = {}, storySignals = {}) {
  return unique([
    ...(summary?.system_identity?.integration_points || []),
    ...(summary?.operations?.dependencies || []),
    ...(storySignals?.systems || []),
    ...(storySignals?.qa_signals?.integration || []),
  ]);
}

function collectDatabase(summary = {}, storySignals = {}) {
  return unique([
    ...(summary?.data?.entities || []),
    ...(summary?.data?.persistence_rules || []),
    ...(summary?.data?.consistency_rules || []),
    ...(storySignals?.data_entities || []),
    ...(storySignals?.qa_signals?.database || []),
  ]);
}

function collectReliability(summary = {}, storySignals = {}) {
  return unique([
    ...(summary?.testing?.failure_modes || []),
    ...(summary?.testing?.reliability_risks || []),
    ...(summary?.operations?.constraints || []),
    ...(storySignals?.constraints || []),
    ...(storySignals?.qa_signals?.reliability || []),
  ]);
}

function collectSecurity(summary = {}, storySignals = {}) {
  return unique([
    ...(summary?.security?.controls || []),
    ...(summary?.security?.risks || []),
    ...(storySignals?.qa_signals?.security || []),
  ]);
}

function collectUnknowns(summary = {}, storySignals = {}) {
  return unique([
    ...(summary?.testing?.open_questions || []),
    ...(storySignals?.unknowns || []),
  ]);
}

export function renderStoryExecutiveSummary(summary = {}, storySignals = {}) {
  const systemType = normalizeText(summary?.system_identity?.system_type || "");
  const domain = normalizeText(summary?.system_identity?.domain || "");
  const explicitActor = normalizeText(storySignals?.intent?.actor_phrase || "");
  const explicitAction = normalizeText(
    storySignals?.intent?.action_phrase || "",
  );
  const explicitBenefit = normalizeText(
    storySignals?.intent?.benefit_phrase || "",
  );
  const actors = limit(summary?.actors || storySignals?.actors || [], 4);

  const lines = [];

  if (systemType || domain) {
    lines.push(
      `This story describes ${systemType || "a system workflow"}${
        domain ? ` in ${domain}` : ""
      }.`,
    );
  }

  if (explicitActor || explicitAction) {
    lines.push(
      `Primary user intent: ${[
        explicitActor ? `${explicitActor}` : "",
        explicitAction ? `wants to ${explicitAction}` : "",
        explicitBenefit ? `so that ${explicitBenefit}` : "",
      ]
        .filter(Boolean)
        .join(" ")}.`,
    );
  }

  if (actors.length > 0) {
    lines.push(`Key actors: ${joinList(actors)}.`);
  }

  const functional = limit(collectFunctional(summary, storySignals), 4);
  if (functional.length > 0) {
    lines.push(`Main functional scope: ${joinList(functional)}.`);
  }

  return lines.join(" ").replace(/\s+/g, " ").trim();
}

export function renderStoryQaSummary(summary = {}, storySignals = {}) {
  const functional = collectFunctional(summary, storySignals);
  const integration = collectIntegration(summary, storySignals);
  const database = collectDatabase(summary, storySignals);
  const reliability = collectReliability(summary, storySignals);
  const security = collectSecurity(summary, storySignals);
  const unknowns = collectUnknowns(summary, storySignals);

  const sections = [];

  sections.push("QA planning summary");

  const functionalBlock = sectionBlock("Functional", functional);
  if (functionalBlock) sections.push(functionalBlock);

  const integrationBlock = sectionBlock("Integration", integration);
  if (integrationBlock) sections.push(integrationBlock);

  const databaseBlock = sectionBlock("Database", database);
  if (databaseBlock) sections.push(databaseBlock);

  const reliabilityBlock = sectionBlock("Reliability", reliability);
  if (reliabilityBlock) sections.push(reliabilityBlock);

  const securityBlock = sectionBlock("Security", security);
  if (securityBlock) sections.push(securityBlock);

  const unknownsBlock = sectionBlock("Needs clarification", unknowns);
  if (unknownsBlock) sections.push(unknownsBlock);

  sections.push(
    "Note: this summary combines explicit story details with supporting evidence from PRD, comments, acceptance criteria, and available system context. Areas listed under 'Needs clarification' should not be over-inferred during test generation.",
  );

  return sections.join("\n\n");
}
