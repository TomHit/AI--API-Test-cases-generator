function toText(value) {
  return String(value || "").trim();
}

function toLower(value) {
  return toText(value).toLowerCase();
}

function normalizeWhitespace(text = "") {
  return toText(text).replace(/\s+/g, " ").trim();
}

function uniqueList(items = []) {
  return [...new Set((items || []).filter(Boolean))];
}

function pushUnique(arr, value) {
  if (!value) return;
  if (!arr.includes(value)) arr.push(value);
}

function splitIntoLines(text = "") {
  return toText(text)
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
}

function splitIntoSentences(text = "") {
  return toText(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => normalizeWhitespace(s))
    .filter(Boolean);
}

function cleanPhrase(value = "") {
  return normalizeWhitespace(
    String(value || "")
      .replace(/^[-*•\d.)\s]+/, "")
      .replace(/\s+/g, " "),
  );
}

function startsLikeHeading(line = "") {
  const clean = cleanPhrase(line);
  if (!clean) return false;
  if (clean.length > 80) return false;
  if (/^[A-Z][A-Za-z0-9 /&-]{2,}$/.test(clean) && !/[.!?]$/.test(clean)) {
    return true;
  }
  return false;
}

function sentenceHasAny(text = "", patterns = []) {
  const lower = toLower(text);
  return patterns.some((pattern) => lower.includes(pattern));
}

function scoreAdd(map, key, weight = 1) {
  if (!key) return;
  map[key] = (map[key] || 0) + weight;
}

function sortScoreMap(scoreMap = {}, keyName = "name") {
  return Object.entries(scoreMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, score]) => ({
      [keyName]: name,
      score: Number((score || 0).toFixed(2)),
    }));
}

function sentenceJoin(items = [], conjunction = "and") {
  const filtered = (items || []).filter(Boolean);
  if (filtered.length === 0) return "";
  if (filtered.length === 1) return filtered[0];
  if (filtered.length === 2) {
    return `${filtered[0]} ${conjunction} ${filtered[1]}`;
  }
  return `${filtered.slice(0, -1).join(", ")}, ${conjunction} ${filtered[filtered.length - 1]}`;
}

function normalizeFlowTerm(value = "") {
  const clean = cleanPhrase(value);
  const lower = toLower(clean);

  const known = [
    ["initiation", "initiation"],
    ["validation", "validation"],
    ["authorization", "authorization"],
    ["response", "response"],
    ["settlement", "settlement"],
    ["refund", "refund"],
    ["chargeback", "chargeback"],
    ["notification", "notifications"],
    ["report", "reporting"],
    ["reporting", "reporting"],
    ["dispute", "dispute_management"],
    ["retry", "retry_handling"],
    ["fraud", "fraud_detection"],
    ["monitoring", "monitoring"],
    ["dashboard", "dashboard_review"],
  ];

  for (const [pattern, label] of known) {
    if (lower.includes(pattern)) return label;
  }

  const invalidTerms = [
    "downtime",
    "redundancy",
    "audit",
    "compliance",
    "security",
    "risk",
    "mitigation",
  ];

  if (invalidTerms.some((t) => lower.includes(t))) {
    return "";
  }
}

function isStructuredFlowSentence(sentence = "") {
  const lower = toLower(sentence);
  return (
    cleanPhrase(sentence).includes("→") || lower.includes("transaction flow:")
  );
}

function extractStructuredArrowFlows(sentences = []) {
  const flows = [];
  const evidence = {};

  for (const sentence of sentences) {
    if (!isStructuredFlowSentence(sentence)) continue;

    const clean = normalizeWhitespace(sentence);
    const afterColon = clean.includes(":")
      ? clean.split(":").slice(1).join(":")
      : clean;

    const parts = afterColon
      .split("→")
      .map((x) => cleanPhrase(x))
      .filter(Boolean);

    for (const part of parts) {
      const normalized = normalizeFlowTerm(part);
      if (!normalized) continue;

      const key = `flow::${normalized}`;

      flows.push({
        name: normalized,
        action: normalized,
        object: "",
        actor: "",
        step_type: "business_flow",
        score: 5,
      });

      if (!evidence[key]) evidence[key] = [];
      pushUnique(evidence[key], clean);
    }
  }

  return { flows, evidence };
}

