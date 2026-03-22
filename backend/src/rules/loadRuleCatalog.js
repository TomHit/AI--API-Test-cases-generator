import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { TEMPLATE_REGISTRY } from "../services/templateRegistry.js";

const RULES_PATH = path.join(
  process.cwd(),
  "src",
  "rules",
  "api_test_rules_catalog.csv",
);

let cachedRules = null;
let cachedRulesPromise = null;

function clean(value) {
  return String(value ?? "").trim();
}

function normalizePriority(value) {
  const v = clean(value).toUpperCase();
  return ["P0", "P1", "P2", "P3"].includes(v) ? v : "P1";
}

function normalizeSeverity(value) {
  const v = clean(value).toLowerCase();
  return ["critical", "high", "medium", "low"].includes(v) ? v : "medium";
}

function isValidCategory(category) {
  return [
    "contract",
    "schema",
    "negative",
    "auth",
    "smoke",
    "regression",
  ].includes(category);
}
function normalizeRuleRow(row) {
  const normalized = {
    rule_id: clean(row.rule_id),
    category: clean(row.category).toLowerCase(),
    scenario: clean(row.scenario),
    applies_when: clean(row.applies_when),
    test_case_title: clean(row.test_case_title),
    priority: normalizePriority(row.priority),
    severity: normalizeSeverity(row.severity),
    method_filter: clean(row.method_filter),
    entity_scope: clean(row.entity_scope),
    notes: clean(row.notes),
    template_key: clean(row.template_key),
  };

  if (normalized.category === "smoke") {
    normalized.category = "contract";
    normalized.original_category = "smoke";
  }

  if (normalized.category === "regression") {
    normalized.category = "contract";
    normalized.original_category = "regression";
  }

  if (!normalized.rule_id) {
    throw new Error("Missing rule_id");
  }

  if (!normalized.category) {
    throw new Error(`Missing category for rule_id=${normalized.rule_id}`);
  }

  if (!isValidCategory(normalized.category)) {
    throw new Error(
      `Invalid category '${normalized.category}' for rule_id=${normalized.rule_id}`,
    );
  }

  if (!normalized.applies_when) {
    throw new Error(`Missing applies_when for rule_id=${normalized.rule_id}`);
  }

  if (
    normalized.template_key &&
    !Object.prototype.hasOwnProperty.call(
      TEMPLATE_REGISTRY,
      normalized.template_key,
    )
  ) {
    console.warn(
      `Unknown template_key in rules CSV: ${normalized.template_key} (rule_id=${normalized.rule_id})`,
    );
  }

  return normalized;
}

function warnOnDuplicateRuleIds(rules) {
  const seen = new Set();
  const duplicates = new Set();

  for (const rule of Array.isArray(rules) ? rules : []) {
    const id = String(rule?.rule_id || "")
      .trim()
      .toLowerCase();
    if (!id) continue;

    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }

  if (duplicates.size > 0) {
    console.warn(
      `Duplicate rule_id values found in rules CSV: ${Array.from(duplicates).join(", ")}`,
    );
  }
}

export function clearRuleCatalogCache() {
  cachedRules = null;
  cachedRulesPromise = null;
}

export async function loadRuleCatalog() {
  if (cachedRules) return cachedRules;
  if (cachedRulesPromise) return cachedRulesPromise;

  cachedRulesPromise = (async () => {
    if (!fs.existsSync(RULES_PATH)) {
      throw new Error(`Rule catalog CSV not found at: ${RULES_PATH}`);
    }

    const rules = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(RULES_PATH)
        .pipe(csv())
        .on("data", (row) => {
          try {
            const normalized = normalizeRuleRow(row);
            if (normalized) rules.push(normalized);
          } catch (err) {
            console.error("Failed to normalize rule row", {
              row,
              message: err?.message || String(err),
            });
          }
        })
        .on("end", resolve)
        .on("error", reject);
    });

    warnOnDuplicateRuleIds(rules);
    cachedRules = rules;
    return rules;
  })();

  try {
    return await cachedRulesPromise;
  } finally {
    cachedRulesPromise = null;
  }
}
