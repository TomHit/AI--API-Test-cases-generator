function unique(items = []) {
  return [...new Set((items || []).filter(Boolean))];
}

function first(items = [], fallback = "") {
  return Array.isArray(items) && items.length > 0 ? items[0] : fallback;
}

function inferDomain(signals = {}) {
  const hints = signals?.domain_hints || [];
  if (hints.includes("banking_finance")) return "Banking / Finance";
  if (hints.includes("healthcare")) return "Healthcare";
  if (hints.includes("ai_system")) return "AI System";
  if (hints.includes("ecommerce")) return "E-commerce";
  return "General Software";
}

function inferSystemType(signals = {}) {
  const actions = signals?.action_hints || [];
  const domain = inferDomain(signals);

  if (domain === "Banking / Finance") return "Financial API";
  if (domain === "Healthcare") return "Healthcare Platform";
  if (domain === "AI System") return "AI Application";
  if (actions.includes("authentication")) return "Operational API";
  return "Software System";
}

function inferCapabilities(signals = {}) {
  const actions = signals?.action_hints || [];
  const constraints = signals?.constraints || [];
  const out = [];

  if (actions.includes("payment")) out.push("payment processing");
  if (actions.includes("refund")) out.push("refund handling");
  if (actions.includes("settlement")) out.push("settlement management");
  if (actions.includes("dispute")) out.push("dispute management");
  if (actions.includes("notification")) out.push("real-time notifications");
  if (actions.includes("authentication")) out.push("authentication");
  if (actions.includes("upload")) out.push("file handling");

  if (constraints.includes("idempotency")) out.push("idempotency controls");
  if (constraints.includes("security controls")) out.push("security controls");
  if (constraints.includes("real-time behavior"))
    out.push("real-time processing");

  return unique(out);
}

function inferPrimaryFlow(signals = {}) {
  const actions = signals?.action_hints || [];
  const domain = inferDomain(signals);

  if (domain === "Banking / Finance" || actions.includes("payment")) {
    return [
      "initiation",
      "validation",
      "authorization",
      "response",
      "settlement",
    ];
  }

  if (actions.includes("authentication")) {
    return ["initiation", "validation", "authentication", "response"];
  }

  if (actions.includes("upload")) {
    return ["initiation", "validation", "processing", "response"];
  }

  return ["initiation", "validation", "response"];
}

function inferSecondaryFlow(signals = {}) {
  const actions = signals?.action_hints || [];
  const out = [];

  if (actions.includes("refund")) out.push("refund handling");
  if (actions.includes("dispute")) out.push("dispute management");
  if (actions.includes("notification")) out.push("notifications");
  if (actions.includes("settlement")) out.push("reporting");

  return unique(out);
}

function inferRisks(signals = {}) {
  const actions = signals?.action_hints || [];
  const constraints = signals?.constraints || [];
  const domain = inferDomain(signals);
  const out = ["input validation"];

  if (domain === "Banking / Finance" || actions.includes("payment")) {
    out.push("duplicate transaction risk");
    out.push("authentication and authorization weaknesses");
    out.push("sensitive data exposure");
  }

  if (constraints.includes("idempotency")) {
    out.push("idempotency failure");
  }

  if (actions.includes("notification")) {
    out.push("notification delivery inconsistency");
  }

  if (actions.includes("refund")) {
    out.push("refund accuracy issues");
  }

  return unique(out);
}

function inferOpenQuestions(signals = {}) {
  const actions = signals?.action_hints || [];
  const constraints = signals?.constraints || [];
  const out = [];

  if (actions.includes("payment")) out.push("settlement reconciliation rules");
  if (constraints.includes("retry handling")) {
    out.push("retry and duplicate handling clarification");
  }
  if (!actions.includes("notification")) {
    out.push("post-transaction notification requirements");
  }

  return unique(out);
}

export function inferStoryUnderstanding(signals = {}) {
  const domain = inferDomain(signals);
  const system_type = inferSystemType(signals);
  const primary_flow = inferPrimaryFlow(signals);
  const secondary_flow = inferSecondaryFlow(signals);
  const capabilities = inferCapabilities(signals);
  const risks = inferRisks(signals);
  const open_questions = inferOpenQuestions(signals);

  return {
    system_identity: {
      system_type,
      domain,
      subtype: first(signals?.action_hints || [], ""),
      confidence: 0.72,
    },
    actors: unique(signals?.actors || []),
    capabilities,
    workflows: {
      primary: primary_flow,
      secondary: secondary_flow,
      exception: [],
    },
    testing: {
      focus_areas: risks,
      failure_scenarios: [],
      open_questions,
      flow_risk_map: [],
    },
    operations: {
      constraints: unique(signals?.constraints || []),
      non_functionals: [],
      success_metrics: [],
    },
    security_compliance: {
      auth:
        system_type === "Financial API"
          ? ["authentication and authorization"]
          : [],
      data_protection:
        system_type === "Financial API"
          ? ["sensitive data exposure", "input validation"]
          : ["input validation"],
      compliance: system_type === "Financial API" ? ["RBI guidelines"] : [],
    },
    evidence: {
      snippets: [
        signals?.intent?.action_phrase || "",
        signals?.intent?.benefit_phrase || "",
      ].filter(Boolean),
      sources: ["user_story"],
    },
  };
}