function extractColonDefinedFlows(lines = []) {
  const flows = [];
  const evidence = {};

  const headingLikePrefixes = [
    "transaction flow",
    "refunds & chargebacks",
    "refunds",
    "chargebacks",
    "notifications",
    "reporting",
    "security",
    "compliance",
    "monitoring",
    "dependencies",
    "success metrics",
  ];

  for (const rawLine of lines) {
    const line = cleanPhrase(rawLine);
    const lower = toLower(line);

    if (!line.includes(":")) continue;
    if (!headingLikePrefixes.some((prefix) => lower.startsWith(prefix)))
      continue;

    const [left, right] = line.split(/:(.+)/).filter(Boolean);
    const category = normalizeFlowTerm(left);

    if (category) {
      const key = `flow::${category}`;
      flows.push({
        name: category,
        action: category,
        object: "",
        actor: "",
        step_type: "business_flow_group",
        score: 2,
      });

      if (!evidence[key]) evidence[key] = [];
      pushUnique(evidence[key], line);
    }

    const rightParts = String(right || "")
      .split(/[;,]/)
      .map((x) => cleanPhrase(x))
      .filter(Boolean)
      .slice(0, 5);

    for (const part of rightParts) {
      const normalized = normalizeFlowTerm(part);
      if (!normalized) continue;

      const key = `flow::${normalized}`;
      flows.push({
        name: normalized,
        action: normalized,
        object: "",
        actor: "",
        step_type: "business_flow_detail",
        score: 1.5,
      });

      if (!evidence[key]) evidence[key] = [];
      pushUnique(evidence[key], line);
    }
  }

  return { flows, evidence };
}

const USER_STORY_PATTERNS = [
  /^as a\s+/i,
  /^as an\s+/i,
  /^i want to\s+/i,
  /^so that\s+/i,
];

const ACCEPTANCE_PATTERNS = [
  /^given\s+/i,
  /^when\s+/i,
  /^then\s+/i,
  /^and\s+/i,
  /^scenario[:\s]/i,
];

const VALIDATION_PATTERNS = [
  "must",
  "should",
  "required",
  "mandatory",
  "cannot",
  "can not",
  "must not",
  "should not",
  "valid",
  "invalid",
  "format",
  "length",
  "size",
  "minimum",
  "maximum",
  "at least",
  "at most",
  "less than",
  "greater than",
  "equal to",
  "unique",
  "only allow",
  "allowed",
];

const CONSTRAINT_PATTERNS = [
  "within",
  "up to",
  "per user",
  "per day",
  "per hour",
  "timeout",
  "rate limit",
  "restricted",
  "depends on",
  "cannot exceed",
  "only",
  "before",
  "after",
  "sandbox",
  "live mode",
];

const EDGE_CASE_PATTERNS = [
  "if",
  "when",
  "fails",
  "failure",
  "error",
  "invalid",
  "not found",
  "duplicate",
  "already exists",
  "timeout",
  "retry",
  "missing",
  "unsupported",
  "unauthorized",
  "forbidden",
  "declined",
  "blocked",
];

const RISK_PATTERNS = [
  {
    risk: "auth_authz",
    patterns: [
      "unauthorized",
      "forbidden",
      "permission",
      "role",
      "access control",
      "two-step authentication",
      "2fa",
      "mfa",
    ],
  },
  {
    risk: "input_validation",
    patterns: ["invalid", "validation", "required", "format", "must", "cannot"],
  },
  {
    risk: "file_upload_security",
    patterns: [
      "file upload",
      "upload file",
      "attachment upload",
      "multipart",
      "file type",
      "file size",
      "uploaded document",
      "uploaded image",
    ],
  },
  {
    risk: "rate_limiting",
    patterns: ["rate limit", "throttle", "too many requests", "429"],
  },
  {
    risk: "duplicate_operation_risk",
    patterns: ["duplicate", "retry", "double click", "multiple times"],
  },
  {
    risk: "sensitive_data_exposure",
    patterns: [
      "personal",
      "bank",
      "tax details",
      "verification information",
      "customer-facing information",
      "email address",
    ],
  },
  {
    risk: "payment_failure",
    patterns: ["payment failed", "declined", "charge failed", "payout"],
  },
  {
    risk: "workflow_breakage",
    patterns: ["blocked", "cannot proceed", "step failed", "fails"],
  },
];

