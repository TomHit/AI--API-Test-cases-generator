import { loadRuleCatalog } from "../rules/loadRuleCatalog.js";
import { RULE_CONDITION_MAP } from "../rules/ruleConditionMap.js";

const DEFAULT_INCLUDE = ["contract", "schema", "negative", "auth"];

const PRIORITY_RANK = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

function normalizeInclude(include) {
  if (!Array.isArray(include) || include.length === 0) {
    return DEFAULT_INCLUDE;
  }

  return [
    ...new Set(
      include.map((x) => String(x).toLowerCase().trim()).filter(Boolean),
    ),
  ];
}

function normalizeMethod(method) {
  return String(method || "").toUpperCase();
}

function methodMatchesFilter(endpoint, methodFilter) {
  if (!methodFilter) return true;

  const endpointMethod = normalizeMethod(endpoint?.method);

  const allowed = Array.isArray(methodFilter)
    ? methodFilter.map((m) => normalizeMethod(m)).filter(Boolean)
    : String(methodFilter)
        .split("|")
        .map((m) => normalizeMethod(m))
        .filter(Boolean);

  if (allowed.length === 0) return true;
  return allowed.includes(endpointMethod);
}

function isUsableRule(rule) {
  return (
    rule &&
    typeof rule === "object" &&
    String(rule?.rule_id || "").trim() &&
    String(rule?.category || "").trim() &&
    String(rule?.applies_when || "").trim()
  );
}

function dedupeRules(rules) {
  const seen = new Set();
  const out = [];

  for (const rule of Array.isArray(rules) ? rules : []) {
    const key = [
      String(rule?.rule_id || "")
        .trim()
        .toLowerCase(),
      String(rule?.category || "")
        .trim()
        .toLowerCase(),
      String(rule?.applies_when || "")
        .trim()
        .toLowerCase(),
    ].join("::");

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(rule);
  }

  return out;
}

function getPriorityRank(priority) {
  const key = String(priority || "")
    .trim()
    .toUpperCase();
  return PRIORITY_RANK[key] ?? 999;
}

export async function evaluateRules(endpoint, options = {}) {
  const include = normalizeInclude(options?.include);
  const rulesRaw = await loadRuleCatalog();
  const rules = Array.isArray(rulesRaw) ? rulesRaw : [];
  const matchedRules = [];
  const skipped = {
    category: [],
    method: [],
    missingCondition: [],
    conditionFalse: [],
    errors: [],
  };

  for (const rule of rules) {
    if (!isUsableRule(rule)) {
      skipped.errors.push({
        rule_id: rule?.rule_id || null,
        message: "Malformed rule object in catalog",
      });
      continue;
    }

    const category = String(rule?.category || "")
      .toLowerCase()
      .trim();

    if (!include.includes(category)) {
      skipped.category.push(rule?.rule_id);
      continue;
    }

    if (!methodMatchesFilter(endpoint, rule?.method_filter)) {
      skipped.method.push(rule?.rule_id);
      continue;
    }

    const appliesWhen = String(rule?.applies_when || "").trim();
    const conditionFn = RULE_CONDITION_MAP[appliesWhen];

    if (!conditionFn) {
      skipped.missingCondition.push({
        rule_id: rule?.rule_id,
        applies_when: appliesWhen,
      });
      continue;
    }

    try {
      const passed = await Promise.resolve(conditionFn(endpoint, options));

      if (passed) {
        matchedRules.push(rule);
      } else {
        skipped.conditionFalse.push({
          rule_id: rule?.rule_id,
          applies_when: appliesWhen,
        });
      }
    } catch (err) {
      skipped.errors.push({
        rule_id: rule?.rule_id,
        message: err?.message || String(err),
      });

      console.error("Rule evaluation failed", {
        rule_id: rule?.rule_id,
        applies_when: rule?.applies_when,
        method: endpoint?.method,
        path: endpoint?.path,
        message: err?.message || String(err),
      });
    }
  }

  const deduped = dedupeRules(matchedRules);

  deduped.sort((a, b) => {
    return (
      getPriorityRank(a?.priority) - getPriorityRank(b?.priority) ||
      String(a?.rule_id || "").localeCompare(String(b?.rule_id || ""))
    );
  });

  if (options?.debugRules) {
    console.log(`RULE EVALUATION for ${endpoint?.method} ${endpoint?.path}`);
    console.log(
      "Matched rules:",
      deduped.map((r) => r.rule_id),
    );
    console.log("Skipped:", skipped);
  }

  return deduped;
}
