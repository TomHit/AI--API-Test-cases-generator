import { loadRuleCatalog } from "../rules/loadRuleCatalog.js";
import { RULE_CONDITION_MAP } from "../rules/ruleConditionMap.js";
import { profileEndpoint } from "./endpointProfiler.js";

function normalizeInclude(include) {
  if (!Array.isArray(include) || include.length === 0) {
    return ["contract", "schema"];
  }

  return include.map((x) => String(x).toLowerCase().trim()).filter(Boolean);
}

function normalizeMethod(method) {
  return String(method || "").toUpperCase();
}

function methodMatchesFilter(endpoint, methodFilter) {
  if (!methodFilter) return true;

  const endpointMethod = normalizeMethod(endpoint?.method);
  const allowed = String(methodFilter)
    .split("|")
    .map((m) => normalizeMethod(m))
    .filter(Boolean);

  if (allowed.length === 0) return true;
  return allowed.includes(endpointMethod);
}

function dedupeRules(rules) {
  const seen = new Set();
  const out = [];

  for (const rule of Array.isArray(rules) ? rules : []) {
    const key = `${rule?.rule_id || ""}::${rule?.category || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(rule);
  }

  return out;
}

export async function evaluateRules(
  endpoint,
  profileOrOptions = {},
  maybeOptions = {},
) {
  const hasProfile =
    profileOrOptions &&
    typeof profileOrOptions === "object" &&
    Object.prototype.hasOwnProperty.call(profileOrOptions, "exists") &&
    Object.prototype.hasOwnProperty.call(profileOrOptions, "method");

  const profile = hasProfile ? profileOrOptions : profileEndpoint(endpoint);
  const options = hasProfile ? maybeOptions : profileOrOptions;

  const include = normalizeInclude(options?.include);
  const rules = await loadRuleCatalog();
  const matchedRules = [];
  const skipped = {
    category: [],
    method: [],
    missingCondition: [],
    conditionFalse: [],
    errors: [],
  };

  for (const rule of rules) {
    const category = String(rule?.category || "").toLowerCase();

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
      if (conditionFn(endpoint, profile, options)) {
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
      console.error("Rule evaluation failed:", rule?.rule_id, err);
    }
  }

  const deduped = dedupeRules(matchedRules);

  deduped.sort((a, b) => {
    const ap = String(a?.priority || "");
    const bp = String(b?.priority || "");
    return (
      ap.localeCompare(bp) ||
      String(a?.rule_id || "").localeCompare(String(b?.rule_id || ""))
    );
  });

  if (options?.debugRules) {
    console.log(`RULE EVALUATION for ${endpoint?.method} ${endpoint?.path}`);
    console.log("Endpoint profile:", profile);
    console.log(
      "Matched rules:",
      deduped.map((r) => r.rule_id),
    );
    console.log("Skipped:", skipped);
  }

  return { profile, rules: deduped };
}