const FEATURE_HINTS = [
  "dashboard",
  "payment link",
  "product",
  "checkout",
  "discount",
  "promotion code",
  "metrics",
  "bank details",
  "verification",
  "email",
  "social media",
  "tax",
  "fulfillment",
  "button",
  "website",
  "account settings",
];

const GENERIC_ACTIONS = [
  "create",
  "add",
  "update",
  "delete",
  "remove",
  "verify",
  "share",
  "copy",
  "select",
  "fill",
  "submit",
  "activate",
  "enable",
  "disable",
  "view",
  "open",
  "click",
  "enter",
  "send",
  "receive",
  "retry",
  "approve",
  "reject",
  "pay",
  "purchase",
  "place",
  "manage",
  "customize",
  "embed",
  "confirm",
  "review",
  "set up",
  "setup",
  "log in",
  "login",
  "sign in",
  "register",
];

const ACTOR_PATTERNS = [
  "user",
  "customer",
  "admin",
  "merchant",
  "business",
  "system",
  "dashboard",
  "operator",
  "team",
  "startup",
  "seller",
];

function extractRawText(input = {}) {
  const sources = [];

  if (input.documentsText) sources.push(toText(input.documentsText));
  if (input.prdText) sources.push(toText(input.prdText));
  if (input.jiraText) sources.push(toText(input.jiraText));
  if (input.storyText) sources.push(toText(input.storyText));
  if (input.acceptanceCriteriaText)
    sources.push(toText(input.acceptanceCriteriaText));
  if (input.commentsText) sources.push(toText(input.commentsText));

  if (Array.isArray(input.extraTexts)) {
    for (const item of input.extraTexts) {
      if (item) sources.push(toText(item));
    }
  }

  return sources.join("\n");
}

function extractUserStories(lines = []) {
  const stories = [];
  let activeStory = [];

  for (const rawLine of lines) {
    const line = cleanPhrase(rawLine);
    if (!line) continue;

    const isStoryLine = USER_STORY_PATTERNS.some((rx) => rx.test(line));

    if (isStoryLine) {
      activeStory.push(line);
      continue;
    }

    if (activeStory.length > 0) {
      if (line.length < 220 && !startsLikeHeading(line)) {
        activeStory.push(line);
      } else {
        pushUnique(stories, normalizeWhitespace(activeStory.join(" ")));
        activeStory = [];
      }
    }
  }

  if (activeStory.length > 0) {
    pushUnique(stories, normalizeWhitespace(activeStory.join(" ")));
  }

  return stories.slice(0, 20);
}

function extractAcceptanceCriteria(lines = []) {
  const criteria = [];

  for (const rawLine of lines) {
    const line = cleanPhrase(rawLine);
    if (!line) continue;

    if (
      ACCEPTANCE_PATTERNS.some((rx) => rx.test(line)) ||
      toLower(line).includes("acceptance criteria")
    ) {
      pushUnique(criteria, line);
    }
  }

  return criteria.slice(0, 40);
}

function detectActors(sentences = []) {
  const actorScores = {};

  for (const sentence of sentences) {
    const lower = toLower(sentence);
    for (const actor of ACTOR_PATTERNS) {
      if (lower.includes(actor)) {
        scoreAdd(actorScores, actor, 1);
      }
    }
  }

  return sortScoreMap(actorScores, "actor").slice(0, 15);
}

function findBestAction(sentence = "") {
  const lower = ` ${toLower(sentence)} `;
  let best = null;

  for (const action of GENERIC_ACTIONS) {
    const escaped = action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(`\\b${escaped}\\b`, "i");
    const match = lower.match(rx);
    if (match) {
      best = action;
      break;
    }
  }

  return best;
}

