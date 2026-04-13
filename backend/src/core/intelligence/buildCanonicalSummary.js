import { createEmptySummarySchema, uniqueCleanList } from "./summarySchema.js";

import { buildFlowRiskMap } from "./riskEngine.js";

function normalizeFlow(value = "") {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/[□]/g, "→")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeCapability(value = "") {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/[□]/g, "→")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function humanizeRisk(name = "") {
  const map = {
    auth_authz: "authentication and authorization weaknesses",
    sensitive_data_exposure: "sensitive data exposure",
    input_validation: "input validation gaps",
    duplicate_operation_risk: "duplicate transaction risk",
    rate_limiting: "rate limiting weaknesses",
    payment_failure: "payment failure handling",
    workflow_breakage: "workflow breakage",
  };

  return (
    map[name] ||
    String(name || "")
      .replaceAll("_", " ")
      .trim()
  );
}

function isNoiseCapability(value = "") {
  const v = normalizeCapability(value);

  return [
    "engineering",
    "team",
    "merchant",
    "merchants",
    "customer",
    "customers",
    "user",
    "users",
    "dashboard",
    "compliance",
    "product team",
    "qa",
    "stakeholders",
    "overview",
    "objectives",
    "dependencies",
    "success metrics",
  ].includes(v);
}

function normalizeCapabilityMeaning(value = "") {
  const v = normalizeCapability(value);

  if (!v || isNoiseCapability(v)) return "";

  if (v.includes("upi")) return "UPI payments";
  if (v.includes("wallet")) return "wallet payments";
  if (v.includes("card")) return "card payments";
  if (v.includes("net banking")) return "net banking";
  if (v.includes("refund")) return "refund handling";
  if (v.includes("chargeback")) return "chargeback handling";
  if (v.includes("dispute")) return "dispute management";
  if (v.includes("notification") || v.includes("email") || v.includes("sms")) {
    return "real-time notifications";
  }
  if (v.includes("analytics") || v.includes("report")) {
    return "analytics and reporting";
  }
  if (v.includes("fraud")) return "fraud detection";
  if (v.includes("token")) return "tokenization";
  if (v.includes("encrypt")) return "encryption";
  if (v.includes("checkout")) return "checkout";
  if (v.includes("dashboard")) return "merchant dashboard";
  if (v.includes("2fa")) return "two-factor authentication";
  if (v.includes("international")) return "international payments";
  if (v.includes("currency") || v.includes("localization")) {
    return "multi-currency and localization support";
  }
  if (v.includes("monitor")) return "real-time monitoring";
  if (v.includes("sdk") || v.includes("plugin")) {
    return "integration tooling";
  }
  if (v.includes("settlement")) return "settlement management";

  return v;
}

function isPrimaryFlow(value = "") {
  const v = normalizeFlow(value);

  return [
    "initiation",
    "validation",
    "authorization",
    "response",
    "settlement",
    "capture", // optional fallback naming
  ].includes(v);
}

function isSecondaryFlow(value = "") {
  const v = normalizeFlow(value);

  if (!v) return false;

  return [
    "refund",
    "refunds",
    "chargeback",
    "chargebacks",
    "dispute",
    "dispute management",
    "notification",
    "notifications",
    "report",
    "reporting",
    "analytics",
    "settlement",
    "settlements",
  ].includes(v);
}

function isWorkflowNoise(value = "") {
  const v = normalizeFlow(value);

  return (
    !v ||
    v.includes("fraud risk") ||
    v.includes("ai based detection") ||
    v.includes("downtime") ||
    v.includes("redundancy") ||
    v.includes("regulatory changes") ||
    v.includes("regular audits") ||
    v.includes("transaction flow") ||
    v.includes(":") ||
    v.length > 80
  );
}

