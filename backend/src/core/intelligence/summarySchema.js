export function createEmptySummarySchema() {
  return {
    system_identity: {
      system_type: "",
      domain: "",
      subtype: "",
      purpose: "",
      confidence: 0,
    },

    actors: [],
    capabilities: [],

    workflows: {
      primary: [],
      secondary: [],
      exception: [],
    },

    integrations: [],

    security_compliance: {
      auth: [],
      data_protection: [],
      compliance: [],
    },

    operations: {
      constraints: [],
      non_functionals: [],
      success_metrics: [],
    },

    testing: {
      focus_areas: [],
      failure_scenarios: [],
      open_questions: [],
      flow_risk_map: [],
    },

    evidence: {
      snippets: [],
      sources: [],
    },
  };
}

export function uniqueCleanList(items = [], limit = 20) {
  return [
    ...new Set(
      (items || []).map((x) => String(x || "").trim()).filter(Boolean),
    ),
  ].slice(0, limit);
}