function normalizeAction(action = "") {
  return String(action || "")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

function extractObjectFromSentence(sentence = "", action = "") {
  const clean = normalizeWhitespace(sentence);
  if (!clean || !action) return "";

  const lower = toLower(clean);
  const actionLower = action.toLowerCase();

  let idx = lower.indexOf(actionLower);
  if (idx === -1) return "";

  let after = clean.slice(idx + action.length).trim();
  after = after
    .replace(/^(a|an|the|your|their|our)\s+/i, "")
    .replace(/^(to|for|with|by|into|from|on)\s+/i, "")
    .trim();

  if (!after) return "";

  const stopWords = [
    " and ",
    " or ",
    " so that ",
    " when ",
    " if ",
    " after ",
    " before ",
    " because ",
    ". ",
    ", ",
  ];

  let cutIndex = after.length;
  for (const stop of stopWords) {
    const found = toLower(after).indexOf(stop.trim());
    if (found > 0) {
      cutIndex = Math.min(cutIndex, found);
    }
  }

  let objectText = after.slice(0, cutIndex).trim();

  objectText = objectText
    .replace(/[.,;:]$/, "")
    .replace(/\s+/g, " ")
    .trim();

  // 🔥 REMOVE garbage endings
  objectText = objectText
    .replace(/\b(llm|api|json|http|copy)\b.*$/i, "")
    .trim();

  // 🔥 REMOVE single-letter trailing junk
  objectText = objectText.replace(/\b[a-zA-Z]$/, "").trim();

  // 🔥 REMOVE very short useless objects
  if (objectText.length < 3) return "";

  // 🔥 LIMIT words safely
  const words = objectText.split(" ").filter(Boolean).slice(0, 5);

  return words.join(" ");
}

function detectStepType(sentence = "", action = "", objectText = "") {
  const lower = toLower(sentence);
  const obj = toLower(objectText);

  if (
    [
      "create",
      "add",
      "register",
      "set up",
      "setup",
      "activate",
      "enable",
    ].includes(action) ||
    obj.includes("account") ||
    obj.includes("profile")
  ) {
    return "setup";
  }

  if (["view", "open", "select", "click", "copy"].includes(action)) {
    return "interaction";
  }

  if (
    ["submit", "pay", "purchase", "place", "confirm", "review"].includes(action)
  ) {
    return "transaction";
  }

  if (["share", "send", "receive", "embed"].includes(action)) {
    return "distribution";
  }

  if (["verify"].includes(action)) {
    return "verification";
  }

  if (["retry", "approve", "reject"].includes(action)) {
    return "exception_or_decision";
  }

  return "action";
}

function detectActorInSentence(sentence = "") {
  const lower = toLower(sentence);
  for (const actor of ACTOR_PATTERNS) {
    if (lower.includes(actor)) return actor;
  }
  return "";
}

function extractFlowSteps(sentences = [], lines = []) {
  const stepMap = new Map();
  const evidence = {};

  const structured = extractStructuredArrowFlows(sentences);
  const colonFlows = extractColonDefinedFlows(lines);

  for (const item of [...structured.flows, ...colonFlows.flows]) {
    const key = `${item.action}::${item.object || "flow"}`;

    if (!stepMap.has(key)) {
      stepMap.set(key, { ...item });
    } else {
      const current = stepMap.get(key);
      current.score += item.score;
    }
  }

  for (const [evKey, evList] of Object.entries(structured.evidence || {})) {
    if (!evidence[evKey]) evidence[evKey] = [];
    for (const line of evList) pushUnique(evidence[evKey], line);
  }

  for (const [evKey, evList] of Object.entries(colonFlows.evidence || {})) {
    if (!evidence[evKey]) evidence[evKey] = [];
    for (const line of evList) pushUnique(evidence[evKey], line);
  }

  for (const sentence of sentences) {
    const action = findBestAction(sentence);
    if (!action) continue;

    const objectText = extractObjectFromSentence(sentence, action);
    const actor = detectActorInSentence(sentence);
    const stepType = detectStepType(sentence, action, objectText);

    const normalizedAction = normalizeAction(action);
    const key = `${normalizedAction}::${objectText || "unknown"}`;

    if (!stepMap.has(key)) {
      stepMap.set(key, {
        name: objectText
          ? `${normalizedAction}_${objectText.replace(/\s+/g, "_").toLowerCase()}`
          : normalizedAction,
        action: normalizedAction,
        object: objectText || "",
        actor: actor || "",
        step_type: stepType,
        score: 0,
      });
    }

    const current = stepMap.get(key);
    current.score += 1;

    if (!evidence[key]) evidence[key] = [];
    if (evidence[key].length < 3) {
      pushUnique(evidence[key], sentence);
    }
  }

  const weakObjects = new Set([
    "mechanism",
    "system",
    "platform",
    "document",
    "documents",
    "api",
    "apis",
    "json",
    "http",
    "file",
    "files",
  ]);
  const invalidFlowWords = new Set([
    "downtime",
    "redundancy",
    "regulatory_changes",
    "compliance",
    "security",
    "monitoring",
  ]);

  const flows = [...stepMap.values()]
    .filter((item) => {
      if (!item || !item.action) return false;

      const action = toLower(item.action || "");

      // 🚫 HARD FILTER: remove non-flow / infra / risk noise
      const invalidPatterns = [
        "downtime",
        "redundancy",
        "audit",
        "compliance",
        "security",
        "risk",
        "mitigation",
        "detection",
        "monitoring",
        "alert",
      ];

      if (invalidPatterns.some((p) => action.includes(p))) {
        return false;
      }

      // 🚫 remove weak/technical junk
      if (weakObjects.has(toLower(item.object)) || action.length < 2) {
        return false;
      }

      // ✅ KEEP only meaningful business flow types
      if (
        item.step_type === "business_flow" ||
        item.step_type === "business_flow_group"
      ) {
        return true;
      }

      // ❌ drop low-quality extracted actions
      return false;
    })
    .sort((a, b) => {
      const isBusinessA = a.step_type === "business_flow";
      const isBusinessB = b.step_type === "business_flow";

      // ✅ preserve original structured order
      if (isBusinessA && isBusinessB) return 0;

      // ✅ prioritize main flow over groups
      if (isBusinessA) return -1;
      if (isBusinessB) return 1;

      return b.score - a.score;
    })
    .slice(0, 15) // 🔥 reduce noise (25 → 15)
    .map((item) => ({
      ...item,
      score: Number((item.score || 0).toFixed(2)),
    }));

  return {
    flows,
    evidence,
  };
}
function extractValidations(sentences = []) {
  const validations = [];

  for (const sentence of sentences) {
    const lower = toLower(sentence);
    if (!sentenceHasAny(lower, VALIDATION_PATTERNS)) continue;
    pushUnique(validations, sentence);
  }

  return validations.slice(0, 25);
}

function extractConstraints(sentences = []) {
  const constraints = [];

  for (const sentence of sentences) {
    const lower = toLower(sentence);
    if (!sentenceHasAny(lower, CONSTRAINT_PATTERNS)) continue;
    pushUnique(constraints, sentence);
  }

  return constraints.slice(0, 25);
}

function extractEdgeCases(sentences = []) {
  const edgeCases = [];

  for (const sentence of sentences) {
    const lower = toLower(sentence);
    if (!sentenceHasAny(lower, EDGE_CASE_PATTERNS)) continue;
    pushUnique(edgeCases, sentence);
  }

  return edgeCases.slice(0, 25);
}

function extractRisks(sentences = []) {
  const riskScores = {};
  const riskEvidence = {};

  for (const sentence of sentences) {
    const lower = toLower(sentence);

    for (const item of RISK_PATTERNS) {
      const matched = item.patterns.some((p) => lower.includes(p));
      if (!matched) continue;

      scoreAdd(riskScores, item.risk, 1);

      if (!riskEvidence[item.risk]) {
        riskEvidence[item.risk] = [];
      }

      if (riskEvidence[item.risk].length < 3) {
        pushUnique(riskEvidence[item.risk], sentence);
      }
    }
  }

  return {
    risks: sortScoreMap(riskScores, "name"),
    evidence: riskEvidence,
  };
}

function extractFeatureHints(sentences = []) {
  const features = [];

  for (const sentence of sentences) {
    const lower = toLower(sentence);
    for (const hint of FEATURE_HINTS) {
      if (lower.includes(hint)) {
        pushUnique(features, hint);
      }
    }
  }

  return features.slice(0, 25);
}

function buildDocSummary({
  actors = [],
  flows = [],
  validations = [],
  constraints = [],
  edgeCases = [],
  risks = [],
  userStories = [],
  featureHints = [],
}) {
  const parts = [];

  if (flows.length > 0) {
    const topFlows = flows
      .slice(0, 6)
      .map((x) => {
        if (x.object) {
          return `${x.action.replaceAll("_", " ")} ${x.object}`.trim();
        }
        return x.action.replaceAll("_", " ");
      })
      .filter(Boolean);

    if (topFlows.length > 0) {
      parts.push(
        `The documented workflow includes ${sentenceJoin(topFlows.slice(0, 5))}.`,
      );
    }
  }

  if (actors.length > 0) {
    const topActors = actors.slice(0, 3).map((x) => x.actor);
    parts.push(`Key actors mentioned are ${topActors.join(", ")}.`);
  }

  if (userStories.length > 0) {
    parts.push(`User stories are present in the source material.`);
  }

  if (validations.length > 0) {
    parts.push(`Validation rules are described in the requirements.`);
  }

  if (constraints.length > 0) {
    parts.push(`Operational or business constraints are also mentioned.`);
  }

  if (edgeCases.length > 0) {
    parts.push(`Failure or exception scenarios are documented.`);
  }

  if (risks.length > 0) {
    const topRisks = risks.slice(0, 4).map((x) => x.name.replaceAll("_", " "));
    parts.push(`Risk hints include ${topRisks.join(", ")}.`);
  }

  if (featureHints.length > 0) {
    parts.push(`Feature clues include ${featureHints.slice(0, 5).join(", ")}.`);
  }

  return parts.join(" ");
}

export function extractDocSignals(input = {}) {
  const rawText = extractRawText(input);
  const cleanText = String(rawText || "").trim();

  const lines = splitIntoLines(cleanText);
  const sentences = splitIntoSentences(cleanText);

  const userStories = extractUserStories(lines);
  const acceptanceCriteria = extractAcceptanceCriteria(lines);
  const actors = detectActors(sentences);
  const flowResult = extractFlowSteps(sentences, lines);
  const riskResult = extractRisks(sentences);

  const validations = extractValidations(sentences);
  const constraints = extractConstraints(sentences);
  const edgeCases = extractEdgeCases(sentences);
  const featureHints = extractFeatureHints(sentences);

  const summary = buildDocSummary({
    actors,
    flows: flowResult.flows,
    validations,
    constraints,
    edgeCases,
    risks: riskResult.risks,
    userStories,
    featureHints,
  });

  const hasContent = cleanText.length > 0;

  const hasStructuredSignals =
    actors.length > 0 ||
    flowResult.flows.length > 0 ||
    userStories.length > 0 ||
    acceptanceCriteria.length > 0 ||
    validations.length > 0 ||
    constraints.length > 0 ||
    edgeCases.length > 0 ||
    riskResult.risks.length > 0 ||
    featureHints.length > 0;

  return {
    sourceType: "document_enrichment",
    hasContent,
    hasStructuredSignals,

    summary,

    actors,
    flows: flowResult.flows,
    flow_evidence: flowResult.evidence,

    user_stories: userStories,
    acceptance_criteria: acceptanceCriteria,

    validations,
    constraints,
    edge_cases: edgeCases,

    risks: riskResult.risks,
    risk_evidence: riskResult.evidence,

    feature_hints: featureHints,

    stats: {
      char_count: cleanText.length,
      line_count: lines.length,
      sentence_count: sentences.length,
      actor_count: actors.length,
      user_story_count: userStories.length,
      acceptance_criteria_count: acceptanceCriteria.length,
      validation_count: validations.length,
      constraint_count: constraints.length,
      edge_case_count: edgeCases.length,
      risk_count: riskResult.risks.length,
      flow_count: flowResult.flows.length,
      feature_hint_count: featureHints.length,
    },

    raw_preview: cleanText.slice(0, 1200),
  };
}