function normalizeCompliance(items = []) {
  const joined = items.join(" ").toLowerCase();
  const out = [];

  if (joined.includes("pci")) out.push("PCI DSS");
  if (joined.includes("gdpr")) out.push("GDPR");
  if (joined.includes("rbi")) out.push("RBI guidelines");
  if (joined.includes("oauth")) out.push("OAuth 2.0");

  return uniqueCleanList(out, 10);
}

function normalizeOpenQuestions(items = []) {
  const joined = items.map((x) => String(x || "").toLowerCase()).join(" ");
  const out = [];

  if (joined.includes("idempotency")) out.push("idempotency controls");
  if (joined.includes("sensitive data")) out.push("sensitive data protection");
  if (joined.includes("retry"))
    out.push("retry and duplicate handling clarification");
  if (joined.includes("settlement"))
    out.push("settlement reconciliation rules");

  return uniqueCleanList(out, 10);
}

function normalizeActors(items = []) {
  const allowed = new Set(["merchant", "customer", "admin", "operator"]);
  return uniqueCleanList(
    items
      .map((x) =>
        String(x || "")
          .trim()
          .toLowerCase(),
      )
      .filter((x) => allowed.has(x)),
    10,
  );
}

export function buildCanonicalSummary({ baseAnalysis = {}, docSignals = {} }) {
  const schema = createEmptySummarySchema();

  const projectCard = baseAnalysis?.projectCard || {};
  const classification = baseAnalysis?.classification || {};

  schema.system_identity.system_type =
    projectCard?.project_type || classification?.projectType || "";

  schema.system_identity.domain =
    projectCard?.business_domain_label ||
    classification?.businessDomainLabel ||
    "";

  schema.system_identity.subtype =
    projectCard?.subtype || classification?.subtype || "";

  schema.system_identity.confidence =
    Number(
      baseAnalysis?.confidence ??
        projectCard?.confidence ??
        classification?.confidence ??
        0,
    ) || 0;

  schema.actors = normalizeActors(
    (docSignals?.actors || []).map((x) => x?.actor),
  );

  schema.capabilities = uniqueCleanList(
    (docSignals?.feature_hints || [])
      .map(normalizeCapabilityMeaning)
      .filter(Boolean),
    12,
  );

  const flows = Array.isArray(docSignals?.flows) ? docSignals.flows : [];

  const normalizedFlows = flows
    .map((f) => normalizeFlow(f?.action))
    .filter((x) => x && !isWorkflowNoise(x));

  schema.workflows.primary = uniqueCleanList(
    normalizedFlows.filter((x) => isPrimaryFlow(x)),
    10,
  );

  if (
    schema.workflows.primary.includes("response") &&
    !schema.workflows.primary.includes("settlement")
  ) {
    schema.workflows.primary.push("settlement");
  }

  schema.workflows.secondary = uniqueCleanList(
    normalizedFlows.filter(
      (x) => !schema.workflows.primary.includes(x) && isSecondaryFlow(x),
    ),
    10,
  );

  schema.testing.flow_risk_map = buildFlowRiskMap(schema);
  const capabilityText = (docSignals?.feature_hints || [])
    .map((x) => String(x || "").toLowerCase())
    .join(" ");

  if (capabilityText.includes("refund")) {
    schema.workflows.secondary.push("refund handling");
  }

  if (
    capabilityText.includes("chargeback") ||
    capabilityText.includes("dispute")
  ) {
    schema.workflows.secondary.push("dispute management");
  }

  if (capabilityText.includes("report")) {
    schema.workflows.secondary.push("reporting");
  }

  schema.workflows.secondary = uniqueCleanList(schema.workflows.secondary, 10);

  schema.workflows.exception = uniqueCleanList(
    (docSignals?.edge_cases || [])
      .map((x) => String(x || "").trim())
      .filter(Boolean),
    10,
  );

  schema.security_compliance.auth = uniqueCleanList(
    (docSignals?.risks || [])
      .map((x) => x?.name)
      .filter((x) => x === "auth_authz"),
    10,
  );

  schema.security_compliance.data_protection = uniqueCleanList(
    (docSignals?.risks || [])
      .map((x) => x?.name)
      .filter((x) =>
        ["sensitive_data_exposure", "input_validation"].includes(x),
      ),
    10,
  );

  schema.security_compliance.compliance = normalizeCompliance([
    ...(docSignals?.feature_hints || []),
    ...(docSignals?.constraints || []),
    ...(docSignals?.validations || []),
  ]);

  schema.operations.constraints = uniqueCleanList(
    docSignals?.constraints || [],
    10,
  );

  schema.operations.non_functionals = uniqueCleanList(
    [
      ...(docSignals?.validations || []).filter((x) =>
        /latency|uptime|availability|scalability|tps|performance/i.test(
          String(x || ""),
        ),
      ),
      ...(docSignals?.constraints || []).filter((x) =>
        /latency|uptime|availability|scalability|tps|performance/i.test(
          String(x || ""),
        ),
      ),
    ],
    10,
  );

  schema.operations.success_metrics = uniqueCleanList(
    [
      ...(docSignals?.constraints || []).filter((x) =>
        /success|latency|satisfaction|accuracy/i.test(String(x || "")),
      ),
    ],
    10,
  );

  schema.testing.focus_areas = uniqueCleanList(
    (docSignals?.risks || []).map((x) => humanizeRisk(x?.name)),
    10,
  );
  if (!schema.testing.focus_areas.length) {
    schema.testing.focus_areas = uniqueCleanList(schema.workflows.primary, 5);
  }

  // ==========================
  // QA SIGNALS (CORE ADDITION)
  // ==========================
  const qaSignals = docSignals?.qa_signals || {};

  schema.testing.qa_signals = {
    functional: uniqueCleanList(qaSignals.functional || [], 10),
    integration: uniqueCleanList(qaSignals.integration || [], 10),
    database: uniqueCleanList(qaSignals.database || [], 10),
    reliability: uniqueCleanList(qaSignals.reliability || [], 10),
    security: uniqueCleanList(qaSignals.security || [], 10),
  };

  // fallback enrichment if doc is weak
  if (!schema.testing.qa_signals.functional.length) {
    schema.testing.qa_signals.functional = uniqueCleanList(
      schema.workflows.primary,
      5,
    );
  }

  if (!schema.testing.qa_signals.integration.length) {
    schema.testing.qa_signals.integration = uniqueCleanList(
      schema.workflows.secondary,
      5,
    );
  }

  schema.testing.failure_scenarios = uniqueCleanList(
    (docSignals?.edge_cases || [])
      .map((x) => String(x || "").trim())
      .map((x) => x.replace(/[□]/g, "→"))
      .filter(Boolean)
      .flatMap((x) => {
        const lower = x.toLowerCase();
        const normalized = [];

        if (lower.includes("retry")) {
          normalized.push("retry mechanism validation");
        }

        if (lower.includes("error handling")) {
          normalized.push("error handling behavior");
        }

        if (
          lower.includes("email") ||
          lower.includes("sms") ||
          lower.includes("notification")
        ) {
          normalized.push("notification delivery failures");
        }

        if (lower.includes("responsive ui") || lower.includes("ui")) {
          normalized.push("UI/UX failure handling");
        }

        if (
          lower.includes("payment failed") ||
          lower.includes("declined") ||
          lower.includes("charge failed")
        ) {
          normalized.push("payment failure handling");
        }

        return normalized;
      }),
    5,
  );

  schema.testing.open_questions = normalizeOpenQuestions(
    projectCard?.missing || [],
  );

  schema.evidence.snippets = uniqueCleanList(
    [
      ...(docSignals?.validations || []).slice(0, 3),
      ...(docSignals?.constraints || []).slice(0, 3),
      ...(docSignals?.edge_cases || []).slice(0, 3),
    ],
    8,
  );

  schema.evidence.sources = uniqueCleanList(
    [docSignals?.sourceType || "", baseAnalysis?.signals?.analysisMode || ""],
    5,
  );

  return schema;
}
