function normalizeText(value = "") {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/[□]/g, "→")
    .replace(/\s+/g, " ")
    .trim();
}

function joinList(items = [], conjunction = "and") {
  const clean = (items || []).map((x) => normalizeText(x)).filter(Boolean);

  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} ${conjunction} ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, ${conjunction} ${clean[clean.length - 1]}`;
}

function humanizeFlow(items = []) {
  return (items || [])
    .map((x) => normalizeText(x))
    .filter(Boolean)
    .join(" → ");
}

function limit(items = [], count = 5) {
  return (items || []).filter(Boolean).slice(0, count);
}

export function renderExecutiveSummary(schema = {}) {
  const parts = [];

  const systemType = normalizeText(schema?.system_identity?.system_type || "");
  const domain = normalizeText(schema?.system_identity?.domain || "");
  const subtype = normalizeText(schema?.system_identity?.subtype || "");

  const capabilities = limit(schema?.capabilities || [], 6);
  const primary = limit(schema?.workflows?.primary || [], 6);
  const secondary = limit(schema?.workflows?.secondary || [], 5);

  const compliance = limit(schema?.security_compliance?.compliance || [], 3);
  const auth = limit(schema?.security_compliance?.auth || [], 2);
  const dataProtection = limit(
    schema?.security_compliance?.data_protection || [],
    2,
  );

  const focusAreas = limit(schema?.testing?.focus_areas || [], 4);

  // 1. System description (smarter wording)
  if (systemType || domain) {
    parts.push(
      `This system is a ${systemType || "software platform"}${
        domain ? ` in the ${domain} domain` : ""
      }, designed to handle end-to-end digital financial transactions.`,
    );
  }

  // 2. Capabilities → interpreted
  if (capabilities.length > 0) {
    parts.push(
      `It enables transaction processing across multiple payment methods, including ${joinList(
        capabilities.slice(0, 4),
      )}.`,
    );
  }

  // 3. Workflow → lifecycle explanation
  if (primary.length > 0) {
    parts.push(
      `The platform manages the complete transaction lifecycle from ${humanizeFlow(
        primary.slice(0, 5),
      )}, ensuring consistency and reliability across operations.`,
    );
  }

  // 4. Secondary → business meaning
  if (secondary.length > 0) {
    parts.push(
      `It also supports post-transaction workflows such as ${joinList(
        secondary.slice(0, 4),
      )}, which are essential for operational continuity and user experience.`,
    );
  }

  // 5. Security + compliance → merged intelligently
  const securitySignals = [
    ...compliance,
    ...auth.map((x) =>
      x === "auth_authz" ? "authentication and authorization" : x,
    ),
    ...dataProtection.map((x) =>
      x === "sensitive_data_exposure"
        ? "sensitive data exposure"
        : x === "input_validation"
          ? "input validation"
          : x,
    ),
  ];

  if (securitySignals.length > 0) {
    parts.push(
      `Security and compliance are integral, with controls around ${joinList(
        securitySignals,
      )}.`,
    );
  }

  // 6. Testing → intelligent framing
  if (focusAreas.length > 0) {
    parts.push(
      `From a quality perspective, key concerns include ${joinList(
        focusAreas.slice(0, 4),
      )}, requiring thorough validation to ensure robustness and correctness.`,
    );
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function renderQaSummary(schema = {}) {
  const sections = [];

  const systemType = schema?.system_identity?.system_type;
  const domain = schema?.system_identity?.domain;

  const actors = schema?.actors || [];
  const primary = schema?.workflows?.primary || [];
  const secondary = schema?.workflows?.secondary || [];

  const flowRiskMap = schema?.testing?.flow_risk_map || [];
  const focusAreas = schema?.testing?.focus_areas || [];

  // 1. Purpose
  if (systemType || domain) {
    sections.push(
      `Purpose: ${joinList(
        [systemType, domain ? `domain: ${domain}` : ""].filter(Boolean),
        " | ",
      )}`,
    );
  }

  // 2. Actors
  if (actors.length > 0) {
    sections.push(`Actors: ${joinList(actors.slice(0, 5))}`);
  }

  // 3. Core flow
  if (primary.length > 0) {
    sections.push(`Core flow:\n${humanizeFlow(primary.slice(0, 8))}`);
  }

  // 4. Key behavior (NEW — intelligence layer)
  if (primary.length > 0 || secondary.length > 0) {
    sections.push(
      `Key behavior:\nThe system handles end-to-end financial transactions, ensuring that each stage from ${humanizeFlow(
        primary.slice(0, 5),
      )} is executed reliably${
        secondary.length > 0
          ? `, with accurate post-transaction handling such as ${joinList(
              secondary.slice(0, 4),
            )}`
          : ""
      }.`,
    );
  }

  // 5. Risk reasoning (CORE UPGRADE)
  if (flowRiskMap.length > 0) {
    const reasoning = flowRiskMap.slice(0, 5).map((x) => {
      const flow = String(x.flow || "").toLowerCase();
      let impact = "";

      if (flow.includes("authorization")) {
        impact =
          "which can result in financial inconsistencies or unauthorized transactions";
      } else if (flow.includes("settlement")) {
        impact =
          "which can impact financial accuracy and reconciliation integrity";
      } else if (flow.includes("validation")) {
        impact =
          "which may allow incorrect or invalid transactions to pass through";
      } else if (flow.includes("initiation")) {
        impact = "which can lead to malformed or failed transaction processing";
      } else if (flow.includes("response")) {
        impact =
          "which can cause incorrect system behavior or client-side misinterpretation";
      } else if (flow.includes("refund")) {
        impact = "which can affect reversal accuracy and customer trust";
      } else if (flow.includes("notification")) {
        impact =
          "which can leave users uninformed about transaction state changes";
      }
      return `- At the ${x.flow} stage, ${x.risk}${impact ? `, ${impact}` : ""}.`;
    });

    sections.push(`Risk reasoning:\n${reasoning.join("\n")}`);
  }

  // 6. Testing perspective (smarter)
  if (focusAreas.length > 0) {
    sections.push(
      `Testing perspective:\nTesting should prioritize ${joinList(
        focusAreas.slice(0, 5),
      )}, with emphasis on transaction integrity, retry behavior, and failure handling to ensure consistent and reliable system outcomes.`,
    );
  }

  return sections.join("\n\n");
}
